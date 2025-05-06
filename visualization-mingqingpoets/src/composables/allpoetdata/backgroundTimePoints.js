import * as echarts from 'echarts'
import { radians } from '../lifeStageVisualization/utils'
import { showTooltip, hideTooltip } from '../lifeStageVisualization/tooltip'

// 存储背景时间点元素的数组（全局）
let backgroundElements = [];

/**
 * 渲染背景灰色时间点 - 用于单选诗人模式下显示全局时间框架
 * 与timePoints.js中的renderTimePoints类似，但仅渲染灰色时间点，不渲染蓝色诗词量曲线
 */
export const renderBackgroundTimePoints = (zr, elements, center, baseRadius, timelineData) => {
    // 先清除可能已存在的背景时间点
    clearBackgroundTimePoints(zr);

    // 从 timelineData 获取聚合后的诗词量数据
    const allYearCounts = timelineData.allYearCounts; // 假设是 Map 或 Object { year: count }
    const minYear = timelineData.minYear;
    const maxYear = timelineData.maxYear;

    // 检查数据有效性
    if (!allYearCounts || minYear === null || maxYear === null || minYear >= maxYear) {
        console.warn('渲染背景时间点：缺少有效的 allYearCounts, minYear, 或 maxYear 数据');
        renderDefaultBackgroundTimePoints(zr, elements, center, baseRadius);
        return;
    }

    console.log(`渲染背景时间点，范围 ${minYear}-${maxYear}`);

    // --- 计算常量和年份范围 --- 
    const totalYears = maxYear - minYear + 1;
    const totalAngleSpan = 350; // 原始角度跨度
    const startAngleOffset = (360 - totalAngleSpan) / 2; // 原始起始偏移
    const rotationOffsetDegrees = -10; // 整体逆时针旋转 10 度
    const startPointShiftDegrees = 5; // 起点顺时针额外偏移 5 度

    // --- 计算新的角度参数 ---
    const newStartAngleUnrotated = startAngleOffset + startPointShiftDegrees; // 新的未旋转起始角度
    const newTotalSpanUnrotated = totalAngleSpan - startPointShiftDegrees; // 新的未旋转总跨度 (终点保持原始位置)
    const newAngleIncrement = totalYears <= 1 ? 0 : newTotalSpanUnrotated / (totalYears - 1); // 新的角度增量

    // 定义标记点的基础半径
    const markerBaseRadius = baseRadius + 40;

    // 本地元素数组，用于跟踪本次渲染的元素
    const localElements = [];

    // --- 循环计算点位并渲染标记 --- 
    for (let year = minYear; year <= maxYear; year++) {
        const currentIndex = year - minYear;
        // 使用新的角度参数计算当前年份的角度
        const currentAngle = newStartAngleUnrotated + currentIndex * newAngleIncrement + rotationOffsetDegrees;
        const rad = radians(currentAngle);

        // 计算 *标记点* 的基础位置（在增加后的半径上）
        const baseX = center[0] + markerBaseRadius * Math.cos(rad);
        const baseY = center[1] + markerBaseRadius * Math.sin(rad);

        // 获取该年的诗词量 (仅用于tooltip显示，不影响点的大小)
        let count = 0;
        if (allYearCounts instanceof Map) {
            count = allYearCounts.get(year) || 0;
        } else if (typeof allYearCounts === 'object' && allYearCounts !== null) {
            count = allYearCounts[year] || 0;
        }

        // --- 渲染基础年份标记 (在 markerBaseRadius 上) ---
        const isStartPoint = year === minYear;
        const isEndPoint = year === maxYear;

        let marker = null;
        let markerColor = '#aaaaaa'; // 默认中间点颜色
        let markerSize = 5; // 默认大小

        // 渲染起点标记 (三角形)
        if (isStartPoint) {
            markerColor = '#777777'; // 使用更浅的灰色代替蓝色
            markerSize = 5; // 三角形大小
            // 计算三角形顶点
            const points = [
                [baseX + markerSize * Math.cos(rad), baseY + markerSize * Math.sin(rad)],
                [baseX + markerSize * Math.cos(rad + 2 * Math.PI / 3), baseY + markerSize * Math.sin(rad + 2 * Math.PI / 3)],
                [baseX + markerSize * Math.cos(rad - 2 * Math.PI / 3), baseY + markerSize * Math.sin(rad - 2 * Math.PI / 3)]
            ];
            marker = new echarts.graphic.Polygon({
                shape: { points: points },
                style: {
                    fill: markerColor,
                    stroke: '#ffffff',
                    lineWidth: 1,
                    opacity: 0.6 // 降低不透明度
                },
                zlevel: 3, // 较低的层级
                isBackgroundElement: true // 标记为背景元素
            });
        }
        // 渲染终点标记 (正方形)
        else if (isEndPoint) {
            markerColor = '#777777'; // 使用更浅的灰色代替红色
            markerSize = 8; // 正方形大小 (宽度/高度)
            marker = new echarts.graphic.Rect({
                shape: {
                    x: baseX - markerSize / 2, // 计算左上角的x坐标
                    y: baseY - markerSize / 2, // 计算左上角的y坐标
                    width: markerSize,
                    height: markerSize
                },
                style: {
                    fill: markerColor,
                    stroke: '#ffffff',
                    lineWidth: 1,
                    opacity: 0.6 // 降低不透明度
                },
                zlevel: 3, // 较低的层级
                isBackgroundElement: true // 标记为背景元素
            });
        }
        // 渲染中间点标记 (小圆点)
        else {
            markerColor = '#aaaaaa'; // 中间点颜色
            marker = new echarts.graphic.Circle({
                shape: {
                    cx: baseX,
                    cy: baseY,
                    r: 1.5 // 中间点大小
                },
                style: {
                    fill: markerColor,
                    opacity: 0.4 // 更低的不透明度
                },
                zlevel: 3, // 较低的层级
                isBackgroundElement: true // 标记为背景元素
            });
        }

        // 添加起点/终点标签 (仅对起点和终点)
        if (isStartPoint || isEndPoint) {
            const labelDistance = markerBaseRadius + 15;
            const labelAngle = currentAngle - 1;
            const labelRad = radians(labelAngle);
            const labelX = center[0] + labelDistance * Math.cos(labelRad);
            const labelY = center[1] + labelDistance * Math.sin(labelRad);
            const yearLabel = new echarts.graphic.Text({
                style: {
                    text: `${year}${isStartPoint ? ' 始' : ' 终'}`,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    fontSize: 9, // 较小的字体
                    fontWeight: 'normal', // 非粗体
                    fill: '#999999', // 浅灰色
                },
                x: labelX,
                y: labelY,
                zlevel: 3,
                isBackgroundElement: true // 标记为背景元素
            });
            zr.add(yearLabel);
            elements.push(yearLabel);
            localElements.push(yearLabel);
        } else if (year % 20 === 0) { // 中间标签
            const labelDistance = markerBaseRadius + 12;
            const labelAngle = currentAngle;
            const labelRad = radians(labelAngle);
            const labelX = center[0] + labelDistance * Math.cos(labelRad);
            const labelY = center[1] + labelDistance * Math.sin(labelRad);
            const yearLabel = new echarts.graphic.Text({
                style: {
                    text: `${year}`,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    fontSize: 8, // 更小的字体
                    fill: '#999999', // 浅灰色
                },
                x: labelX,
                y: labelY,
                zlevel: 3,
                isBackgroundElement: true // 标记为背景元素
            });
            zr.add(yearLabel);
            elements.push(yearLabel);
            localElements.push(yearLabel);
        }

        // 为所有标记添加 Tooltip
        if (marker) {
            marker.on('mouseover', function () {
                const currentCount = count;
                let tooltipText = `${year}年`;
                if (isStartPoint) tooltipText += ' (始)';
                if (isEndPoint) tooltipText += ' (终)';
                tooltipText += `\n全局诗词总量: ${currentCount}`;

                // 标记高亮 - 仅改变颜色和透明度 
                this.attr({
                    style: {
                        fill: isStartPoint ? '#aaaaaa' : (isEndPoint ? '#aaaaaa' : '#999999'),
                        opacity: 0.8,
                    },
                });

                showTooltip(tooltipText, baseX, baseY);
            });

            marker.on('mouseout', function () {
                // 恢复标记样式
                this.attr({
                    style: {
                        fill: markerColor, // 恢复原始颜色
                        opacity: isStartPoint || isEndPoint ? 0.6 : 0.4
                    },
                });
                hideTooltip();
            });

            zr.add(marker);
            elements.push(marker);
            localElements.push(marker);
        }
    }

    // 保存所有渲染的背景元素引用
    backgroundElements = [...localElements];
    console.log(`渲染了 ${localElements.length} 个背景时间点元素`);
};

/**
 * 清除背景时间点元素
 * 用于在切换到全部诗人模式或多选模式时清除灰色时间点
 */
export const clearBackgroundTimePoints = (zr) => {
    if (!zr) {
        console.warn('清除背景时间点失败：未提供ZRender实例');
        return;
    }

    if (backgroundElements.length > 0) {
        console.log(`清除 ${backgroundElements.length} 个背景时间点元素`);
        backgroundElements.forEach(element => {
            if (element && zr) {
                zr.remove(element);
            }
        });
        backgroundElements = [];
    }
};

// 渲染默认的背景时间点（当无法获取数据时使用）
function renderDefaultBackgroundTimePoints(zr, elements, center, baseRadius) {
    // 创建24个静态时间点
    const pointCount = 24; // 24个点，每15度一个

    // 本地元素数组，用于跟踪本次渲染的元素
    const localElements = [];

    for (let i = 0; i < pointCount; i++) {
        // 计算角度 - 均匀分布
        const angle = (i / pointCount) * 360;
        const rad = radians(angle);

        // 计算点的位置
        const x = center[0] + baseRadius * Math.cos(rad);
        const y = center[1] + baseRadius * Math.sin(rad);

        // 创建时间点标记
        const timePoint = new echarts.graphic.Circle({
            shape: {
                cx: x,
                cy: y,
                r: 2 // 较小的大小
            },
            style: {
                fill: '#aaaaaa', // 浅灰色
                opacity: 0.4, // 低不透明度
                stroke: '#ffffff',
                lineWidth: 0.5
            },
            zlevel: 3, // 较低的层级
            isBackgroundElement: true // 标记为背景元素
        });

        zr.add(timePoint);
        elements.push(timePoint);
        localElements.push(timePoint);
    }

    // 保存所有渲染的背景元素引用
    backgroundElements = [...localElements];
    console.log(`渲染了 ${localElements.length} 个默认背景时间点元素`);
} 