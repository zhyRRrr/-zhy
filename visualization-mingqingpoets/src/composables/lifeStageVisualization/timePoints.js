import * as echarts from 'echarts'
import { radians } from './utils'
import { showTooltip, hideTooltip } from './tooltip'

// 渲染基础时间点和诗词量曲线（单选模式下）
export const renderTimePoints = (zr, elements, center, baseRadius, timelineData, isMultiSelect = false, selectedPoets = []) => {
    // 首先添加时间区域填充背景色 (可能需要根据新逻辑调整或移除)
    // renderTimeRangeBackground(zr, elements, center, baseRadius, isMultiSelect ? selectedPoets : null);

    // 判断是否为多选模式，如果是则调用多选模式的时间点渲染函数
    if (isMultiSelect && selectedPoets && selectedPoets.length > 0) {
        // 调用多选模式下的时间点渲染函数
        renderTimePointsForMultiSelect(zr, elements, center, baseRadius, timelineData, selectedPoets);
        return;
    }

    // --- 单选模式（所有诗人） --- 
    // 从 timelineData 获取聚合后的诗词量数据
    const allYearCounts = timelineData.allYearCounts; // 假设是 Map 或 Object { year: count }
    const minYear = timelineData.minYear;
    const maxYear = timelineData.maxYear;

    // 检查数据有效性
    if (!allYearCounts || minYear === null || maxYear === null || minYear >= maxYear) {
        console.warn('单选模式缺少有效的 allYearCounts, minYear, 或 maxYear 数据，无法渲染诗词量曲线。');
        // 可以选择渲染默认点或直接返回
        renderDefaultTimePoints(zr, elements, center, baseRadius);
        return;
    }

    console.log(`单选模式: 渲染诗词量曲线，范围 ${minYear}-${maxYear}`);

    // --- 计算常量和年份范围 --- 
    const heightFactor = 1; // 诗词量 count * 1 = 高度 (修改)
    const baseCurveHeight = 40; // 添加基础曲线高度
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

    // --- 循环计算点位并渲染标记 --- 
    const curvePoints = []; // 存储曲线的点 [x, y]

    for (let year = minYear; year <= maxYear; year++) {
        const currentIndex = year - minYear;
        // 使用新的角度参数计算当前年份的角度
        const currentAngle = newStartAngleUnrotated + currentIndex * newAngleIncrement + rotationOffsetDegrees;
        const rad = radians(currentAngle);

        // 计算 *标记点* 的基础位置（在增加后的半径上）
        const baseX = center[0] + markerBaseRadius * Math.cos(rad);
        const baseY = center[1] + markerBaseRadius * Math.sin(rad);

        // 获取该年的诗词量
        let count = 0;
        if (allYearCounts instanceof Map) {
            count = allYearCounts.get(year) || 0;
        } else if (typeof allYearCounts === 'object' && allYearCounts !== null) {
            count = allYearCounts[year] || 0;
        }

        // 计算 *曲线点* 高度和位置 (基于原始 baseRadius)
        const height = baseCurveHeight + (count * heightFactor);
        const curveRadius = baseRadius + height; // <-- 仍然使用原始 baseRadius
        const curveX = center[0] + curveRadius * Math.cos(rad);
        const curveY = center[1] + curveRadius * Math.sin(rad);
        curvePoints.push([curveX, curveY]);

        // --- 渲染基础年份标记 (在 markerBaseRadius 上) ---
        const isStartPoint = year === minYear;
        const isEndPoint = year === maxYear;

        let marker = null;
        let markerColor = '#aaaaaa'; // 默认中间点颜色
        let markerSize = 5; // Default size (used for triangle)

        // 渲染起点标记 (三角形)
        if (isStartPoint) {
            markerColor = '#007acc';
            markerSize = 8; // Triangle size
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
                    lineWidth: 1
                },
                zlevel: 6
            });
        }
        // 渲染终点标记 (正方形)
        else if (isEndPoint) {
            markerColor = '#e05d44';
            markerSize = 10; // Square size (width/height)
            marker = new echarts.graphic.Rect({
                shape: {
                    x: baseX - markerSize / 2, // Calculate top-left x
                    y: baseY - markerSize / 2, // Calculate top-left y
                    width: markerSize,
                    height: markerSize
                },
                style: {
                    fill: markerColor,
                    stroke: '#ffffff',
                    lineWidth: 1
                },
                zlevel: 6
            });
        }
        // 渲染中间点标记 (小圆点)
        else {
            markerColor = '#aaaaaa'; // Ensure color is set for intermediate points
            marker = new echarts.graphic.Circle({
                shape: {
                    cx: baseX,
                    cy: baseY,
                    r: 1.5 // Intermediate point size
                },
                style: {
                    fill: markerColor,
                    opacity: 0.7
                },
                zlevel: 6 // 在曲线上方
            });
        }

        // 添加起点/终点/中间点 标签 (根据 isStartPoint/isEndPoint)
        if (isStartPoint || isEndPoint) {
            // 添加起点/终点标签 
            const labelDistance = markerBaseRadius + 15;
            const labelAngle = currentAngle - 1;
            const labelRad = radians(labelAngle);
            const labelX = center[0] + labelDistance * Math.cos(labelRad);
            const labelY = center[1] + labelDistance * Math.sin(labelRad);
            const yearLabel = new echarts.graphic.Text({
                style: {
                    text: `${year}${isStartPoint ? ' 始' : ' 终'}`, // Label text based on condition
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    fontSize: 10,
                    fontWeight: 'bold',
                    fill: markerColor, // Use the determined marker color
                },
                x: labelX,
                y: labelY,
                zlevel: 7
            });
            zr.add(yearLabel);
            elements.push(yearLabel);
        } else if (year % 20 === 0) { // Intermediate labels
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
                    fontSize: 9,
                    fill: '#666666',
                },
                x: labelX,
                y: labelY,
                zlevel: 7
            });
            zr.add(yearLabel);
            elements.push(yearLabel);
        }


        // 为所有标记添加 Tooltip
        if (marker) {
            marker.on('mouseover', function () {
                const currentCount = count;
                let tooltipText = `${year}年`;
                if (isStartPoint) tooltipText += ' (始)';
                if (isEndPoint) tooltipText += ' (终)';
                tooltipText += `\n诗词总量: ${currentCount}`;

                // 标记高亮 - 仅改变颜色和透明度 
                this.attr({
                    style: {
                        fill: isStartPoint ? '#1e90ff' : (isEndPoint ? '#ff6347' : '#ff4500'),
                        opacity: 1,
                    },
                });

                showTooltip(tooltipText, baseX, baseY);
            });

            marker.on('mouseout', function () {
                // 恢复标记样式
                this.attr({
                    style: {
                        fill: markerColor, // 恢复原始颜色
                        opacity: isStartPoint || isEndPoint ? 1 : 0.7
                    },
                });
                hideTooltip();
            });

            zr.add(marker);
            elements.push(marker);
        }
    }

    // --- 创建填充区域的多边形 ---
    if (curvePoints.length > 1) {
        // 1. 计算时间点标记圆圈上的点
        const baseMarkerPoints = [];
        for (let year = minYear; year <= maxYear; year++) {
            const currentIndex = year - minYear;
            const currentAngle = newStartAngleUnrotated + currentIndex * newAngleIncrement + rotationOffsetDegrees;
            const rad = radians(currentAngle);
            const x = center[0] + markerBaseRadius * Math.cos(rad);
            const y = center[1] + markerBaseRadius * Math.sin(rad);
            baseMarkerPoints.push([x, y]);
        }

        // 2. 合并点：曲线点 + 反向的基础标记点
        const fillPolygonPoints = [...curvePoints, ...baseMarkerPoints.reverse()];

        // 3. 创建并添加填充多边形
        const fillPolygon = new echarts.graphic.Polygon({
            shape: {
                points: fillPolygonPoints
            },
            style: {
                fill: 'rgba(59, 130, 246, 0.1)', // 半透明填充区域
                stroke: 'none' // 填充区域无边框
            },
            zlevel: 4 // 在曲线和标记下方
        });
        zr.add(fillPolygon);
        elements.push(fillPolygon);
    }

    // --- 绘制平滑曲线 (线条本身) ---
    if (curvePoints.length > 1) {
        // const volumeCurve = new echarts.graphic.Polyline({
        //     shape: {
        //         points: curvePoints,
        //         smooth: 0.4 // 调整平滑度 (0 到 1)
        //     },
        //     style: {
        //         stroke: '#3B82F6', // 曲线颜色 (蓝色)
        //         lineWidth: 1.5,
        //         // fill: 'rgba(59, 130, 246, 0.1)', // 移除线条的填充
        //         opacity: 0.8
        //     },
        //     zlevel: 5 // 在标记下方，但在填充区域上方
        // });
        // zr.add(volumeCurve);
        // elements.push(volumeCurve);
    } else if (curvePoints.length === 1) {
        // 如果只有一个点，可以画一个小圆点表示
        const singlePointMarker = new echarts.graphic.Circle({
            shape: { cx: curvePoints[0][0], cy: curvePoints[0][1], r: 2 },
            style: { fill: '#3B82F6' },
            zlevel: 5
        });
        zr.add(singlePointMarker);
        elements.push(singlePointMarker);
    }
};

// 多选模式下渲染时间点 - 不使用API，直接使用生命线数据
export const renderTimePointsForMultiSelect = (zr, elements, center, baseRadius, timelineData, selectedPoets) => {
    console.log('多选模式：为选中的诗人渲染时间点', selectedPoets);

    // 从timelineData.poetLifeSpans中获取选中诗人的数据
    const poetLifeSpans = timelineData.poetLifeSpans || [];

    // 过滤出选中的诗人
    const selectedPoetLifeSpans = poetLifeSpans.filter(poet => {
        return selectedPoets.some(selectedPoet =>
            selectedPoet.name === poet.name ||
            (selectedPoet.name === '仲振宣' && poet.name === '仲振宣')
        );
    });

    console.log(`找到 ${selectedPoetLifeSpans.length} 位选中诗人的生命线数据:`,
        selectedPoetLifeSpans.map(p => `${p.name}(${p.birthYear}-${p.deathYear})`));

    if (selectedPoetLifeSpans.length === 0) {
        console.log('未找到选中诗人的生命线数据，使用默认时间点渲染');
        renderDefaultTimePoints(zr, elements, center, baseRadius);
        return;
    }

    // 为每个诗人分配一个唯一颜色 - 使用与lifeSpans.js相同的颜色映射
    const poetColorMap = new Map();
    const poetColors = [
        '#8B5CF6', // 紫色
        '#EC4899', // 粉色
        '#3B82F6', // 蓝色
        '#10B981', // 绿色
        '#F59E0B', // 黄色
        '#EF4444', // 红色
        '#6366F1', // 靛蓝
        '#14B8A6', // 青绿
        '#F97316', // 橙色
        '#8B5CF6'  // 再次使用紫色
    ];

    selectedPoets.forEach((poet, index) => {
        poetColorMap.set(poet.name, poetColors[index % poetColors.length]);
    });

    // 为每个年份记录对应的诗人
    const yearPoetMap = new Map();

    // 收集所有年份并进行去重
    let allYearsSet = new Set();
    let yearsWithPoetInfo = new Map(); // 保存年份与诗人的对应关系

    // 为每个诗人生成所有年份
    selectedPoetLifeSpans.forEach(poet => {
        if (!poet.birthYear || !poet.deathYear || poet.deathYear <= poet.birthYear) {
            console.log(`诗人 ${poet.name} 生卒年数据无效: ${poet.birthYear}-${poet.deathYear}`);
            return;
        }

        // 生成该诗人的所有年份
        for (let year = poet.birthYear; year <= poet.deathYear; year++) {
            allYearsSet.add(year);

            // 记录该年份对应的诗人信息
            const existingInfo = yearsWithPoetInfo.get(year) || { poets: [], count: 0 };
            existingInfo.poets.push(poet.name);
            existingInfo.count += 1; // 简单计数
            yearsWithPoetInfo.set(year, existingInfo);

            // 在年份诗人映射中记录
            if (!yearPoetMap.has(year)) {
                yearPoetMap.set(year, []);
            }
            yearPoetMap.get(year).push(poet.name);
        }
    });

    // 将年份集合转换为数组并排序
    const allYears = Array.from(allYearsSet).sort((a, b) => a - b);

    // 找出整体的起始和结束年份
    const earliestYear = allYears[0];
    const latestYear = allYears[allYears.length - 1];

    console.log(`选中诗人的时间范围: ${earliestYear} - ${latestYear}, 共${allYears.length}个年份`);

    // 在圆形边界上均匀分布时间点
    allYears.forEach((year, index) => {
        // 计算角度 - 均匀分布
        const angle = (index / allYears.length) * 360;
        const rad = radians(angle);

        // 计算点的位置
        const x = center[0] + baseRadius * Math.cos(rad);
        const y = center[1] + baseRadius * Math.sin(rad);

        // 获取该年份的诗人信息
        const yearInfo = yearsWithPoetInfo.get(year) || { poets: [], count: 0 };

        // 获取该年份的诗人列表
        const poetsForThisYear = yearPoetMap.get(year) || [];

        // 检查这个年份是否是某个诗人的出生年或死亡年
        const poetWithBirthYear = selectedPoetLifeSpans.find(poet => poet.birthYear === year);
        const poetWithDeathYear = selectedPoetLifeSpans.find(poet => poet.deathYear === year);

        // 计算点的大小，基于该年份关联的诗人数量
        const pointSize = 2 + Math.min(3, yearInfo.count * 0.5);

        // 判断是否为整体起点或终点
        const isStartPoint = year === earliestYear;
        const isEndPoint = year === latestYear;

        // 判断是否为中间关键点（10年间隔或诗人生死年份）
        const isKeyPoint = year % 10 === 0 || poetWithBirthYear || poetWithDeathYear;

        // 确定点的颜色 - 多个诗人共享的年份使用混合颜色
        let pointColor;
        let pointOpacity = 0.8;
        let pointStroke = '#ffffff';
        let pointSize2 = pointSize;

        // 为起点、终点和关键点设置不同的颜色
        if (isStartPoint) {
            pointColor = '#007acc'; // 起点使用蓝色
            pointOpacity = 1;
            pointStroke = '#ffffff';
            pointSize2 = pointSize * 1.5; // 起点稍大一些
        } else if (isEndPoint) {
            pointColor = '#e05d44'; // 终点使用红色
            pointOpacity = 1;
            pointStroke = '#ffffff';
            pointSize2 = pointSize * 1.5; // 终点稍大一些
        } else if (isKeyPoint) {
            // 如果是诗人的出生年或死亡年，使用该诗人的颜色
            if (poetWithBirthYear) {
                pointColor = poetColorMap.get(poetWithBirthYear.name) || '#5d44e0';
            } else if (poetWithDeathYear) {
                pointColor = poetColorMap.get(poetWithDeathYear.name) || '#5d44e0';
            } else {
                pointColor = '#5d44e0'; // 其他关键点使用紫色
            }
            pointOpacity = 0.9;
            pointStroke = '#ffffff';
            pointSize2 = pointSize * 1.2; // 关键点稍大一些
        } else {
            // 普通年份 - 如果只有一个诗人，使用该诗人的颜色
            if (poetsForThisYear.length === 1) {
                pointColor = poetColorMap.get(poetsForThisYear[0]) || '#333333';
            } else {
                // 多个诗人共享的年份使用深灰色
                pointColor = '#333333';
            }
        }

        // 创建时间点标记
        const timePoint = new echarts.graphic.Circle({
            shape: {
                cx: x,
                cy: y,
                r: pointSize2
            },
            style: {
                fill: pointColor,
                opacity: pointOpacity,
                stroke: pointStroke,
                lineWidth: 1
            },
            zlevel: 6, // 确保在圆形边框上层
            year: year, // 存储年份信息
            poets: poetsForThisYear // 存储该年份对应的诗人
        });

        // 为时间点添加悬停事件
        timePoint.on('mouseover', function () {
            this.attr({
                style: {
                    fill: isStartPoint ? '#1e90ff' : (isEndPoint ? '#ff6347' : '#7a6bf5'), // 悬停时颜色稍亮
                    opacity: 1,
                    r: pointSize2 * 1.2 // 稍微放大
                }
            });

            // 构建悬浮窗文本
            let tooltipText = `${year}年\n`;

            // 添加诗人信息
            if (yearInfo.poets.length > 0) {
                tooltipText += `关联诗人: ${yearInfo.poets.join(', ')}\n`;
            }

            // 添加起点/终点标记
            if (isStartPoint) {
                tooltipText += `【整体起点】\n`;
            }
            if (isEndPoint) {
                tooltipText += `【整体终点】\n`;
            }

            // 添加是否为某诗人出生/死亡年份的信息
            if (poetWithBirthYear) {
                tooltipText += `${poetWithBirthYear.name} 出生年\n`;
            }
            if (poetWithDeathYear) {
                tooltipText += `${poetWithDeathYear.name} 死亡年\n`;
            }

            showTooltip(tooltipText, x, y);
        });

        timePoint.on('mouseout', function () {
            this.attr({
                style: {
                    fill: pointColor, // 恢复原始颜色
                    opacity: pointOpacity,
                    r: pointSize2 // 恢复原始大小
                }
            });

            hideTooltip();
        });

        zr.add(timePoint);
        elements.push(timePoint);

        // 为起点、终点和关键时间点添加标签
        if (isStartPoint || isEndPoint || (isKeyPoint && year % 20 === 0)) {
            const labelRad = radians(angle - 3); // 稍微偏移以免遮挡点
            const labelDistance = baseRadius + 15; // 标签放在时间点外侧
            const labelX = center[0] + labelDistance * Math.cos(labelRad);
            const labelY = center[1] + labelDistance * Math.sin(labelRad);

            let labelText = `${year}`;
            if (isStartPoint) labelText += ' 始';
            if (isEndPoint) labelText += ' 终';

            // 确定标签颜色
            let labelColor;
            if (isStartPoint) {
                labelColor = '#007acc';
            } else if (isEndPoint) {
                labelColor = '#e05d44';
            } else if (poetWithBirthYear) {
                labelColor = poetColorMap.get(poetWithBirthYear.name) || '#5d44e0';
            } else if (poetWithDeathYear) {
                labelColor = poetColorMap.get(poetWithDeathYear.name) || '#5d44e0';
            } else {
                labelColor = '#5d44e0';
            }

            const yearLabel = new echarts.graphic.Text({
                style: {
                    text: labelText,
                    textAlign: 'center',
                    textVerticalAlign: 'middle',
                    fontSize: 10,
                    fontWeight: isStartPoint || isEndPoint ? 'bold' : 'normal',
                    fill: labelColor,
                },
                x: labelX,
                y: labelY,
                zlevel: 7
            });

            zr.add(yearLabel);
            elements.push(yearLabel);
        }
    });
}

// 渲染默认时间点（当无法获取数据时使用）
function renderDefaultTimePoints(zr, elements, center, baseRadius) {
    // 创建24个静态时间点
    const pointCount = 24; // 24个点，每15度一个

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
                r: 2.5 // 统一大小
            },
            style: {
                fill: '#333333', // 深灰色
                opacity: 0.7,
                stroke: '#ffffff',
                lineWidth: 1
            },
            zlevel: 6
        });

        zr.add(timePoint);
        elements.push(timePoint);
    }
}


// 在中间曲线上渲染诗人生命阶段对应的时间点
export const renderTimePointsOnCurve = (/* zr, elements, center, baseRadius, poetLifeStage */) => {
    // 不再渲染任何点
    console.log('已禁用曲线上的时间点渲染');
    return;
}

// 在中间曲线上渲染时间线数据点
export const renderTimelineDataPoints = (/* zr, elements, center, baseRadius, timelineData, poetId */) => {
    // 不再渲染任何点
    console.log('已禁用中间曲线上的时间线数据点渲染');
    return;
};

// 以下函数不再使用，移除它们 