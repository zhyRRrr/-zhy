import * as echarts from 'echarts'
import { getColorByStage, radians } from './utils'
import { showTooltip, hideTooltip } from './tooltip'

// 根据年龄判断生命阶段
const getLifeStageByAge = (age) => {
    if (age >= 5 && age <= 15) {
        return { key: 'stage_child', name: '少年期(5-15岁)' }
    } else if (age > 15 && age <= 25) {
        return { key: 'stage_youth', name: '青年期(16-25岁)' }
    } else if (age > 25 && age <= 40) {
        return { key: 'stage_prime', name: '壮年期(26-40岁)' }
    } else if (age > 40 && age <= 60) {
        return { key: 'stage_middle', name: '中年期(41-60岁)' }
    } else if (age > 60) {
        return { key: 'stage_elder', name: '晚年期(61岁以上)' }
    } else {
        return { key: '', name: '未知阶段' }
    }
}

// 计算紫色曲线上的点位置
const findPointOnLifeStageCurve = (age, stages, center, baseRadius) => {
    // 获取对应的生命阶段
    const lifeStage = getLifeStageByAge(age)

    // 过滤出有效的生命阶段点（有值且有坐标）
    const validStages = stages.filter(stage => stage.value > 0 && stage.x && stage.y)

    if (validStages.length < 2) {
        // 如果有效点少于2个，在基础圆上找一个对应角度的点
        const angle = (age / 100) * 360 // 简单映射：按年龄在人生百年中的比例计算角度
        const x = center[0] + baseRadius * Math.cos(angle * Math.PI / 180)
        const y = center[1] + baseRadius * Math.sin(angle * Math.PI / 180)
        return { x, y, stageName: lifeStage.name, stageKey: lifeStage.key }
    }

    // 将生命阶段点按角度排序
    const sortedStages = [...validStages].sort((a, b) => a.angle - b.angle)

    // 基于年龄计算对应的角度 - 关键改进
    // 计算年龄在生命周期中所处的比例
    const lifeRatio = age / 100  // 假设最大年龄为100岁

    // 获取最小和最大角度
    const minAngle = sortedStages[0].angle
    const maxAngle = sortedStages[sortedStages.length - 1].angle

    // 确保角度范围正确（处理角度跨越0/360度的情况）
    let angleRange = maxAngle - minAngle
    if (angleRange <= 0) {
        angleRange += 360
    }

    // 根据年龄比例计算对应角度
    let calculatedAngle = minAngle + angleRange * lifeRatio

    // 确保角度在0-360范围内
    calculatedAngle = (calculatedAngle + 360) % 360

    // 使用与中间曲线相同的半径 - 与renderMiddleCurve保持一致
    const curveRadius = baseRadius + 42  // 使用中间曲线的半径

    // 计算曲线上的坐标
    const rad = radians(calculatedAngle)
    const x = center[0] + curveRadius * Math.cos(rad)
    const y = center[1] + curveRadius * Math.sin(rad)

    return { x, y, stageName: lifeStage.name, stageKey: lifeStage.key }
}

// 渲染诗人事件点
export const renderPoetEventPoints = (zr, elements, center, baseRadius, stages, poetLifeStage, eventData) => {
    if (!eventData || eventData.length === 0 || !poetLifeStage || !poetLifeStage.startYear) {
        console.log('没有事件数据或诗人生命数据，跳过渲染事件点')
        return
    }

    const birthYear = parseInt(poetLifeStage.startYear)

    if (isNaN(birthYear)) {
        console.error('诗人出生年份无效，无法计算年龄')
        return
    }

    console.log(`渲染诗人 ${poetLifeStage.poetName} 的 ${eventData.length} 个事件点`)

    // 按时间排序事件
    const sortedEvents = [...eventData].sort((a, b) => a.event_year - b.event_year)

    sortedEvents.forEach(event => {
        const eventYear = parseInt(event.event_year)

        if (isNaN(eventYear)) {
            console.warn(`事件年份无效: ${event.event_content}`)
            return
        }

        // 计算事件发生时诗人的年龄
        const age = eventYear - birthYear

        if (age < 0) {
            console.warn(`事件年份早于诗人出生年份: ${event.event_content}`)
            return
        }

        // 找到年龄对应的生命阶段曲线上的点
        const point = findPointOnLifeStageCurve(age, stages, center, baseRadius)

        if (!point || !isFinite(point.x) || !isFinite(point.y)) {
            console.warn(`无法为事件找到有效坐标: ${event.event_content}`)
            return
        }

        // 获取对应生命阶段的颜色
        const stageColor = getColorByStage(point.stageKey)

        // 创建事件点
        const eventPoint = new echarts.graphic.Circle({
            shape: {
                cx: point.x,
                cy: point.y,
                r: 5 // 事件点尺寸调小
            },
            style: {
                fill: '#ffffff',
                stroke: stageColor,
                lineWidth: 2,
                shadowBlur: 4,
                shadowColor: 'rgba(0,0,0,0.3)',
                opacity: 0.9
            },
            zlevel: 15 // 确保在其他元素之上
        })

        // 创建悬停区域
        const hoverArea = new echarts.graphic.Circle({
            shape: {
                cx: point.x,
                cy: point.y,
                r: 10 // 比实际点大，便于交互
            },
            style: {
                fill: 'transparent',
                cursor: 'pointer'
            },
            zlevel: 16
        })

        // 添加事件处理
        hoverArea.on('mouseover', function () {
            // 高亮显示事件点
            eventPoint.attr({
                style: {
                    fill: stageColor,
                    stroke: '#ffffff',
                    lineWidth: 2,
                    opacity: 1,
                    shadowBlur: 8,
                    shadowColor: 'rgba(0,0,0,0.5)'
                },
                shape: {
                    r: 7 // 稍微放大
                }
            })

            // 显示事件详情提示
            const tooltipContent = `${poetLifeStage.poetName}
${eventYear}年 (${age}岁)
${point.stageName}
${event.event_content}`

            showTooltip(tooltipContent, point.x, point.y)
        })

        hoverArea.on('mouseout', function () {
            // 恢复原样式
            eventPoint.attr({
                style: {
                    fill: '#ffffff',
                    stroke: stageColor,
                    lineWidth: 2,
                    shadowBlur: 4,
                    shadowColor: 'rgba(0,0,0,0.3)',
                    opacity: 0.9
                },
                shape: {
                    r: 5 // 恢复原大小
                }
            })

            // 隐藏提示
            hideTooltip()
        })

        // 添加到图表
        zr.add(eventPoint)
        zr.add(hoverArea)
        elements.push(eventPoint)
        elements.push(hoverArea)
    })
} 