import * as echarts from 'echarts'
import { getColorByStage } from './utils'
import { showTooltip, hideTooltip } from './tooltip'
import { radians } from './utils'

// 渲染生命阶段点
export const renderLifeStagePoints = (zr, elements, center, baseRadius, radiusOffset, stages, poetLifeStage, activeStage) => {
    // 先过滤掉诗词量为0的阶段，只处理有诗词的阶段
    const activeStages = stages.filter(s => s.value > 0);

    // 如果没有任何有效阶段，退出函数
    if (activeStages.length === 0) {
        console.log(`诗人${poetLifeStage.poetName}没有任何诗词量大于0的生命阶段，跳过渲染`);
        return;
    }

    // 获取所有阶段中的最大值和最小值，用于计算点的大小和位置偏移
    const maxValue = Math.max(...activeStages.map((s) => s.value))
    const minValue = Math.min(...activeStages.map((s) => s.value))
    const totalPoems = poetLifeStage.totalPoems || 0

    // 计算平均每阶段诗词数量和标准差 - 用于调整分布形状
    const avgPoemsPerStage = activeStages.reduce((sum, s) => sum + s.value, 0) / activeStages.length
    const variance =
        activeStages.reduce((sum, s) => sum + Math.pow(s.value - avgPoemsPerStage, 2), 0) /
        activeStages.length
    const stdDev = Math.sqrt(variance)

    // 根据诗词分布的方差计算分布形状系数
    // 方差越大，说明分布越不均匀，越需要强调这种不均匀性
    const shapeDistortionFactor = Math.min(
        1.5,
        Math.max(1.0, 1 + (stdDev / avgPoemsPerStage) * 0.3)
    )

    console.log(`诗人：${poetLifeStage.poetName}`)
    console.log(`最大诗词数：${maxValue}，最小诗词数：${minValue}，总诗词数：${totalPoems}`)
    console.log(`平均每阶段诗词数：${avgPoemsPerStage.toFixed(2)}，标准差：${stdDev.toFixed(2)}`)
    console.log(`分布形状系数：${shapeDistortionFactor.toFixed(2)}`)
    console.log(`有效生命阶段数量: ${activeStages.length}，阶段名称: ${activeStages.map(s => s.name).join(', ')}`)

    // 定义粉色生命线的半径范围 - 确保与lifeStageLines.js中定义一致
    const outerLineRadius = baseRadius + 40; // 灰色外圈半径
    const innerLineRadius = baseRadius + 37; // 内层粉色生命线半径，与lifeStageLines.js保持一致

    // 寻找诗人的生命线角度范围
    let poetLifeSpanAngles = findPoetLifeSpanAngles(poetLifeStage);

    // 如果找不到角度范围，尝试从年份估计
    if (!poetLifeSpanAngles && poetLifeStage.startYear && poetLifeStage.endYear) {
        console.log(`尝试从年份估计生命线角度范围: ${poetLifeStage.startYear}-${poetLifeStage.endYear}`);
        poetLifeSpanAngles = estimateAnglesFromYears(poetLifeStage.startYear, poetLifeStage.endYear);
    }

    // 如果依然找不到，则使用默认范围
    if (!poetLifeSpanAngles) {
        console.log("无法确定诗人生命线角度范围，使用默认范围");
        poetLifeSpanAngles = { startAngle: 0, endAngle: 360 };
    }

    console.log(`诗人生命线角度范围: ${poetLifeSpanAngles.startAngle.toFixed(2)} - ${poetLifeSpanAngles.endAngle.toFixed(2)}`);

    // 提取起止角度
    const startAngle = poetLifeSpanAngles.startAngle;
    const endAngle = poetLifeSpanAngles.endAngle;

    // 生命阶段标准固定角度 - 确保与生命线渲染一致
    const standardStageAngles = {
        'stage_child': 0,    // 右侧 - 少年期
        'stage_youth': 72,   // 右下 - 青年期
        'stage_prime': 144,  // 左下 - 壮年期
        'stage_middle': 216, // 左侧 - 中年期
        'stage_elder': 288   // 左上 - 晚年期
    };

    // 根据生命线角度范围计算各生命阶段的角度位置
    let stageAngleMap = {};

    // 判断是否为统计数据（全部诗人或多选诗人）
    const isStatisticsData = poetLifeStage.poetName.includes('全部诗人') ||
        poetLifeStage.poetName.includes('选中的') ||
        poetLifeStage.poetName === '统计数据';

    // 标准角度分布的辅助函数
    function useStandardAngles() {
        Object.keys(standardStageAngles).forEach(key => {
            stageAngleMap[key] = {
                mid: standardStageAngles[key],
                start: standardStageAngles[key] - 36, // 假设每个阶段跨度为72度
                end: standardStageAngles[key] + 36
            };
        });
    }

    // 判断是否为多选模式的改进方法
    const isMultiSelectMode =
        // 检查poetLifeStage中的标识
        (poetLifeStage.isMultiSelect === true) ||
        // 检查poetName是否包含"选中的"字样
        (poetLifeStage.poetName && poetLifeStage.poetName.includes('选中的')) ||
        // 检查是否有angleRange参数
        (poetLifeStage.angleRange !== undefined) ||
        // 检查selectedPoets属性
        (poetLifeStage.selectedPoets && poetLifeStage.selectedPoets.length > 0);

    console.log(`诗人${poetLifeStage.poetName}是否为多选模式: ${isMultiSelectMode}`);

    // 在多选模式下创建颜色映射 (与 timePoints.js, lifeSpans.js, curves.js 保持一致)
    let poetColorMap = new Map();
    if (isMultiSelectMode && poetLifeStage.selectedPoets) {
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
        poetLifeStage.selectedPoets.forEach((poet, index) => {
            poetColorMap.set(poet.name, poetColors[index % poetColors.length]);
        });
        console.log('多选模式生命阶段点：已生成诗人颜色映射', poetColorMap);
    }

    if (isStatisticsData) {
        if (isMultiSelectMode) {
            console.log("多选模式：根据诗人生命年份计算各阶段角度");

            // 如果有传递angleRange参数，优先使用它
            if (poetLifeStage.angleRange) {
                console.log(`使用传递的角度范围: ${poetLifeStage.angleRange.startAngle} - ${poetLifeStage.angleRange.endAngle}`);

                // 根据传递的角度范围重新计算各生命阶段的角度
                calculateLifeStageAnglesFromRange(poetLifeStage, stageAngleMap);
            }
            // 如果有出生和死亡年份，根据年份计算角度
            else if (poetLifeStage.startYear && poetLifeStage.endYear) {
                console.log(`使用诗人生卒年计算角度: ${poetLifeStage.startYear} - ${poetLifeStage.endYear}`);

                // 调用calculateLifeStageAnglesFromYears函数，计算各生命阶段的角度
                calculateLifeStageAnglesFromYears(poetLifeStage, stageAngleMap);
            }
            else {
                console.warn("多选模式下缺少角度计算所需的数据，使用标准角度");
                useStandardAngles();
            }
        } else {
            // 非多选模式的统计数据使用标准角度
            console.log("统计模式：使用标准角度分布");
            useStandardAngles();
        }
    } else {
        // 添加更多调试信息
        console.log("原始生命线数据:", poetLifeStage);
        console.log("生命线角度范围(直接):", startAngle, endAngle);

        // 特别处理，强制计算生命线的精确起止角度
        // 这里我们需要确保获取到生命线的实际起止角度
        let actualStartAngle = startAngle;
        let actualEndAngle = endAngle;

        // 尝试从poetLifeStage中获取更准确的角度信息
        if (poetLifeStage.lifeLineAngles) {
            actualStartAngle = poetLifeStage.lifeLineAngles.startAngle;
            actualEndAngle = poetLifeStage.lifeLineAngles.endAngle;
            console.log("使用lifeLineAngles中的角度:", actualStartAngle, actualEndAngle);
        }

        // 确保角度正确，避免NaN和无效值
        if (isNaN(actualStartAngle) || isNaN(actualEndAngle) ||
            !isFinite(actualStartAngle) || !isFinite(actualEndAngle)) {
            console.error("角度计算错误，使用默认值");
            actualStartAngle = 0;
            actualEndAngle = 360;
        }

        console.log(`使用的实际角度范围: ${actualStartAngle.toFixed(2)} - ${actualEndAngle.toFixed(2)}`);

        // 计算角度范围
        const angleRange = actualEndAngle - actualStartAngle;

        // 获取存在诗词数据的阶段列表（按标准顺序）
        const standardStageOrder = ['stage_child', 'stage_youth', 'stage_prime', 'stage_middle', 'stage_elder'];
        const existingStages = activeStages
            .map(stage => stage.stage_key)
            .filter(key => standardStageOrder.includes(key));

        // 确保阶段按标准顺序排序
        existingStages.sort((a, b) => standardStageOrder.indexOf(a) - standardStageOrder.indexOf(b));

        console.log(`有诗词数据的生命阶段: ${existingStages.join(', ')}`);

        if (existingStages.length === 0) {
            console.warn("没有任何生命阶段存在诗词数据，使用默认角度分配");
            // 默认分配
            stageAngleMap['stage_child'] = { mid: actualStartAngle, start: actualStartAngle, end: actualStartAngle };
            stageAngleMap['stage_elder'] = { mid: actualEndAngle, start: actualEndAngle, end: actualEndAngle };
        } else {
            // 确定存在的第一个和最后一个阶段
            const firstExistingStage = existingStages[0];
            const lastExistingStage = existingStages[existingStages.length - 1];

            console.log(`第一个存在的阶段: ${firstExistingStage}, 最后一个存在的阶段: ${lastExistingStage}`);

            // 为所有阶段分配角度，但只有存在诗词的阶段才真正参与计算
            standardStageOrder.forEach(stageKey => {
                if (stageKey === firstExistingStage) {
                    // 第一个存在的阶段对齐到生命线起点
                    stageAngleMap[stageKey] = {
                        mid: actualStartAngle,
                        start: actualStartAngle,
                        end: actualStartAngle
                    };
                } else if (stageKey === lastExistingStage) {
                    // 最后一个存在的阶段对齐到生命线终点
                    stageAngleMap[stageKey] = {
                        mid: actualEndAngle,
                        start: actualEndAngle,
                        end: actualEndAngle
                    };
                } else if (existingStages.includes(stageKey)) {
                    // 如果是中间阶段，则先定义一个占位符（后面会重新计算）
                    stageAngleMap[stageKey] = {
                        mid: 0, // 临时值，后面会更新
                        start: 0,
                        end: 0
                    };
                } else {
                    // 不存在诗词数据的阶段，使用相邻阶段的平均值或边界值
                    // 先设置为null标记不存在，后面会根据情况处理
                    stageAngleMap[stageKey] = null;
                }
            });

            // 如果有多于两个的阶段，需要为中间阶段计算角度
            if (existingStages.length > 2) {
                // 计算中间阶段的角度步长
                const middleStagesCount = existingStages.length - 2; // 除去首尾两个阶段
                const angleStep = angleRange / (middleStagesCount + 1); // +1确保均匀分布

                // 获取中间阶段列表
                const middleStages = existingStages.slice(1, -1);
                console.log(`中间阶段: ${middleStages.join(', ')}, 角度步长: ${angleStep.toFixed(2)}`);

                // 为中间阶段分配角度
                middleStages.forEach((stageKey, index) => {
                    const stageAngle = actualStartAngle + angleStep * (index + 1);
                    stageAngleMap[stageKey].mid = stageAngle;
                    stageAngleMap[stageKey].start = stageAngle;
                    stageAngleMap[stageKey].end = stageAngle;
                    console.log(`${stageKey} 角度: ${stageAngle.toFixed(2)}`);
                });
            } else if (existingStages.length === 2) {
                // 只有两个阶段（首尾），不需要额外处理
                console.log("只有首尾两个阶段存在，不需要为中间阶段分配角度");
            } else {
                // 只有一个阶段存在
                console.log("只有一个阶段存在，将其角度设置为生命线中点");
                // 如果只有一个阶段，设置为生命线中点
                const onlyStage = existingStages[0];
                const midAngle = (actualStartAngle + actualEndAngle) / 2;
                stageAngleMap[onlyStage] = {
                    mid: midAngle,
                    start: midAngle,
                    end: midAngle
                };
            }

            // 填充不存在的阶段（为了完整性）
            for (const stageKey of standardStageOrder) {
                if (stageAngleMap[stageKey] === null) {
                    // 根据位置选择合适的默认角度
                    const stageIndex = standardStageOrder.indexOf(stageKey);
                    if (stageIndex < standardStageOrder.indexOf(firstExistingStage)) {
                        // 在第一个存在阶段之前的阶段，使用起始角度
                        stageAngleMap[stageKey] = {
                            mid: actualStartAngle,
                            start: actualStartAngle,
                            end: actualStartAngle
                        };
                    } else if (stageIndex > standardStageOrder.indexOf(lastExistingStage)) {
                        // 在最后一个存在阶段之后的阶段，使用结束角度
                        stageAngleMap[stageKey] = {
                            mid: actualEndAngle,
                            start: actualEndAngle,
                            end: actualEndAngle
                        };
                    } else {
                        // 在中间的空缺阶段，找到前后存在的阶段，使用它们的平均角度
                        let prevExistingStage = null;
                        let nextExistingStage = null;

                        // 向前查找最近的存在阶段
                        for (let i = stageIndex - 1; i >= 0; i--) {
                            if (existingStages.includes(standardStageOrder[i])) {
                                prevExistingStage = standardStageOrder[i];
                                break;
                            }
                        }

                        // 向后查找最近的存在阶段
                        for (let i = stageIndex + 1; i < standardStageOrder.length; i++) {
                            if (existingStages.includes(standardStageOrder[i])) {
                                nextExistingStage = standardStageOrder[i];
                                break;
                            }
                        }

                        // 计算平均角度
                        if (prevExistingStage && nextExistingStage) {
                            const prevAngle = stageAngleMap[prevExistingStage].mid;
                            const nextAngle = stageAngleMap[nextExistingStage].mid;
                            const avgAngle = (prevAngle + nextAngle) / 2;
                            stageAngleMap[stageKey] = {
                                mid: avgAngle,
                                start: avgAngle,
                                end: avgAngle
                            };
                        } else if (prevExistingStage) {
                            // 没有后续阶段，使用前一阶段角度
                            stageAngleMap[stageKey] = {
                                mid: stageAngleMap[prevExistingStage].mid,
                                start: stageAngleMap[prevExistingStage].mid,
                                end: stageAngleMap[prevExistingStage].mid
                            };
                        } else if (nextExistingStage) {
                            // 没有前置阶段，使用后一阶段角度
                            stageAngleMap[stageKey] = {
                                mid: stageAngleMap[nextExistingStage].mid,
                                start: stageAngleMap[nextExistingStage].mid,
                                end: stageAngleMap[nextExistingStage].mid
                            };
                        }
                    }
                }
            }
        }

        console.log("生命线精确匹配的角度分布:", stageAngleMap);
    }

    // 检查stageAngleMap中是否有NaN或无效值
    Object.entries(stageAngleMap).forEach(([key, angles]) => {
        if (isNaN(angles.mid) || !isFinite(angles.mid)) {
            console.error(`${key} 的角度值无效:`, angles);
            // 设置默认值避免后续计算错误
            stageAngleMap[key] = { mid: 0, start: 0, end: 0 };
        }
    });

    // 存储生命线上的点和诗词点的坐标，用于后续创建填充区域
    const lifeLinePoints = [];
    const poetryPoints = [];

    // 修改点的位置计算逻辑，使其位于粉色生命线上方，与生命阶段对应
    activeStages.forEach((stage) => {
        // 获取该生命阶段的角度信息
        const angleInfo = stageAngleMap[stage.stage_key];
        if (!angleInfo) {
            console.error(`未知的生命阶段: ${stage.stage_key}`);
            return; // 跳过这个阶段
        }

        // --- START: New Height Calculation Logic ---
        const poemsPerUnitHeight = 5; // 每 5 首诗增加 1 单位高度
        const maxOffset = 120; // 最大高度偏移量

        // 直接根据当前阶段的诗词量计算目标偏移量
        const targetOffset = stage.value / poemsPerUnitHeight;

        // 应用高度上限，并确保偏移量不为负
        const radiusOffset = Math.max(0, Math.min(targetOffset, maxOffset));

        console.log(`诗人 ${poetLifeStage.poetName} - ${stage.name}: 诗词量=${stage.value}, 计算偏移量=${radiusOffset.toFixed(2)} (目标=${targetOffset.toFixed(2)}, 上限=${maxOffset})`);
        // --- END: New Height Calculation Logic ---

        // 计算最终半径 - 从内层粉色生命线开始计算偏移
        const pointRadius = innerLineRadius + radiusOffset;

        // 使用阶段的中点角度 - 确保这个角度对应生命线上的正确位置
        const midAngle = angleInfo.mid;

        // 转换为弧度
        const rad = radians(midAngle);

        // 计算点的坐标
        const x = center[0] + pointRadius * Math.cos(rad);
        const y = center[1] + pointRadius * Math.sin(rad);

        // 更新stage对象中的坐标
        stage.x = x;
        stage.y = y;
        stage.angle = midAngle; // 保存角度用于连接线

        // 调试生命线上对应点的坐标
        const lifeLineX = center[0] + innerLineRadius * Math.cos(rad);
        const lifeLineY = center[1] + innerLineRadius * Math.sin(rad);
        console.log(`${stage.name} - 角度: ${midAngle.toFixed(2)}, 对应生命线位置: (${lifeLineX.toFixed(2)}, ${lifeLineY.toFixed(2)}), 诗词点位置: (${x.toFixed(2)}, ${y.toFixed(2)})`);

        // 存储生命线上的点和诗词点的坐标
        lifeLinePoints.push([lifeLineX, lifeLineY]);
        poetryPoints.push([x, y]);

        // 验证点的位置是否在生命线之外
        const pointDistFromCenter = Math.sqrt(Math.pow(x - center[0], 2) + Math.pow(y - center[1], 2));
        console.log(`${stage.name} 点距中心: ${pointDistFromCenter.toFixed(2)}, 内层粉色生命线半径: ${innerLineRadius}, 外层灰线半径: ${outerLineRadius}`);

        if (pointDistFromCenter <= innerLineRadius) {
            console.warn(`警告: ${stage.name} 的点位置(${pointDistFromCenter.toFixed(2)})不在内层生命线外侧(${innerLineRadius})!`);
            // 强制调整到内层生命线之外，使用一个小的固定偏移量确保视觉上的一致性
            const forcedOffset = 5; // 使用固定的偏移量替代 baseOffset
            const adjustedRadius = innerLineRadius + forcedOffset;
            stage.x = center[0] + adjustedRadius * Math.cos(rad);
            stage.y = center[1] + adjustedRadius * Math.sin(rad);
            console.log(`已调整 ${stage.name} 的点位置到内层生命线外侧`);

            // 更新诗词点数组中的坐标
            poetryPoints[poetryPoints.length - 1] = [stage.x, stage.y];
        }

        // 检查坐标是否有效
        if (!isFinite(stage.x) || !isFinite(stage.y)) {
            console.error(`无效的点坐标: x=${stage.x}, y=${stage.y}, stage=${stage.name}`);
            return; // 跳过这个点
        }

        // 直接按诗词量线性计算点的大小，不设置上下限阈值
        const minSize = 3;   // 最小点大小基准值
        const scaleFactor = 0.15;  // 放大系数，控制点大小增长速度

        // 直接线性计算，诗词量越大点越大，完全成正比
        const pointSize = minSize + stage.value * scaleFactor;

        console.log(`${stage.name}: 诗词量=${stage.value}, 点大小=${pointSize.toFixed(2)}, 角度=${midAngle.toFixed(2)}`);

        // 使用更鲜艳的颜色
        const stageColor = getColorByStage(stage.stage_key);

        // 创建点 - 统一使用圆形，只根据诗词量调整大小
        let pointElement = new echarts.graphic.Circle({
            shape: {
                cx: stage.x,
                cy: stage.y,
                r: pointSize
            },
            style: {
                fill: stageColor,
                stroke: '#ffffff',
                lineWidth: 1.5,
                shadowBlur: 6,
                shadowColor: 'rgba(0,0,0,0.4)',
                opacity: 0.8,
                blend: 'source-over'
            },
            zlevel: 14 // 提高zlevel确保点在生命线上方显示
        });

        // 创建一个更大的透明点作为悬停区域，解决鼠标稍微移动就失去悬停效果的问题
        let hoverArea = new echarts.graphic.Circle({
            shape: {
                cx: stage.x,
                cy: stage.y,
                r: pointSize * 1.8 // 比实际点大1.8倍
            },
            style: {
                fill: 'transparent', // 完全透明
                cursor: 'pointer' // 鼠标指针样式
            },
            zlevel: 15, // 确保在点的上层
            silent: false // 响应鼠标事件
        });

        // 为扩展的悬停区域添加事件处理
        hoverArea.on('mouseover', function () {
            // 记录当前激活的生命阶段
            activeStage.value = stage

            // 激活实际的点元素样式
            pointElement.attr({
                style: {
                    opacity: 1, // 完全不透明
                    shadowBlur: 10,
                    shadowColor: 'rgba(0,0,0,0.6)'
                }
            })

            // 查找并高亮对应的连接线
            const connectingLine = elements.find(el =>
                el instanceof echarts.graphic.Line &&
                el.shape.x2 === stage.x &&
                el.shape.y2 === stage.y
            );

            if (connectingLine) {
                // 高亮连接线
                connectingLine.attr({
                    style: {
                        lineWidth: 2.5,
                        opacity: 1,
                        lineDash: [3, 3],
                        shadowBlur: 4,
                        shadowColor: 'rgba(0,0,0,0.5)'
                    }
                });
            }

            // 计算该阶段诗歌占总诗歌的百分比
            const percentage = totalPoems > 0 ? ((stage.value / totalPoems) * 100).toFixed(1) : 0

            // 获取诗人的生卒年份
            const birthYear = poetLifeStage.startYear
            const deathYear = poetLifeStage.endYear
            const lifespan = birthYear && deathYear ? `${birthYear}-${deathYear}` : '生卒年不详'

            // 构建更详细的提示信息
            const tooltipText = `${poetLifeStage.poetName} (${lifespan})
${stage.name}: ${stage.value}首
占总创作的${percentage}%
总创作: ${totalPoems}首`

            showTooltip(tooltipText, stage.x, stage.y)
        })

        hoverArea.on('mouseout', function (e) {
            // 检查鼠标是否真的离开了区域
            const eventX = e.event.offsetX || e.event.zrX || 0
            const eventY = e.event.offsetY || e.event.zrY || 0

            // 计算鼠标与中心点的距离
            const dx = eventX - stage.x
            const dy = eventY - stage.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            // 只有当鼠标真正离开悬停区域时才重置
            if (distance > hoverArea.shape.r) {
                activeStage.value = null

                // 恢复半透明效果
                pointElement.attr({
                    style: {
                        opacity: 0.8, // 恢复原始半透明
                        shadowBlur: 6,
                        shadowColor: 'rgba(0,0,0,0.4)'
                    }
                })

                // 查找并恢复连接线样式
                const connectingLine = elements.find(el =>
                    el instanceof echarts.graphic.Line &&
                    el.shape.x2 === stage.x &&
                    el.shape.y2 === stage.y
                );

                if (connectingLine) {
                    // 恢复连接线样式
                    connectingLine.attr({
                        style: {
                            stroke: getColorByStage(stage.stage_key),
                            lineWidth: 1.8,
                            opacity: 0.75,
                            lineDash: [3, 3],
                            shadowBlur: 0
                        }
                    });
                }

                // 隐藏提示
                hideTooltip()
            }
        })

        zr.add(pointElement)
        zr.add(hoverArea) // 添加扩展的悬停区域
        elements.push(pointElement)
        elements.push(hoverArea)
    })

    // 为每个点创建连接到生命线的连接线
    activeStages.forEach((stage) => {
        if (!isFinite(stage.x) || !isFinite(stage.y)) {
            return; // 跳过无效坐标
        }

        // 获取该生命阶段的角度 - 使用保存的角度而不是重新计算
        const rad = radians(stage.angle);

        // 计算生命线上的对应点 - 连接到内层粉色生命线
        const lifeLineX = center[0] + innerLineRadius * Math.cos(rad);
        const lifeLineY = center[1] + innerLineRadius * Math.sin(rad);

        // 创建连接线 - 点到生命线
        const connectingLine = new echarts.graphic.Line({
            shape: {
                x1: lifeLineX,
                y1: lifeLineY,
                x2: stage.x,
                y2: stage.y
            },
            style: {
                stroke: getColorByStage(stage.stage_key),
                lineWidth: 1.5,  // 稍微减小线宽以显得更精致
                opacity: 0.8,    // 增加透明度使连接线更清晰
                lineDash: [2, 3], // 调整虚线样式
                shadowBlur: 1,    // 轻微的阴影效果
                shadowColor: 'rgba(0,0,0,0.15)'
            },
            zlevel: 13 // 确保在点下方但在生命线上方
        });

        zr.add(connectingLine);
        elements.push(connectingLine);
    });
}

// 辅助函数：尝试从poetLifeStage对象中找到诗人生命线的角度范围
function findPoetLifeSpanAngles(poetLifeStage) {
    console.log("尝试寻找诗人生命线角度范围，输入数据:", poetLifeStage);

    // 首先检查poetLifeStage是否有角度信息
    if (poetLifeStage.angleRange) {
        console.log("从angleRange获取角度:", poetLifeStage.angleRange);
        return poetLifeStage.angleRange;
    }

    // 检查是否有具体的起止角度
    if (poetLifeStage.startAngle !== undefined && poetLifeStage.endAngle !== undefined) {
        console.log("从startAngle/endAngle获取角度:", poetLifeStage.startAngle, poetLifeStage.endAngle);
        return {
            startAngle: poetLifeStage.startAngle,
            endAngle: poetLifeStage.endAngle
        };
    }

    // 检查是否有timelineData
    if (poetLifeStage.timelineData && poetLifeStage.timelineData.poetAngleRange) {
        console.log("从timelineData.poetAngleRange获取角度:", poetLifeStage.timelineData.poetAngleRange);
        return poetLifeStage.timelineData.poetAngleRange;
    }

    // 检查是否有poetInfo并包含角度范围
    if (poetLifeStage.poetInfo && poetLifeStage.poetInfo.angleRange) {
        console.log("从poetInfo.angleRange获取角度:", poetLifeStage.poetInfo.angleRange);
        return poetLifeStage.poetInfo.angleRange;
    }

    // 尝试找到其他可能包含角度信息的属性
    const possibleSources = [
        'lifeLineAngles',
        'lifelineAngles',
        'lifespanAngles',
        'visualAngles'
    ];

    for (const source of possibleSources) {
        if (poetLifeStage[source]) {
            console.log(`从${source}获取角度:`, poetLifeStage[source]);
            return poetLifeStage[source];
        }
    }

    // 如果找不到角度范围，返回null
    console.log("未找到角度范围信息");
    return null;
}

// 辅助函数：根据年份估计角度范围
function estimateAnglesFromYears(startYear, endYear) {
    if (!startYear || !endYear) return null;

    // 获取时间点数据 - 与lifeSpans.js保持一致
    // 假设默认的时间点数组，与timePoints.js中的静态时间点一致
    const defaultTimePoints = [
        1515, 1533, 1552, 1571, 1590, 1609, 1628, 1647, 1665,
        1684, 1703, 1722, 1741, 1760, 1779, 1798, 1816, 1835,
        1854, 1873, 1892, 1911, 1930, 1949
    ];

    // 使用与lifeSpans.js中相同的角度计算逻辑
    const getAngleByYear = (year) => {
        // 年份数据检查
        if (isNaN(year) || year <= 0) {
            console.warn(`无效的年份值: ${year}, 使用默认值替代`);
            year = defaultTimePoints[Math.floor(defaultTimePoints.length / 2)];
        }

        // 找到时间点中最接近的年份
        const closestYear = defaultTimePoints.reduce((prev, curr) =>
            Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
        );

        // 找到这个年份在时间点数组中的索引
        const yearIndex = defaultTimePoints.indexOf(closestYear);

        // 确保找到有效的索引
        if (yearIndex === -1) {
            console.warn(`在时间点数组中找不到年份 ${closestYear}，使用线性映射`);
            // 使用线性映射作为备选方案
            const minTimeYear = Math.min(...defaultTimePoints);
            const maxTimeYear = Math.max(...defaultTimePoints);
            const yearRange = maxTimeYear - minTimeYear;
            const yearPosition = Math.max(0, Math.min(1, (year - minTimeYear) / yearRange));
            return yearPosition * 360;
        }

        // 与timePoints.js中保持一致的角度计算
        return (yearIndex / defaultTimePoints.length) * 360;
    };

    // 计算起止角度
    let startAngle = getAngleByYear(startYear);
    let endAngle = getAngleByYear(endYear);

    // 确保角度范围在0-360度之间
    startAngle = Math.max(0, Math.min(360, startAngle));
    endAngle = Math.max(0, Math.min(360, endAngle));

    // 如果结束角度小于起始角度，加上360度使其形成有效范围
    if (endAngle < startAngle) {
        endAngle += 360;
    }

    // 确保至少有一个最小弧度
    if (Math.abs(endAngle - startAngle) < 15) {
        endAngle = startAngle + 15;
    }

    console.log(`根据年份(${startYear}-${endYear})估计的角度范围: ${startAngle.toFixed(2)} - ${endAngle.toFixed(2)}`);
    console.log(`使用与lifeSpans.js兼容的角度计算方法`);

    return { startAngle, endAngle };
}

// 新增函数：根据角度范围计算各生命阶段的角度
function calculateLifeStageAnglesFromRange(poetLifeStage, stageAngleMap) {
    // 获取诗人生命线的角度范围
    const startAngle = poetLifeStage.angleRange.startAngle;
    const endAngle = poetLifeStage.angleRange.endAngle;

    // 确保角度范围有效
    if (typeof startAngle !== 'number' || typeof endAngle !== 'number') {
        console.error('无效的角度范围:', poetLifeStage.angleRange);
        return;
    }

    // 计算总角度范围
    const totalAngleRange = endAngle > startAngle ?
        endAngle - startAngle :
        (endAngle + 360) - startAngle;

    console.log(`生命角度范围: ${startAngle} - ${endAngle}, 总角度: ${totalAngleRange}`);

    // 计算每个生命阶段的角度 - 少年期对应出生年，晚年期对应死亡年
    stageAngleMap['stage_child'] = {
        mid: startAngle,
        start: startAngle,
        end: startAngle
    };

    stageAngleMap['stage_elder'] = {
        mid: endAngle,
        start: endAngle,
        end: endAngle
    };

    // 计算中间阶段的角度 - 均匀分布
    const middleStepAngle = totalAngleRange / 4; // 5个阶段，4个间隔

    stageAngleMap['stage_youth'] = {
        mid: normalizeDegrees(startAngle + middleStepAngle),
        start: normalizeDegrees(startAngle + middleStepAngle),
        end: normalizeDegrees(startAngle + middleStepAngle)
    };

    stageAngleMap['stage_prime'] = {
        mid: normalizeDegrees(startAngle + 2 * middleStepAngle),
        start: normalizeDegrees(startAngle + 2 * middleStepAngle),
        end: normalizeDegrees(startAngle + 2 * middleStepAngle)
    };

    stageAngleMap['stage_middle'] = {
        mid: normalizeDegrees(startAngle + 3 * middleStepAngle),
        start: normalizeDegrees(startAngle + 3 * middleStepAngle),
        end: normalizeDegrees(startAngle + 3 * middleStepAngle)
    };

    console.log('基于角度范围计算的生命阶段角度:', stageAngleMap);
}

// 新增函数：根据诗人生卒年计算各生命阶段角度
function calculateLifeStageAnglesFromYears(poetLifeStage, stageAngleMap) {
    // 获取诗人生卒年
    const birthYear = poetLifeStage.startYear;
    const deathYear = poetLifeStage.endYear;

    // 计算各生命阶段的对应年份
    const stageYears = {
        'stage_child': birthYear, // 少年期对应出生年
        'stage_youth': birthYear + 21, // 青年期对应21岁(16-25的中点)
        'stage_prime': birthYear + 33, // 壮年期对应33岁(26-40的中点)
        'stage_middle': birthYear + 50, // 中年期对应50岁(41-60的中点)
        'stage_elder': deathYear // 晚年期对应死亡年
    };

    console.log('各生命阶段对应年份:', stageYears);

    // 如果存在timePoints属性，使用与timePoints.js一致的角度计算方法
    if (poetLifeStage.timePoints && Array.isArray(poetLifeStage.timePoints) && poetLifeStage.timePoints.length > 0) {
        const timePoints = poetLifeStage.timePoints;

        // 对每个生命阶段，找到时间点中最接近对应年份的点，计算其角度
        Object.keys(stageYears).forEach(stageKey => {
            const targetYear = stageYears[stageKey];

            // 找到最接近的时间点
            const closestYear = timePoints.reduce((prev, curr) =>
                Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
            );

            // 找到该时间点的索引
            const yearIndex = timePoints.indexOf(closestYear);

            // 计算对应角度
            const angle = (yearIndex / timePoints.length) * 360;

            // 更新stageAngleMap
            stageAngleMap[stageKey] = {
                mid: angle,
                start: angle,
                end: angle
            };

            console.log(`${stageKey} 目标年份: ${targetYear}, 最接近的时间点: ${closestYear}, 索引: ${yearIndex}, 角度: ${angle}`);
        });
    }
    // 如果没有timePoints属性，使用估算方法
    else {
        // 假设有一个默认的时间范围
        const defaultTimeRange = {
            min: 1500,
            max: 1950
        };

        // 计算每个阶段在时间范围中的位置比例，然后映射到0-360度
        Object.keys(stageYears).forEach(stageKey => {
            const year = stageYears[stageKey];
            const position = (year - defaultTimeRange.min) / (defaultTimeRange.max - defaultTimeRange.min);
            const angle = position * 360;

            stageAngleMap[stageKey] = {
                mid: angle,
                start: angle,
                end: angle
            };

            console.log(`${stageKey} 年份: ${year}, 位置比例: ${position.toFixed(2)}, 角度: ${angle.toFixed(2)}`);
        });
    }

    console.log('基于年份计算的生命阶段角度:', stageAngleMap);
}

// 辅助函数：规范化角度到0-360度范围
function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
} 