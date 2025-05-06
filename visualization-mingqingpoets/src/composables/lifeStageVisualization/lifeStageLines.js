import * as echarts from 'echarts'
import { radians } from './utils'
import { interpolateColor } from './gradientUtils'

// 渲染生命线和分段线
export const renderLifeLines = (zr, elements, center, baseRadius, poetData) => {
    if (!poetData) {
        console.error('诗人数据为空，无法渲染生命线')
        return null
    }

    try {
        // 解析诗人的生年和卒年
        const birthYear = poetData.startYear ? parseInt(poetData.startYear) : null
        const deathYear = poetData.endYear ? parseInt(poetData.endYear) : null

        if (!birthYear && !deathYear) {
            console.warn(`诗人${poetData.poetName}没有有效的生卒年份数据`)
        } else {
            console.log(`诗人${poetData.poetName}的生卒年份: ${birthYear || '?'} - ${deathYear || '?'}`)
        }

        // 计算每个诗人的时间跨度（相对于整个时间轴）
        // 如果没有明确的生卒年，可以使用其他属性确定其在时间轴上的位置
        let startAngle, endAngle

        // 检查是否直接提供了角度信息
        if (poetData.startAngle !== undefined && poetData.endAngle !== undefined) {
            startAngle = poetData.startAngle
            endAngle = poetData.endAngle
        } else if (poetData.angleRange) {
            // 或者使用提供的角度范围对象
            startAngle = poetData.angleRange.startAngle
            endAngle = poetData.angleRange.endAngle
        } else {
            // 如果没有直接的角度信息，尝试从年份计算
            const eraStartYear = 1600 // 假设整个时代的起始年份
            const eraEndYear = 2000 // 假设整个时代的结束年份
            const eraRange = eraEndYear - eraStartYear

            // 如果有生年，使用生年；否则使用卒年减去平均寿命估算
            const avgLifespan = 60 // 平均寿命估算值
            const estimatedBirthYear = birthYear || (deathYear ? deathYear - avgLifespan : eraStartYear)

            // 如果有卒年，使用卒年；否则使用生年加上平均寿命估算
            const estimatedDeathYear = deathYear || (birthYear ? birthYear + avgLifespan : eraEndYear)

            // 计算在整个时间线上的相对位置（角度）
            startAngle = ((estimatedBirthYear - eraStartYear) / eraRange) * 360
            endAngle = ((estimatedDeathYear - eraStartYear) / eraRange) * 360

            // 确保角度在0-360范围内
            startAngle = Math.max(0, Math.min(360, startAngle))
            endAngle = Math.max(0, Math.min(360, endAngle))

            // 如果结束角度小于开始角度，加上360度
            if (endAngle < startAngle) {
                endAngle += 360
            }

            // 确保至少有一个最小弧度
            if (endAngle - startAngle < 15) {
                endAngle = startAngle + 15
            }
        }

        console.log(`诗人${poetData.poetName}的生命线角度范围: ${startAngle.toFixed(2)} - ${endAngle.toFixed(2)}`)

        // 保存角度范围到poetData中，以便其他组件使用
        poetData.startAngle = startAngle;
        poetData.endAngle = endAngle;
        poetData.angleRange = { startAngle, endAngle };

        // 如果有timelineData，也将角度范围保存到其中
        if (poetData.timelineData) {
            poetData.timelineData.poetAngleRange = { startAngle, endAngle };
        }

        // 生命线弧线的半径（外层灰线）
        const outerLineRadius = baseRadius + 40

        // 生命线弧线的宽度
        const lifeLineWidth = 5

        // 生命阶段分段线的半径范围
        const stageLineInnerRadius = baseRadius + 35
        const stageLineOuterRadius = baseRadius + 45

        // 计算整个生命线跨度的角度范围
        const angleRange = endAngle - startAngle

        // 确定生命阶段的分界点（按年龄划分生命阶段）
        // 少年(<=15岁)、青年(16-25岁)、壮年(26-40岁)、中年(41-60岁)、晚年(>60岁)
        const lifespan = deathYear && birthYear ? deathYear - birthYear : 70 // 估计寿命
        const stageAges = [0, 15, 25, 40, 60, lifespan] // 年龄界限
        const stageAngles = stageAges.map(age => startAngle + (age / lifespan) * angleRange)

        // 生命线颜色（外层灰线）
        const outerLineColor = 'rgba(200, 200, 200, 0.7)'

        // 创建外层灰色生命线（圆弧）
        const outerLine = new echarts.graphic.Arc({
            shape: {
                cx: center[0],
                cy: center[1],
                r: outerLineRadius,
                startAngle: radians(startAngle),
                endAngle: radians(endAngle),
                clockwise: true
            },
            style: {
                stroke: outerLineColor,
                fill: 'none', // 透明填充
                lineWidth: lifeLineWidth + 1 // 比内层线稍宽一点
            },
            zlevel: 10 // 确保在内层线下方
        })

        // 粉色生命线（内层）
        const innerLineRadius = baseRadius + 37

        // 使用生命线渐变色
        const innerLineGradientStart = '#ffddec' // 开始颜色（浅粉色）
        const innerLineGradientEnd = '#ff88c8' // 结束颜色（深粉色）

        // 创建内层粉色生命线（圆弧）
        const innerLine = new echarts.graphic.Arc({
            shape: {
                cx: center[0],
                cy: center[1],
                r: innerLineRadius,
                startAngle: radians(startAngle),
                endAngle: radians(endAngle),
                clockwise: true
            },
            style: {
                stroke: innerLineGradientStart, // 初始颜色，将在下面应用渐变
                fill: 'none',
                lineWidth: lifeLineWidth - 1,
                shadowBlur: 5,
                shadowColor: 'rgba(255, 153, 204, 0.5)'
            },
            zlevel: 11 // 确保在外层线上方
        })

        // 为内层生命线添加渐变色
        const linearGradient = new echarts.graphic.LinearGradient(
            0, 0, 1, 0,
            [
                { offset: 0, color: innerLineGradientStart },
                { offset: 1, color: innerLineGradientEnd }
            ]
        )
        innerLine.setStyle({ stroke: linearGradient })

        // 添加生命阶段分界线
        const stageLines = []
        for (let i = 1; i < stageAngles.length - 1; i++) {
            const angle = stageAngles[i]
            const radAngle = radians(angle)
            const cos = Math.cos(radAngle)
            const sin = Math.sin(radAngle)

            // 计算分界线的起点和终点
            const x1 = center[0] + stageLineInnerRadius * cos
            const y1 = center[1] + stageLineInnerRadius * sin
            const x2 = center[0] + stageLineOuterRadius * cos
            const y2 = center[1] + stageLineOuterRadius * sin

            // 分界线的颜色随着年龄增长而变深
            const lineColor = interpolateColor(
                'rgba(100, 100, 100, 0.4)',
                'rgba(80, 80, 80, 0.8)',
                i / (stageAngles.length - 2)
            )

            // 创建分界线
            const stageLine = new echarts.graphic.Line({
                shape: {
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2
                },
                style: {
                    stroke: lineColor,
                    lineWidth: 1.5,
                    lineDash: [2, 2] // 虚线样式
                },
                zlevel: 12 // 确保在生命线上方
            })

            stageLines.push(stageLine)
        }

        // 添加所有元素到ZRender实例和元素数组中
        zr.add(outerLine)
        elements.push(outerLine)
        zr.add(innerLine)
        elements.push(innerLine)

        stageLines.forEach(line => {
            zr.add(line)
            elements.push(line)
        })

        // 返回生命线数据，其他组件可能需要这些信息
        return {
            startAngle,
            endAngle,
            angleRange,
            stageAngles
        }
    } catch (error) {
        console.error('渲染生命线时发生错误:', error)
        return null
    }
} 