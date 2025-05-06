import { ref } from 'vue'
import * as echarts from 'echarts'

export function useTimelineConnections() {
    // 存储临时的连接线
    let timelineConnections = []
    // 当前激活的点（悬停）
    const activePoint = ref(null)

    // 设置图表实例
    let myChart = null
    const setChart = (chart) => {
        myChart = chart
    }

    // 清除时间线连接的函数
    const clearTimelineConnections = () => {
        if (!myChart || timelineConnections.length === 0) return

        const zr = myChart.getZr()
        console.log(`清除 ${timelineConnections.length} 个时间线连接线`)
        timelineConnections.forEach((connection) => {
            if (connection) {
                zr.remove(connection)
            }
        })
        timelineConnections = []

        // 重置activePoint状态，确保鼠标移开后状态被正确清除
        activePoint.value = null
    }

    // 绘制带箭头的路径线
    const drawPathLine = (x1, y1, x2, y2, color, showArrow = false) => {
        if (!myChart) return

        const zr = myChart.getZr()

        // 基础颜色
        const baseColor = color || 'rgba(0, 150, 255, 0.7)'

        // 计算线的角度
        const angle = Math.atan2(y2 - y1, x2 - x1)

        // 创建从地图点到地图点的连接线
        const pathLine = new echarts.graphic.Line({
            shape: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2
            },
            style: {
                stroke: baseColor,
                lineWidth: 3,
                shadowBlur: 6,
                shadowColor: 'rgba(0, 0, 0, 0.3)'
            },
            zlevel: 16 // 高于其他元素
        })

        // 添加线条
        zr.add(pathLine)
        timelineConnections.push(pathLine)

        // 如果需要箭头
        if (showArrow) {
            // 计算箭头位置（线的中间点）
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2

            // 箭头大小
            const arrowSize = 12

            // 计算箭头两个翼的点
            const arrow1X = midX - arrowSize * Math.cos(angle - Math.PI / 6)
            const arrow1Y = midY - arrowSize * Math.sin(angle - Math.PI / 6)
            const arrow2X = midX - arrowSize * Math.cos(angle + Math.PI / 6)
            const arrow2Y = midY - arrowSize * Math.sin(angle + Math.PI / 6)

            // 创建箭头
            const arrowHead = new echarts.graphic.Polygon({
                shape: {
                    points: [
                        [midX, midY],
                        [arrow1X, arrow1Y],
                        [arrow2X, arrow2Y]
                    ]
                },
                style: {
                    fill: baseColor,
                    stroke: baseColor
                },
                zlevel: 16
            })

            // 添加箭头
            zr.add(arrowHead)
            timelineConnections.push(arrowHead)
        }
    }

    // 绘制连接线
    const drawConnectionLine = (x1, y1, x2, y2, color) => {
        if (!myChart) return

        const zr = myChart.getZr()

        // 创建从地图点到生命阶段点的连接线
        const connection = new echarts.graphic.Line({
            shape: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2
            },
            style: {
                stroke: color || 'rgba(0, 150, 255, 0.5)',
                lineWidth: 2,
                lineDash: [5, 5], // 虚线
                shadowBlur: 6,
                shadowColor: 'rgba(0, 0, 0, 0.3)'
            },
            zlevel: 15 // 高于其他元素
        })

        // 添加线条并保存引用以便后续移除
        zr.add(connection)
        timelineConnections.push(connection)
    }

    // 匹配时间线点到生命阶段
    const matchTimelineToLifeStage = (point, poetLifeStage, poetTimelines, showTooltip, getColorByStage) => {
        if (!myChart || !point || !poetLifeStage || !poetLifeStage.stages) return

        // 设置当前激活点
        activePoint.value = point

        // 检查是否为曾懿、宗婉或左錫嘉之一
        const poetName = point.poetName || ''
        const isSpecialPoet =
            poetName.includes('曾懿') || poetName.includes('宗婉') || poetName.includes('左錫嘉')

        // 如果不是这三个特定诗人，则不执行匹配
        if (!isSpecialPoet) {
            console.log(`当前诗人 ${poetName} 不是特定的三个诗人之一，跳过匹配`)
            return
        }

        // 清除之前的连接线
        clearTimelineConnections()

        // 由于设置了activePoint.value，需要重新设置它
        activePoint.value = point

        // 获取点的名称和坐标
        const pointName = point.name
        const pointCoord = myChart.convertToPixel('geo', [point.value[0], point.value[1]])

        if (!pointCoord) return

        console.log(`正在为地点 "${pointName}" 匹配生命阶段数据`)

        // 在时间线数据中查找匹配的点
        const matchingTimelines = poetTimelines.filter((timeline) => {
            // 检查地点名称是否匹配 - 进行更严格的模糊匹配
            let locationMatch = false

            if (timeline.location) {
                // 处理地点字符串，分割为多个可能的地点
                let locations = [timeline.location]

                // 检查是否包含分隔符
                if (timeline.location.includes('->')) {
                    locations = timeline.location.split('->')
                } else if (timeline.location.includes(',') || timeline.location.includes('，')) {
                    locations = timeline.location.split(/[,，]/)
                }

                // 检查每个地点
                for (const loc of locations) {
                    const trimmedLoc = loc.trim()
                    // 进行更严格的模糊匹配
                    if (
                        trimmedLoc === pointName ||
                        trimmedLoc.includes(pointName) ||
                        pointName.includes(trimmedLoc)
                    ) {
                        locationMatch = true
                        break
                    }
                }
            }

            return locationMatch
        })

        // 如果没有找到匹配的时间线，显示提示并返回
        if (matchingTimelines.length === 0) {
            showTooltip(`未找到与 ${pointName} 相关的时间线数据`, pointCoord[0], pointCoord[1])
            return
        }

        console.log(
            `为地点 "${pointName}" 找到 ${matchingTimelines.length} 个匹配的时间线`,
            matchingTimelines
        )

        // 获取诗人出生年份
        const poetBirthYear = poetLifeStage.startYear || 0

        // 构建简化的悬浮窗内容（移除行程记录详情）
        let tooltipContent = `${poetLifeStage.poetName}在 "${pointName}"\n`

        // 对于每个匹配的时间线，寻找对应的生命阶段
        matchingTimelines.forEach((timeline) => {
            // 获取时间线的年份范围
            let timelineStartYear = timeline.start_year || 0
            let timelineEndYear = timeline.end_year || timelineStartYear || 0

            // 如果有明确的时间点，使用时间点中间值
            const timelineYear = (timelineStartYear + timelineEndYear) / 2
            // 计算对应时间线年份时，诗人的年龄
            const poetAge = timelineYear - poetBirthYear

            // 根据年龄确定生命阶段
            let matchingStage = null

            // 判断年龄属于哪个生命阶段
            if (poetAge >= 5 && poetAge <= 15) {
                matchingStage = poetLifeStage.stages.find((s) => s.stage_key === 'stage_child')
            } else if (poetAge > 15 && poetAge <= 25) {
                matchingStage = poetLifeStage.stages.find((s) => s.stage_key === 'stage_youth')
            } else if (poetAge > 25 && poetAge <= 40) {
                matchingStage = poetLifeStage.stages.find((s) => s.stage_key === 'stage_prime')
            } else if (poetAge > 40 && poetAge <= 60) {
                matchingStage = poetLifeStage.stages.find((s) => s.stage_key === 'stage_middle')
            } else if (poetAge > 60) {
                matchingStage = poetLifeStage.stages.find((s) => s.stage_key === 'stage_elder')
            }

            // 检查当前点是否为路径的起点或终点，并绘制连接线
            if (matchingStage && matchingStage.value > 0) {
                drawConnectionLine(
                    pointCoord[0],
                    pointCoord[1],
                    matchingStage.x,
                    matchingStage.y,
                    getColorByStage(matchingStage.stage_key)
                )
            }
        })

        // 显示悬浮窗
        showTooltip(tooltipContent, pointCoord[0], pointCoord[1])
    }

    // 匹配生命阶段到时间线点
    const matchLifeStageToTimeline = (stage, poetLifeStage, poetTimelines, getPoetData, showTooltip, getColorByStage) => {
        if (!myChart || !stage) return

        // 清除之前的连接线
        clearTimelineConnections()

        // 从生命阶段确定对应的年龄范围
        let minAge = 0,
            maxAge = 100
        switch (stage.stage_key) {
            case 'stage_child':
                minAge = 5
                maxAge = 15
                break
            case 'stage_youth':
                minAge = 16
                maxAge = 25
                break
            case 'stage_prime':
                minAge = 26
                maxAge = 40
                break
            case 'stage_middle':
                minAge = 41
                maxAge = 60
                break
            case 'stage_elder':
                minAge = 61
                maxAge = 100
                break
        }

        console.log(`正在为生命阶段 "${stage.name}" 匹配时间线数据`)

        // 计算诗人在这个生命阶段的年份范围
        const poetBirthYear = poetLifeStage.startYear || 0
        const stageStartYear = poetBirthYear + minAge
        const stageEndYear = poetBirthYear + maxAge

        console.log(
            `诗人出生年份: ${poetBirthYear}, 该生命阶段年份范围: ${stageStartYear}-${stageEndYear}`
        )

        // 获取当前选择的诗人信息，使用传入的getPoetData函数但不传入参数
        const poetData = getPoetData()
        const currentPoetName = poetData.poetInfo.name

        // 特殊处理曾懿的青年期地点连接
        let specialLocations = []

        // 如果是曾懿
        if (currentPoetName.includes('曾懿') && stage.stage_key === 'stage_youth') {
            // 仅指定路径的起点和终点，不包括其他地点
            specialLocations = ['成都', '赣州'] // 只保留起点和终点
        }

        // 构建简化的悬浮窗内容（只显示生命阶段信息，不显示行程记录）
        let tooltipContent = `${poetLifeStage.poetName} (${poetBirthYear}-${poetLifeStage.endYear})\n`
        tooltipContent += `${stage.name}(${minAge}-${maxAge}岁): ${stage.value}首\n`
        tooltipContent += `占总创作的${((stage.value / poetLifeStage.totalPoems) * 100).toFixed(1)}%\n`
        tooltipContent += `总创作: ${poetLifeStage.totalPoems}首`

        // 如果没有找到匹配的时间线，但有特殊地点
        if (specialLocations.length > 0) {
            // 获取生命阶段点的坐标
            const stageX = stage.x
            const stageY = stage.y

            // 获取地图上的所有点
            const geoSeries = myChart.getOption().series.find((s) => s.type === 'effectScatter')
            const geoData = geoSeries ? geoSeries.data : []

            // 连接特殊地点
            specialLocations.forEach((locationName) => {
                // 查找地图上匹配的点，使用更精确的匹配方式
                const matchingPoints = geoData.filter(
                    (point) =>
                        point.name &&
                        (point.name === locationName || // 精确匹配
                            // 避免部分匹配导致错误连接
                            (point.name.includes(locationName) && point.name.length <= locationName.length + 3))
                )

                matchingPoints.forEach((point) => {
                    const pointCoord = myChart.convertToPixel('geo', [point.value[0], point.value[1]])
                    if (pointCoord) {
                        // 在绘制连接线前记录日志，便于调试
                        console.log(`绘制从生命阶段点到地点 ${point.name} 的连接线`);
                        drawConnectionLine(
                            pointCoord[0],
                            pointCoord[1],
                            stageX,
                            stageY,
                            getColorByStage(stage.stage_key)
                        )
                    }
                })
            })
        }

        // 查找时间线中落在此年份范围内的事件
        const matchingTimelines = poetTimelines.filter((timeline) => {
            // 获取时间线的年份
            let timelineStartYear = timeline.start_year || 0
            let timelineEndYear = timeline.end_year || timelineStartYear || 0

            // 检查时间线年份是否落在生命阶段范围内
            const timelineOverlapsStage =
                (timelineStartYear >= stageStartYear && timelineStartYear <= stageEndYear) || // 开始年份在范围内
                (timelineEndYear >= stageStartYear && timelineEndYear <= stageEndYear) || // 结束年份在范围内
                (timelineStartYear <= stageStartYear && timelineEndYear >= stageEndYear) // 时间线完全覆盖阶段

            return timelineOverlapsStage
        })

        if (matchingTimelines.length > 0) {
            // 获取生命阶段点的坐标
            const stageX = stage.x
            const stageY = stage.y

            // 获取地图上的所有点
            const geoSeries = myChart.getOption().series.find((s) => s.type === 'effectScatter')
            const geoData = geoSeries ? geoSeries.data : []

            // 存储已处理的路径，避免重复显示
            const processedRoutes = new Set()

            // 存储所有找到的地点坐标和信息
            const foundLocations = []

            // 为每个匹配的时间线获取路径信息
            matchingTimelines.forEach((timeline) => {
                // 获取时间线中的地点信息
                const location = timeline.location || ''

                // 路径字符串，用于判断是否已处理过
                const routeKey =
                    timeline.time_period || `${timeline.start_year}-${timeline.end_year}: ${location}`

                // 如果已经处理过该路径，跳过
                if (processedRoutes.has(routeKey)) return
                processedRoutes.add(routeKey)

                // 处理地点字符串，分割为多个可能的地点
                let locationPoints = []

                // 检查是否包含箭头分隔符，这表示是一条路径
                if (location.includes('->')) {
                    locationPoints = location
                        .split('->')
                        .map((loc) => loc.trim())
                        .filter((loc) => loc)
                } else if (location.includes(',') || location.includes('，')) {
                    // 逗号分隔的多地点，也视为路径
                    locationPoints = location
                        .split(/[,，]/)
                        .map((loc) => loc.trim())
                        .filter((loc) => loc)
                } else if (location.trim()) {
                    // 单一地点
                    locationPoints = [location.trim()]
                }

                // 查找地图上匹配的点坐标
                locationPoints.forEach((locationName) => {
                    // 查找地图上匹配的点
                    const matchingPoints = geoData.filter(
                        (point) =>
                            point.name &&
                            (point.name === locationName ||
                                point.name.includes(locationName) ||
                                locationName.includes(point.name))
                    )

                    matchingPoints.forEach((point) => {
                        const pointCoord = myChart.convertToPixel('geo', [point.value[0], point.value[1]])
                        if (pointCoord) {
                            foundLocations.push({
                                name: point.name,
                                coord: pointCoord
                            })
                        }
                    })
                })
            })

            // 为找到的所有地点绘制连接线
            foundLocations.forEach((location, index) => {
                // 只对起点和终点绘制连接线
                if (index === 0 || index === foundLocations.length - 1) {
                    drawConnectionLine(
                        location.coord[0],
                        location.coord[1],
                        stageX,
                        stageY,
                        getColorByStage(stage.stage_key)
                    )
                }
            })

            // 如果发现多个地点，绘制它们之间的箭头路径
            if (foundLocations.length >= 2) {
                for (let i = 0; i < foundLocations.length - 1; i++) {
                    drawPathLine(
                        foundLocations[i].coord[0],
                        foundLocations[i].coord[1],
                        foundLocations[i + 1].coord[0],
                        foundLocations[i + 1].coord[1],
                        getColorByStage(stage.stage_key),
                        true // 启用箭头
                    )
                }
            }
        }

        // 显示悬浮窗
        showTooltip(tooltipContent, stage.x, stage.y)
    }

    return {
        activePoint,
        setChart,
        clearTimelineConnections,
        drawPathLine,
        drawConnectionLine,
        matchTimelineToLifeStage,
        matchLifeStageToTimeline
    }
} 