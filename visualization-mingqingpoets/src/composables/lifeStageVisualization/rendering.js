import * as echarts from 'echarts'
import { renderTimePointsOnCurve, renderTimelineDataPoints } from './timePoints'
import { renderLifeStagePoints } from './lifeStagePoints'
import { renderConnectingLines } from './curves'
import { renderPoetLifeSpans } from './lifeSpans'
import { renderPoetEventPoints } from './eventPoints'

// 渲染诗人生命阶段可视化renderLifeStagePoints
export const renderPoetLifeStages = (
    chart,
    poetLifeStage,
    currentPoetName,
    timelineData,
    activeStage,
    lifeStageElements,
    setLifeStageElements,
    poetId,
    eventData = []
) => {
    console.log('开始渲染诗人', currentPoetName, '的生命阶段可视化')
    console.log('当前选择的诗人是:', currentPoetName)

    // 检查数据有效性，宽松处理，尝试使用可能不完整的数据
    if (!chart || !poetLifeStage) {
        console.warn('没有图表实例或诗人数据，跳过渲染')
        return false
    }

    // 输出数据用于调试
    console.log('诗人生命阶段数据:', poetLifeStage)

    // 过滤出诗词量大于0的生命阶段
    const validStages = poetLifeStage.stages.filter(stage => stage.value > 0)

    // 过滤出生命年份范围内的阶段（避免展示实际没有经历的生命阶段）
    let birthYear = 0
    let deathYear = 0

    // 尝试从不同来源获取生卒年信息
    if (poetLifeStage.startYear) {
        birthYear = parseInt(poetLifeStage.startYear)
    } else if (poetLifeStage.birthYear) {
        birthYear = parseInt(poetLifeStage.birthYear)
    }

    if (poetLifeStage.endYear) {
        deathYear = parseInt(poetLifeStage.endYear)
    } else if (poetLifeStage.deathYear) {
        deathYear = parseInt(poetLifeStage.deathYear)
    }

    console.log(`诗人 ${currentPoetName} 生卒年: ${birthYear}-${deathYear}, 寿命: ${deathYear - birthYear}岁`)

    // 如果没有有效的生命阶段，跳过渲染
    if (validStages.length === 0) {
        console.log(`诗人${currentPoetName}没有任何诗词量大于0的生命阶段，跳过渲染`)
        return false
    }

    const zr = chart.getZr()
    const stages = poetLifeStage.stages

    if (!stages || stages.length === 0) {
        console.log('没有生命阶段数据，跳过渲染')
        return
    }

    const elements = []

    try {
        // 计算圆形的中心和基础半径
        const center = [400, 300]
        const baseRadius = 200
        // 使点位于圆形遮罩之外，增加额外的半径偏移量
        const radiusOffset = 60 // 从30增加到60，使点更远离圆

        // 获取诗人寿命
        const startYear = poetLifeStage.startYear ? Number(poetLifeStage.startYear) : 0;
        const endYear = poetLifeStage.endYear ? Number(poetLifeStage.endYear) : 0;
        const lifespan = (startYear && endYear) ? (endYear - startYear) : 0;
        console.log(`诗人 ${poetLifeStage.poetName} 生卒年: ${startYear}-${endYear}, 寿命: ${lifespan}岁`);

        // 特别调试仲振宣的数据
        if (poetLifeStage.poetName === '仲振宣' || currentPoetName.includes('仲振宣')) {
            console.log('【仲振宣渲染调试】输入的原始阶段数据:', stages.map(s => ({
                name: s.name,
                value: s.value,
                stage_key: s.stage_key
            })));
        }

        // 过滤生命阶段: (1)诗词量大于0 且 (2)诗人实际经历过该阶段
        const activeStages = stages.filter(stage => {
            // 首先检查诗词量
            if (stage.value <= 0) return false;

            // 然后检查诗人是否经历过该阶段
            // 如果是"全部诗人"视图或无法获取寿命信息，则展示所有有诗词的阶段
            if (!lifespan || poetLifeStage.poetName.includes('全部') || poetLifeStage.poetID === 0) return true;

            // 根据生命阶段和寿命判断
            switch (stage.stage_key) {
                case 'stage_child': // 少年期(5-15岁)
                    return lifespan >= 5;
                case 'stage_youth': // 青年期(16-25岁)
                    return lifespan >= 16;
                case 'stage_prime': // 壮年期(26-40岁)
                    return lifespan >= 26;
                case 'stage_middle': // 中年期(41-60岁)
                    return lifespan >= 41;
                case 'stage_elder': // 晚年期(61岁以上)
                    return lifespan >= 61;
                default:
                    return true;
            }
        });

        console.log(`诗人 ${poetLifeStage.poetName} 有效生命阶段: ${activeStages.length}个，阶段名称: ${activeStages.map(s => s.name).join(', ')}`);

        // 继续调试仲振宣的数据
        if (poetLifeStage.poetName === '仲振宣' || currentPoetName.includes('仲振宣')) {
            console.log('【仲振宣渲染调试】过滤后的阶段数据:', activeStages.map(s => ({
                name: s.name,
                value: s.value,
                stage_key: s.stage_key
            })));
            console.log('【仲振宣渲染调试】过滤逻辑检查:');
            stages.forEach(stage => {
                const isActive = activeStages.some(as => as.stage_key === stage.stage_key);
                console.log(`  ${stage.name}: 诗词量=${stage.value}, 是否通过过滤=${isActive}`);

                // 详细检查过滤条件
                if (stage.value <= 0) {
                    console.log(`    → 诗词量为0，被过滤`);
                } else if (!lifespan || poetLifeStage.poetName.includes('全部') || poetLifeStage.poetID === 0) {
                    console.log(`    → 全部诗人模式或无法获取寿命，不过滤`);
                } else {
                    // 根据生命阶段判断
                    switch (stage.stage_key) {
                        case 'stage_child': // 少年期(5-15岁)
                            console.log(`    → 少年期: 寿命${lifespan}岁 ${lifespan >= 5 ? '>=5岁，不过滤' : '<5岁，被过滤'}`);
                            break;
                        case 'stage_youth': // 青年期(16-25岁)
                            console.log(`    → 青年期: 寿命${lifespan}岁 ${lifespan >= 16 ? '>=16岁，不过滤' : '<16岁，被过滤'}`);
                            break;
                        case 'stage_prime': // 壮年期(26-40岁)
                            console.log(`    → 壮年期: 寿命${lifespan}岁 ${lifespan >= 26 ? '>=26岁，不过滤' : '<26岁，被过滤'}`);
                            break;
                        case 'stage_middle': // 中年期(41-60岁)
                            console.log(`    → 中年期: 寿命${lifespan}岁 ${lifespan >= 41 ? '>=41岁，不过滤' : '<41岁，被过滤'}`);
                            break;
                        case 'stage_elder': // 晚年期(61岁以上)
                            console.log(`    → 晚年期: 寿命${lifespan}岁 ${lifespan >= 61 ? '>=61岁，不过滤' : '<61岁，被过滤'}`);
                            break;
                    }
                }
            });
        }

        // 判断是否为多选模式
        const isMultiSelectMode = Array.isArray(currentPoetName) && currentPoetName.length > 0;

        // 如果是多选模式，准备传递给renderLifeStagePoints的额外信息
        if (isMultiSelectMode) {
            // 从poetLifeStage中提取已有数据
            const existingData = { ...poetLifeStage };

            // 确保有一个selectedPoets字段
            if (!existingData.selectedPoets) {
                // 找到所有选中的诗人数据
                const selectedPoetsData = [];
                if (timelineData && timelineData.poetLifeSpans) {
                    currentPoetName.forEach(poetName => {
                        const poet = timelineData.poetLifeSpans.find(p =>
                            p.name === poetName || (poetName === '仲振宣' && p.name === '仲振宣')
                        );
                        if (poet) {
                            selectedPoetsData.push(poet);
                        }
                    });
                }
                existingData.selectedPoets = selectedPoetsData;
            }

            console.log(`为多选模式准备了 ${existingData.selectedPoets.length} 个诗人数据`);

            // 多选模式下不再渲染生命阶段点，仅保留诗词量曲线
            // 不调用renderLifeStagePoints，避免渲染生命阶段点
            console.log('多选模式：跳过生命阶段点渲染，仅使用诗词量曲线');
        } else {
            // 非多选模式使用原始调用
            renderLifeStagePoints(zr, elements, center, baseRadius, radiusOffset, activeStages, poetLifeStage, activeStage);
        }

        // 渲染主要组件
        renderBasicElements(zr, elements, center, baseRadius)
        // 注意：时间点渲染已经在index.js中处理，这里不再重复渲染
        // renderTimePoints(zr, elements, center, baseRadius, timelineData)

        // 如果有足够的点，创建连接它们的线条和曲线
        if (activeStages.length > 1 && !isMultiSelectMode) { // 多选模式下不渲染连接线和曲线
            // Original call:
            // renderConnectingLines(zr, elements, center, baseRadius, activeStages)

            // Modified call: Pass selectedPoets if available
            renderConnectingLines(
                zr,
                elements,
                center,
                baseRadius,
                activeStages,
                false, // isAllPoets is false here as it's rendering for a specific poet
                poetLifeStage.selectedPoets || null // Pass the selected poets list
            );
            // renderMiddleCurve(zr, elements, center, baseRadius, stages)

            // 添加时间点和诗人生命周期曲线
            renderTimePointsOnCurve(zr, elements, center, baseRadius, poetLifeStage)
            renderPoetLifeSpans(zr, elements, center, baseRadius, timelineData, currentPoetName)

            // 添加时间线数据点
            if (timelineData && timelineData.timelines) {
                renderTimelineDataPoints(zr, elements, center, baseRadius, timelineData, poetId);
            }

            // 添加诗人事件点
            if (eventData && eventData.length > 0) {
                console.log(`为诗人 ${poetLifeStage.poetName} 渲染 ${eventData.length} 个事件点`)
                renderPoetEventPoints(zr, elements, center, baseRadius, stages, poetLifeStage, eventData)
            }
        }

        // 添加标题和说明
        // renderTitle(zr, elements, poetLifeStage, currentPoetName)

        // 返回所有添加的元素引用
        setLifeStageElements(elements)
        console.log(`成功渲染 ${poetLifeStage.poetName} 的生命阶段可视化，包含 ${elements.length} 个元素`)
    } catch (error) {
        console.error('渲染生命阶段可视化时出错:', error)
    }
}

// 渲染基础元素，包括圆形边框
export const renderBasicElements = (zr, elements, center, baseRadius) => {
    // 创建圆形边框
    const circle = new echarts.graphic.Circle({
        shape: {
            cx: center[0],
            cy: center[1],
            r: baseRadius
        },
        style: {
            fill: 'transparent',
            stroke: '#999999',
            lineWidth: 1.5
        },
        zlevel: 1
    });

    zr.add(circle);
    elements.push(circle);

    // 注意：不再直接调用renderTimePoints
    // renderTimePoints函数现在会在index.js中根据是否是多选模式来调用
}

// 渲染标题
// export const renderTitle = (zr, elements, poetLifeStage, currentPoetName) => {
//     let titleText = `${poetLifeStage.poetName}`

//     // 检查显示的诗人数据名称与当前选择的诗人是否匹配（忽略特殊占位名称）
//     const isDataMatchingCurrentPoet =
//         poetLifeStage.poetName === currentPoetName ||
//         poetLifeStage.poetName.includes(currentPoetName) ||
//         currentPoetName.includes(poetLifeStage.poetName)

//     if (!isDataMatchingCurrentPoet) {
//         titleText = `${poetLifeStage.poetName}`
//     }

//     // 移除可能存在的"多选模式"前缀
//     if (titleText.includes("多选模式")) {
//         titleText = titleText.replace(/多选模式[：:]\s*/, "");
//     }

//     const title = new echarts.graphic.Text({
//         style: {
//             text: titleText,
//             font: 'bold 16px Microsoft YaHei',
//             textFill: '#333',
//             textAlign: 'center'
//         },
//         position: [400, 150],
//         zlevel: 12
//     })

//     zr.add(title)
//     elements.push(title)
// }

// 在tooltip中显示诗词量时，确保使用原始数据而不是经过二次处理的数据
// 寻找可能存在的截断或舍入操作，并进行修复

// 这里我们只实现了部分函数，其他函数将在后续文件中实现
// renderTimePoints, renderLifeStagePoints, renderConnectingLines,
// renderMiddleCurve, renderTimePointsOnCurve, renderPoetLifeSpans 