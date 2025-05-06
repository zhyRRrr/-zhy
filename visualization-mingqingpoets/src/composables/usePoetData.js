import { ref } from 'vue'
import axios from 'axios'
import {
    poetInfo as zengYiInfo,
    pointsData as zengYiPoints,
    routesData as zengYiRoutes
} from '../assets/data/mapData.js'
import {
    poetInfo as zongWanInfo,
    pointsData as zongWanPoints,
    routesData as zongWanRoutes
} from '../assets/data/mapDataZongWan.js'
import {
    poetInfo as zuoXijiaInfo,
    pointsData as zuoXijiaPoints,
    routesData as zuoXijiaRoutes
} from '../assets/data/mapDataZuoXijia.js'

// 初始点和终点的信息
const pathEndpoints = {
    1: {
        // 曾懿
        startPoint: '四川成都',
        endPoint: '北京'
    },
    2: {
        // 宗婉
        startPoint: '江苏常熟',
        endPoint: '山西'
    },
    3: {
        // 左錫嘉
        startPoint: '常州',
        endPoint: '山西定襄'
    }
}

export function usePoetData() {
    const selectedPoet = ref('0') // 默认显示全部诗人
    const selectedPoetName = ref('全部诗人') // 初始名称设为全部诗人
    const poetLifeData = ref([]) // 存储诗人生命阶段数据
    const selectedPoetLifeStage = ref(null) // 当前选中的诗人生命阶段数据
    const poetTimelines = ref([]) // 存储诗人时间线数据

    // 根据选择的诗人获取相应的数据
    const getPoetData = (poetId) => {
        console.log(`正在获取诗人ID=${poetId}的数据，当前选择的诗人名称=${selectedPoetName.value}`)

        // 优先使用诗人名称判断
        const poetName = selectedPoetName.value

        // 为避免显示提示信息混淆用户，提前声明自定义信息变量
        const customInfo = {
            ...zengYiInfo,
            name: poetName || `诗人${poetId}` // 优先使用名称，否则使用ID创建名称
        }

        // 如果有明确的诗人名称，根据名称选择数据
        if (poetName) {
            // 检查名称匹配
            if (poetName.includes('曾懿') || zengYiInfo.name.includes(poetName)) {
                console.log(`根据名称匹配到诗人: 曾懿`)
                return {
                    poetInfo: { ...zengYiInfo, name: poetName }, // 使用传入的名称
                    pointsData: zengYiPoints,
                    routesData: zengYiRoutes,
                    endpoints: pathEndpoints['1']
                }
            } else if (poetName.includes('宗婉') || zongWanInfo.name.includes(poetName)) {
                console.log(`根据名称匹配到诗人: 宗婉`)
                return {
                    poetInfo: { ...zongWanInfo, name: poetName }, // 使用传入的名称
                    pointsData: zongWanPoints,
                    routesData: zongWanRoutes,
                    endpoints: pathEndpoints['2']
                }
            } else if (poetName.includes('左錫嘉') || zuoXijiaInfo.name.includes(poetName)) {
                console.log(`根据名称匹配到诗人: 左錫嘉`)
                return {
                    poetInfo: { ...zuoXijiaInfo, name: poetName }, // 使用传入的名称
                    pointsData: zuoXijiaPoints,
                    routesData: zuoXijiaRoutes,
                    endpoints: pathEndpoints['3']
                }
            }
        }

        // 如果没有匹配名称，回退到使用ID匹配
        switch (poetId) {
            case '1':
                console.log(`匹配到诗人ID=1，对应曾懿`)
                return {
                    poetInfo: zengYiInfo,
                    pointsData: zengYiPoints,
                    routesData: zengYiRoutes,
                    endpoints: pathEndpoints['1']
                }
            case '2':
                console.log(`匹配到诗人ID=2，对应宗婉`)
                return {
                    poetInfo: zongWanInfo,
                    pointsData: zongWanPoints,
                    routesData: zongWanRoutes,
                    endpoints: pathEndpoints['2']
                }
            case '3':
                console.log(`匹配到诗人ID=3，对应左錫嘉`)
                return {
                    poetInfo: zuoXijiaInfo,
                    pointsData: zuoXijiaPoints,
                    routesData: zuoXijiaRoutes,
                    endpoints: pathEndpoints['3']
                }
            default:
                // 对于其他情况，返回自定义信息但不包含路径数据
                console.log(`未找到匹配诗人ID=${poetId}和名称=${poetName}的数据，使用空路径数据`)

                return {
                    poetInfo: customInfo,
                    pointsData: [], // 空点数据
                    routesData: [], // 空路径数据
                    endpoints: { startPoint: '', endPoint: '' } // 空起点终点
                }
        }
    }

    // 获取诗人生命阶段数据
    const fetchPoetLifeStageData = async (clearCallback) => {
        try {
            // 先清除旧数据
            poetLifeData.value = []
            selectedPoetLifeStage.value = null

            // 调用回调清除可视化元素
            if (clearCallback) {
                clearCallback()
            }

            // 检查是否为"全部诗人"
            const data = getPoetData(selectedPoet.value)
            const poetName = data.poetInfo.name

            // 如果是"全部诗人"，则直接返回，不获取和显示任何生命阶段数据
            if (selectedPoet.value === '0' || poetName.includes('全部诗人')) {
                console.log('选择了全部诗人，不显示生命阶段数据')
                return
            }

            console.log(`准备获取诗人: 名称=${poetName} 的生命阶段数据`)
            console.log(
                `获取诗人数据的URL: http://localhost:5000/api/poet_life_stages?poet_name=${encodeURIComponent(poetName)}`
            )

            // 只使用poet_name参数
            const response = await axios.get(
                `http://localhost:5000/api/poet_life_stages?poet_name=${encodeURIComponent(poetName)}`
            )

            console.log(`API响应状态:`, response.status)
            console.log(`API响应数据:`, response.data)

            if (response.data && response.data.status === 'success') {
                // 检查是否有数据
                if (!response.data.data || response.data.data.length === 0) {
                    console.error(`未找到诗人 ${poetName} 的生命阶段数据`)
                    return
                }

                poetLifeData.value = response.data.data
                console.log(`获取到 ${poetLifeData.value.length} 条诗人生命阶段数据:`, poetLifeData.value)

                // 如果只获取到一个特定诗人的数据，直接使用它
                if (poetLifeData.value.length === 1) {
                    selectedPoetLifeStage.value = poetLifeData.value[0]
                    console.log(`选择唯一的诗人数据: ${selectedPoetLifeStage.value.poetName}`)
                }
                // 如果获取到多个诗人的数据，尝试各种方式匹配当前选择的诗人
                else if (poetLifeData.value.length > 1) {
                    let found = null

                    // 优先通过诗人名称精确匹配
                    found = poetLifeData.value.find((p) => p.poetName === poetName)

                    // 如果没有找到，尝试模糊匹配诗人名称
                    if (!found) {
                        found = poetLifeData.value.find(
                            (p) =>
                                p.poetName &&
                                poetName &&
                                (p.poetName.includes(poetName) || poetName.includes(p.poetName))
                        )
                    }

                    // 如果找到了匹配的数据，使用它
                    if (found) {
                        selectedPoetLifeStage.value = found
                        console.log(
                            `找到匹配的诗人: ID=${found.id}, poetID=${found.poetID}, 名称=${found.poetName}`
                        )
                    }
                    // 否则仍使用第一条数据
                    else {
                        selectedPoetLifeStage.value = poetLifeData.value[0]
                        console.log(
                            `未找到匹配，使用第一条数据: ID=${poetLifeData.value[0].id}, poetID=${poetLifeData.value[0].poetID}, 名称=${poetLifeData.value[0].poetName}`
                        )
                    }
                }

                return selectedPoetLifeStage.value
            } else {
                console.error('获取诗人生命阶段数据失败:', response.data ? response.data : '无响应数据')
            }
        } catch (error) {
            console.error('API请求失败:', error)
        }

        return null
    }

    // 获取诗人时间线数据
    const fetchPoetTimelineData = async () => {
        try {
            // 获取当前选中诗人的信息
            const data = getPoetData(selectedPoet.value)
            const poetName = data.poetInfo.name

            // 如果是"全部诗人"，则直接返回，不获取和显示任何时间线数据
            if (selectedPoet.value === '0' || poetName.includes('全部诗人')) {
                console.log('选择了全部诗人，不显示时间线数据')
                poetTimelines.value = []
                return
            }

            console.log(`准备获取诗人: 名称=${poetName} 的时间线数据`)

            // 使用poet_name参数
            const response = await axios.get(
                `http://localhost:5000/api/poet_timelines?poet_name=${encodeURIComponent(poetName)}`
            )

            console.log(`时间线API响应状态:`, response.status)
            console.log(`时间线API响应数据:`, response.data)

            if (response.data && response.data.status === 'success') {
                // 检查是否有数据
                if (
                    !response.data.data ||
                    !response.data.data.timelines ||
                    response.data.data.timelines.length === 0
                ) {
                    console.error(`未找到诗人 ${poetName} 的时间线数据`)
                    poetTimelines.value = []
                    return
                }

                poetTimelines.value = response.data.data.timelines
                console.log(`获取到 ${poetTimelines.value.length} 条诗人时间线数据:`, poetTimelines.value)
                return poetTimelines.value
            } else {
                console.error('获取诗人时间线数据失败:', response.data ? response.data : '无响应数据')
            }
        } catch (error) {
            console.error('时间线API请求失败:', error)
        }

        poetTimelines.value = []
        return []
    }

    // 通过诗人名称获取时间线数据 - 用于诗人对比功能
    const fetchPoetTimelineByName = async (poetName) => {
        if (!poetName) {
            console.error('获取时间线数据失败: 缺少诗人名称')
            return null
        }

        try {
            console.log(`通过名称获取诗人 ${poetName} 的时间线数据`)

            const response = await axios.get(
                `http://localhost:5000/api/poet_timelines?poet_name=${encodeURIComponent(poetName)}`
            )

            console.log(`诗人 ${poetName} 时间线API响应:`, response.data)

            if (response.data && response.data.status === 'success') {
                // 检查是否有数据
                if (
                    !response.data.data ||
                    !response.data.data.timelines ||
                    response.data.data.timelines.length === 0
                ) {
                    console.error(`未找到诗人 ${poetName} 的时间线数据`)
                    return null
                }

                // 返回完整的响应数据，包括诗人信息和时间线
                return response.data.data
            } else {
                console.error(`获取诗人 ${poetName} 时间线数据失败:`,
                    response.data ? response.data : '无响应数据')
            }
        } catch (error) {
            console.error(`诗人 ${poetName} 时间线API请求失败:`, error)
        }

        return null
    }

    return {
        selectedPoet,
        selectedPoetName,
        poetLifeData,
        selectedPoetLifeStage,
        poetTimelines,
        getPoetData,
        fetchPoetLifeStageData,
        fetchPoetTimelineData,
        fetchPoetTimelineByName
    }
} 