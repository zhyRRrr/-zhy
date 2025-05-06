import * as echarts from 'echarts'
import { radians, getColorByStage } from './utils'
import { showTooltip, hideTooltip } from './tooltip'

// 渲染连接线
export const renderConnectingLines = (zr, elements, center, baseRadius, stages, isAllPoets = false, selectedPoets = null) => {
    // 调试信息：输出各生命阶段信息
    console.log('渲染连接线前的生命阶段数据:', stages.map(stage => ({
        name: stage.name,
        value: stage.value,
        stage_key: stage.stage_key,
        poetName: stage.poetName // 添加诗人名称以供调试
    })));

    // 需要将点按照角度排序，确保连线顺序正确
    const sortedStages = [...stages]
        // 严格按照后端数据：只显示诗词量大于0的生命阶段
        .filter((stage) => stage.value > 0)
        .sort((a, b) => a.angle - b.angle)

    // 对角度排序后的点创建平滑的多边形路径
    const sortedPoints = sortedStages.map((stage) => [stage.x, stage.y])

    // 如果没有有效的生命阶段点，则返回而不渲染
    if (sortedPoints.length === 0) {
        console.log('没有符合条件的生命阶段点，跳过渲染连接线');
        return;
    }

    // 如果是多选模式，为每个诗人分配一个唯一颜色 (与 timePoints.js 和 lifeSpans.js 保持一致)
    let poetColorMap = new Map();
    let lineColor = '#8b5cf6'; // 默认紫色 (用于单选或全部诗人模式)
    let currentPoetName = null; // 用于存储当前曲线对应的诗人名称

    if (selectedPoets && selectedPoets.length > 0) {
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
        console.log('多选模式连接线：已生成诗人颜色映射', poetColorMap);

        // 尝试从传入的 stages 数据中获取诗人名称 (查找第一个有效的 poetName)
        const stageWithPoetName = stages.find(stage => stage && stage.poetName);
        if (stageWithPoetName) {
            currentPoetName = stageWithPoetName.poetName;
            const poetColor = poetColorMap.get(currentPoetName);

            if (poetColor) {
                lineColor = poetColor;
                console.log(`诗词曲线：使用诗人 ${currentPoetName} 的专属颜色: ${lineColor}`);
            } else {
                console.warn(`诗词曲线：未找到诗人 ${currentPoetName} 的颜色，使用默认紫色`);
                lineColor = '#8b5cf6'; // Fallback color
            }
        } else {
            console.warn('诗词曲线：无法从stages数据中确定诗人名称，使用默认紫色');
            lineColor = '#8b5cf6'; // Fallback color
        }
    }

    // 根据是否为全部诗人或选中诗人模式选择样式
    let lineWidth;
    let opacity;
    let displayMode;

    if (selectedPoets && selectedPoets.length > 0) {
        // 多选模式: 使用上面确定的诗人专属颜色 lineColor
        lineWidth = 3.5;        // 粗线条
        opacity = 0.95;         // 高透明度
        displayMode = `选中的诗人 ${currentPoetName || '未知'}`;
    } else if (isAllPoets) {
        // 全部诗人模式 - 使用默认紫色
        lineColor = '#8b5cf6';  // 强制使用紫色
        lineWidth = 3;          // 粗线条
        opacity = 0.9;          // 高透明度
        displayMode = "全部诗人";
    } else {
        // 单个诗人模式 - 使用默认紫色但线条较细
        lineColor = '#8b5cf6';  // 强制使用紫色
        lineWidth = 2.5;        // 细线条
        opacity = 0.85;         // 一般透明度
        displayMode = "单个诗人";
    }

    console.log(`渲染连接线 - 模式: ${displayMode}, 显示 ${sortedStages.length} 个数据点, 使用颜色: ${lineColor}`);

    // 创建曲线对象
    const curve = new echarts.graphic.Polyline({
        shape: {
            points: sortedPoints,
            smooth: 0.3
        },
        style: {
            stroke: lineColor,
            lineWidth: lineWidth,
            opacity: opacity
        },
        zlevel: 11,
        // 如果有poetName，保存它以便其他组件可以访问
        poetName: stages.length > 0 && stages[0].poetName ? stages[0].poetName : null
    })

    // 添加曲线到图表
    zr.add(curve)
    elements.push(curve)

    // 添加从圆形边界到数据点的连接线和点
    sortedStages.forEach((stage) => {
        const angle = stage.angle
        const radianValue = radians(angle)
        const edgeX = center[0] + baseRadius * Math.cos(radianValue)
        const edgeY = center[1] + baseRadius * Math.sin(radianValue)

        // 根据显示模式设置不同的线条样式
        const stageColor = getColorByStage(stage.stage_key)
        let dashPattern;
        let connLineWidth;

        if (selectedPoets && selectedPoets.length > 0) {
            // 选中诗人模式 - 使用较宽的虚线
            dashPattern = [5, 2];
            connLineWidth = 2.2;
        } else if (isAllPoets) {
            // 全部诗人模式 - 使用宽虚线
            dashPattern = [5, 3];
            connLineWidth = 2;
        } else {
            // 单个诗人模式 - 使用细虚线
            dashPattern = [3, 3];
            connLineWidth = 1.8;
        }

        // 连接线的颜色: 多选模式下使用诗人颜色，否则使用生命阶段颜色
        let connLineColor;
        if (selectedPoets && selectedPoets.length > 0 && currentPoetName) {
            // 直接使用在函数开头获取的 currentPoetName 查找颜色
            const poetColor = poetColorMap.get(currentPoetName);
            if (poetColor) {
                connLineColor = poetColor; // 使用诗人专属颜色
            } else {
                // 如果 poetColorMap 中没有找到（理论上不应该），则回退
                console.warn(`连接线：未找到诗人 ${currentPoetName} 的颜色，回退到生命阶段颜色`);
                connLineColor = getColorByStage(stage.stage_key); // Fallback to stage color
            }
        } else {
            connLineColor = getColorByStage(stage.stage_key); // 非多选模式使用生命阶段颜色
        }

        // 创建从边界到点的连接线
        const line = new echarts.graphic.Line({
            shape: {
                x1: edgeX,
                y1: edgeY,
                x2: stage.x,
                y2: stage.y
            },
            style: {
                stroke: connLineColor, // 应用计算出的颜色
                lineWidth: connLineWidth,
                lineDash: dashPattern,
                opacity: 0.75
            },
            zlevel: 11
        })

        zr.add(line)
        elements.push(line)

        // 在非多选模式下 (单个诗人或全部诗人模式) 显示点和标签
        // 修改条件：仅在非多选模式下显示标签
        if (isAllPoets || !selectedPoets?.length) {
            // 计算点的大小 - 根据诗词量动态计算
            const pointSize = calculatePointSize(stage.value, false, isAllPoets); // 明确非多选

            // 选择点的颜色
            let pointFillColor = stageColor;
            let pointStrokeColor = '#fff';

            // 如果是全部诗人模式，点可以保持统一风格
            if (isAllPoets) {
                // 可以选择性地为全部诗人模式设置不同样式
            }
            // 单个诗人模式下，边框使用默认白色

            // 添加末端点，大小根据诗词量而定
            const endPoint = new echarts.graphic.Circle({
                shape: {
                    cx: stage.x,
                    cy: stage.y,
                    r: pointSize
                },
                style: {
                    fill: pointFillColor,
                    stroke: pointStrokeColor,
                    lineWidth: 2,
                    shadowBlur: 5,
                    shadowColor: 'rgba(0,0,0,0.3)'
                },
                zlevel: 12,
                poetName: stages.length > 0 && stages[0].poetName ? stages[0].poetName : null,
                stageKey: stage.stage_key
            });

            // 创建悬停区域 - 比实际点大，便于交互
            const hoverArea = new echarts.graphic.Circle({
                shape: {
                    cx: stage.x,
                    cy: stage.y,
                    r: pointSize + 5
                },
                style: {
                    fill: 'transparent',
                    cursor: 'pointer'
                },
                zlevel: 13
            });

            // 添加悬浮事件
            hoverArea.on('mouseover', function () {
                // 高亮显示点
                endPoint.attr({
                    style: {
                        shadowBlur: 10,
                        opacity: 1
                    },
                    shape: {
                        r: pointSize + 2
                    }
                });

                // 显示提示信息
                const displayModeText = selectedPoets && selectedPoets.length > 0
                    ? `<div style="font-size:12px;margin-top:5px;opacity:0.8">(已选${selectedPoets.length}位诗人统计)</div>`
                    : isAllPoets
                        ? '<div style="font-size:12px;margin-top:5px;opacity:0.8">(全部诗人统计)</div>'
                        : '';

                const tooltipContent = `<div style="font-weight:bold;font-size:14px;margin-bottom:5px">${stage.name}</div><div>诗词总量: ${stage.value}首</div>${displayModeText}`;

                showTooltip(tooltipContent, stage.x, stage.y);
            });

            hoverArea.on('mouseout', function () {
                // 恢复原样式
                endPoint.attr({
                    style: {
                        shadowBlur: 5,
                        opacity: 0.9
                    },
                    shape: {
                        r: pointSize
                    }
                });

                // 隐藏提示
                hideTooltip();
            });

            zr.add(endPoint);
            zr.add(hoverArea);
            elements.push(endPoint);
            elements.push(hoverArea);

            // === START: Condition to hide labels in single-select mode ===
            // 只有在"全部诗人"模式或多选模式下才显示阶段标签
            if (isAllPoets || (selectedPoets && selectedPoets.length > 0)) {
                // 在连接线中间位置添加阶段名称标签
                const midX = (edgeX + stage.x) / 2
                const midY = (edgeY + stage.y) / 2

                // 只显示阶段名称，将诗词量数据放到悬浮提示中
                const labelText = stage.name

                // 根据不同生命阶段调整标签位置
                let labelX = midX;
                let labelY = midY;

                // 调整不同阶段标签的位置
                if (stage.stage_key === 'stage_child') {
                    // 少年期保持原位置（中间点）
                } else if (stage.stage_key === 'stage_youth' ||
                    stage.stage_key === 'stage_prime' ||
                    stage.stage_key === 'stage_middle') {
                    // 青年期、壮年期、中年期显示在点的后面
                    // 计算从圆心到点的方向向量，并稍微延长
                    const dx = stage.x - center[0];
                    const dy = stage.y - center[1];
                    const length = Math.sqrt(dx * dx + dy * dy);
                    // 将标签位置设置在点的外侧
                    labelX = stage.x + (dx / length) * 30; // 向外延伸30像素
                    labelY = stage.y + (dy / length) * 30;
                } else if (stage.stage_key === 'stage_elder') {
                    // 晚年期显示在点的右侧
                    labelX = stage.x + 15; // 向右偏移15像素
                    labelY = stage.y + 5; // 稍微向下偏移一点
                }

                const stageLabel = new echarts.graphic.Text({
                    style: {
                        text: labelText,
                        font: 'bold 12px Microsoft YaHei',
                        textFill: '#333', // 统一使用深灰色，更清晰
                        textAlign: 'center',
                        textVerticalAlign: 'middle',
                        textBorderColor: '#fff',
                        textBorderWidth: 2
                    },
                    position: [labelX, labelY],
                    zlevel: 12,
                    // 添加标识，以便清除时能够识别
                    stageTextLabel: true,
                    stageKey: stage.stage_key,
                    stageName: stage.name,
                    isAllPoets: isAllPoets // 保留此标识，可能用于其他逻辑
                })

                zr.add(stageLabel)
                elements.push(stageLabel)
            }
            // === END: Condition to hide labels in single-select mode ===
        }
    })
}

// 计算点的大小 - 根据诗词量和显示模式
function calculatePointSize(value, isSelectedPoets = false, isAllPoets = false) {
    // 基础系数和大小
    let baseSize;
    let scaleFactor;

    if (isSelectedPoets) {
        // 选中诗人模式
        baseSize = 4;
        scaleFactor = 0.12; // 减小系数
    } else if (isAllPoets) {
        // 全部诗人模式 - 减小点大小
        baseSize = 2.5;
        scaleFactor = 0.03; // 继续减小系数
    } else {
        // 单个诗人模式
        baseSize = 2.5;
        scaleFactor = 0.08; // 减小系数
    }

    // 直接线性计算，诗词量越大点越大，完全成正比
    return baseSize + value * scaleFactor;
}

