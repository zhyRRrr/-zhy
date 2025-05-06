<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import mapSvg from '../assets/map.svg'

// 导入拆分后的composables
import { usePoetData } from '../composables/usePoetData'
import { useLifeStageVisualization } from '../composables/useLifeStageVisualization'
import { useTimelineConnections } from '../composables/useTimelineConnections'
import { useMapRenderer } from '../composables/useMapRenderer'
import { useAllPoetDistributions } from '../composables/allpoetdata/useAllPoetDistributions'
import {
  renderBackgroundTimePoints,
  clearBackgroundTimePoints
} from '../composables/allpoetdata/backgroundTimePoints'

// 引用chart DOM元素
const chartRef = ref(null)

// 使用全局诗词分布数据
const {
  allYearCounts,
  minYear: distributionMinYear,
  maxYear: distributionMaxYear,
  isLoading: distributionIsLoading
} = useAllPoetDistributions()

// 使用各个composables
const {
  selectedPoet,
  selectedPoetName,
  selectedPoetLifeStage,
  poetTimelines,
  getPoetData,
  fetchPoetLifeStageData,
  fetchPoetTimelineData,
  fetchPoetTimelineByName
} = usePoetData()

const {
  activeStage,
  setChart: setLifeStageChart,
  clearPoetLifeStageElements,
  showTooltip,
  getColorByStage,
  renderPoetLifeStages,
  fetchTimelineData,
  fetchPoetsData,
  renderAllPoetLifeSpans,
  fetchAllPoetsStageData,
  renderAllPoetsStageData,
  allPoetsStageData
} = useLifeStageVisualization()

const {
  activePoint,
  setChart: setTimelineChart,
  clearTimelineConnections,
  matchTimelineToLifeStage,
  matchLifeStageToTimeline
} = useTimelineConnections()

const {
  initChart,
  getChart,
  clearImageLayers,
  renderMap,
  setupPointHoverEvents,
  resizeChart,
  renderPlaceBubbles,
  renderHeatmap
} = useMapRenderer()

// 比较模式变量
const compareMode = ref(false)
const poetsForCompare = ref([])
const poet1Data = ref(null)
const poet2Data = ref(null)

// 多选诗人模式
const multiSelectMode = ref(false)
const selectedPoets = ref([])

// 初始化图表
function initializeChart() {
  const myChart = initChart(chartRef)

  // 设置各个composable的chart引用
  setLifeStageChart(myChart)
  setTimelineChart(myChart)

  // 初始化显示默认诗人的数据
  const data = getPoetData(selectedPoet.value)
  renderMap(data.poetInfo, data.pointsData, data.routesData, data.endpoints)

  // 检查初始状态是否为"全部诗人"并渲染热力图
  if (selectedPoet.value === '0') {
    console.log('初始状态为全部诗人，渲染热力图')
    renderHeatmap()
    // 清除背景时间点（全部诗人模式下不需要）
    clearBackgroundTimePoints(myChart.getZr())
  }
  // 你可以根据需要在这里添加 else if 来处理其他初始状态（如果需要）

  // 设置点悬停事件处理
  setupPointHoverEvents((type, point, layerType) => {
    if (type === 'hover') {
      // 仅在轨迹点悬停时尝试匹配
      if (layerType === 'trace' && selectedPoetLifeStage.value && poetTimelines.value.length > 0) {
        matchTimelineToLifeStage(
          point,
          selectedPoetLifeStage.value,
          poetTimelines.value,
          showTooltip,
          getColorByStage
        )
      }
    } else if (type === 'leave') {
      // 仅在轨迹点离开时清除（如果不是因为移动到了生命阶段点）
      if (layerType === 'trace' && !activeStage.value) {
        clearTimelineConnections()
      }
    }
  })

  // 注册窗口调整大小事件
  window.addEventListener('resize', resizeChart)
}

// 更新图表
function updateChart() {
  const myChart = getChart()
  if (myChart) {
    // 清除之前的图层
    clearImageLayers()
    clearPoetLifeStageElements()
    clearTimelineConnections()

    if (compareMode.value && poetsForCompare.value.length === 2) {
      // 比较模式下显示两位诗人数据
      renderComparisonMap()

      // 清除背景时间点（比较模式下不需要）
      clearBackgroundTimePoints(myChart.getZr())
    } else {
      // 单诗人模式 或 全部诗人/多选模式
      const data = getPoetData(selectedPoet.value)
      renderMap(data.poetInfo, data.pointsData, data.routesData, data.endpoints)

      // 根据模式渲染地点分布（热力图或泡沫图）
      if (selectedPoet.value === '0' || selectedPoet.value === 0) {
        console.log('全部诗人模式：渲染地点热力图')
        renderHeatmap() // 调用热力图渲染函数
        // 清除背景时间点（全部诗人模式下不需要）
        clearBackgroundTimePoints(myChart.getZr())
      }
      // 如果是多选诗人模式，渲染选中诗人的泡沫图
      else if (multiSelectMode.value && selectedPoets.value.length > 0) {
        console.log('多选诗人模式：渲染选中诗人的泡沫图')
        renderPlaceBubbles(selectedPoets.value) // 传递选中的诗人列表
        // 清除背景时间点（多选模式下不需要）
        clearBackgroundTimePoints(myChart.getZr())
      }

      // 如果有生命阶段数据，渲染生命阶段 (仅在单选诗人时有效)
      if (selectedPoet.value !== '0' && selectedPoetLifeStage.value) {
        renderPoetLifeStages(
          selectedPoetLifeStage.value,
          selectedPoetName.value || data.poetInfo.name,
          selectedPoet.value
        )
      }

      // 在单选特定诗人模式下渲染背景灰色时间点
      if (selectedPoet.value !== '0' && !multiSelectMode.value) {
        // 检查全局诗词分布数据是否已加载
        if (
          !distributionIsLoading.value &&
          allYearCounts.value &&
          distributionMinYear.value !== null &&
          distributionMaxYear.value !== null
        ) {
          console.log('单选诗人模式：渲染背景灰色时间点')
          const zr = myChart.getZr()
          const elements = []
          const center = [400, 300]
          const baseRadius = 160 // 注意：这里的半径可能需要调整以匹配背景时间点

          // 创建时间线数据对象
          const timelineData = {
            allYearCounts: allYearCounts.value,
            minYear: distributionMinYear.value,
            maxYear: distributionMaxYear.value
          }

          // 渲染背景灰色时间点
          renderBackgroundTimePoints(zr, elements, center, baseRadius, timelineData)
        }
      }
    }
  }
}

// 渲染比较模式地图
function renderComparisonMap() {
  if (!poet1Data.value || !poet2Data.value) {
    console.warn('比较模式缺少诗人数据')
    return
  }

  const myChart = getChart()
  if (!myChart) return

  // 合并诗人信息
  const combinedInfo = {
    name: `${poet1Data.value.poetInfo.name} vs ${poet2Data.value.poetInfo.name}`,
    periods: [
      ...(poet1Data.value.poetInfo.periods || []),
      ...(poet2Data.value.poetInfo.periods || [])
    ]
  }

  // 标记两位诗人的数据点和路线，添加不同颜色
  const poet1Color = '#FF5722' // 橙色
  const poet2Color = '#2196F3' // 蓝色

  // 为第一位诗人数据添加时间线信息
  const poet1TimelineData = poet1Data.value.poetTimelineData || null
  const enhancedPoet1Points = poet1Data.value.pointsData.map((point) => {
    // 寻找匹配的时间线数据
    let timeInfo = null
    if (poet1TimelineData && poet1TimelineData.timelines) {
      timeInfo = poet1TimelineData.timelines.find(
        (timeline) => timeline.location && timeline.location.includes(point.name)
      )
    }

    return {
      ...point,
      itemStyle: {
        color: poet1Color,
        borderColor: '#fff',
        borderWidth: 1
      },
      symbol: 'circle',
      symbolSize: 8,
      poetId: poetsForCompare.value[0].id,
      poetName: poetsForCompare.value[0].name,
      // 只添加时间信息
      time: timeInfo ? timeInfo.time_period : null
    }
  })

  // 为第二位诗人数据添加时间线信息
  const poet2TimelineData = poet2Data.value.poetTimelineData || null
  const enhancedPoet2Points = poet2Data.value.pointsData.map((point) => {
    // 寻找匹配的时间线数据
    let timeInfo = null
    if (poet2TimelineData && poet2TimelineData.timelines) {
      timeInfo = poet2TimelineData.timelines.find(
        (timeline) => timeline.location && timeline.location.includes(point.name)
      )
    }

    return {
      ...point,
      itemStyle: {
        color: poet2Color,
        borderColor: '#fff',
        borderWidth: 1
      },
      symbol: 'circle',
      symbolSize: 8,
      poetId: poetsForCompare.value[1].id,
      poetName: poetsForCompare.value[1].name,
      // 只添加时间信息
      time: timeInfo ? timeInfo.time_period : null
    }
  })

  // 合并点
  const combinedPoints = [...enhancedPoet1Points, ...enhancedPoet2Points]

  // 为诗人1路线添加颜色标记
  const poet1Routes = poet1Data.value.routesData.map((route) => ({
    ...route,
    lineStyle: {
      ...route.lineStyle,
      color: poet1Color,
      width: 3,
      type: 'solid',
      opacity: 0.8
    },
    effect: {
      show: true,
      period: 6,
      trailLength: 0.5,
      color: '#fff',
      symbolSize: 4
    },
    poetId: poetsForCompare.value[0].id,
    poetName: poetsForCompare.value[0].name
  }))

  // 为诗人2路线添加颜色标记
  const poet2Routes = poet2Data.value.routesData.map((route) => ({
    ...route,
    lineStyle: {
      ...route.lineStyle,
      color: poet2Color,
      width: 3,
      type: 'solid',
      opacity: 0.8
    },
    effect: {
      show: true,
      period: 6,
      trailLength: 0.5,
      color: '#fff',
      symbolSize: 4
    },
    poetId: poetsForCompare.value[1].id,
    poetName: poetsForCompare.value[1].name
  }))

  // 合并路线
  const combinedRoutes = [...poet1Routes, ...poet2Routes]

  // 合并终点 - 确保以数组形式传递
  const combinedEndpoints = [poet1Data.value.endpoints, poet2Data.value.endpoints]

  // 渲染地图
  renderMap(combinedInfo, combinedPoints, combinedRoutes, combinedEndpoints)

  // 添加图例和标题
  myChart.setOption({
    title: {
      text: `诗人轨迹对比: ${poetsForCompare.value[0].name} vs ${poetsForCompare.value[1].name}`,
      subtext: '诗人生平移动轨迹比较',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333'
      },
      subtextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    legend: {
      data: [
        {
          name: poetsForCompare.value[0].name,
          icon: 'circle',
          itemStyle: { color: poet1Color }
        },
        {
          name: poetsForCompare.value[1].name,
          icon: 'circle',
          itemStyle: { color: poet2Color }
        }
      ],
      bottom: 10,
      left: 'center',
      selectedMode: 'multiple',
      textStyle: {
        color: '#333',
        fontSize: 14
      },
      itemGap: 30,
      itemWidth: 12,
      itemHeight: 12,
      borderColor: '#ccc',
      borderWidth: 1,
      borderRadius: 5,
      padding: [5, 10],
      backgroundColor: 'rgba(255,255,255,0.8)'
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.data && params.data.poetName) {
          return `<div class="tooltip-content">
            <div class="tooltip-title">${params.data.poetName}</div>
            <div class="tooltip-info">地点: ${params.name}</div>
            ${params.data.time ? `<div class="tooltip-info">时间: ${params.data.time}</div>` : ''}
          </div>`
        }
        return params.name
      }
    }
  })
}

// 获取两位诗人的比较数据
async function fetchComparisonData() {
  if (poetsForCompare.value.length !== 2) return

  try {
    // 获取两位诗人信息
    const poet1Name = poetsForCompare.value[0].name
    const poet2Name = poetsForCompare.value[1].name
    console.log(`开始获取对比数据: ${poet1Name} vs ${poet2Name}`)

    // 清除现有数据
    poet1Data.value = null
    poet2Data.value = null

    // 通过名称获取诗人时间线数据
    const poet1Timeline = await fetchPoetTimelineByName(poet1Name)
    const poet2Timeline = await fetchPoetTimelineByName(poet2Name)

    // 获取基础地图数据
    const baseDataPoet1 = getPoetData(poetsForCompare.value[0].id.toString())
    const baseDataPoet2 = getPoetData(poetsForCompare.value[1].id.toString())

    // 处理时间线数据，确保与地图点关联
    if (poet1Timeline && poet1Timeline.timelines && poet1Timeline.timelines.length > 0) {
      console.log(`成功获取诗人 ${poet1Name} 的时间线数据:`, poet1Timeline)

      // 合并API获取的时间线数据和基础地图数据
      poet1Data.value = {
        ...baseDataPoet1,
        poetTimelineData: poet1Timeline
      }
    } else {
      console.warn(`未获取到诗人 ${poet1Name} 的时间线数据，使用基础数据`)
      poet1Data.value = baseDataPoet1
    }

    if (poet2Timeline && poet2Timeline.timelines && poet2Timeline.timelines.length > 0) {
      console.log(`成功获取诗人 ${poet2Name} 的时间线数据:`, poet2Timeline)

      // 合并API获取的时间线数据和基础地图数据
      poet2Data.value = {
        ...baseDataPoet2,
        poetTimelineData: poet2Timeline
      }
    } else {
      console.warn(`未获取到诗人 ${poet2Name} 的时间线数据，使用基础数据`)
      poet2Data.value = baseDataPoet2
    }

    // 确认数据
    console.log('诗人1数据完成设置:', poet1Data.value)
    console.log('诗人2数据完成设置:', poet2Data.value)

    // 更新地图显示比较数据
    updateChart()
  } catch (error) {
    console.error('获取比较数据失败:', error)

    // 出错时使用基础数据
    const baseDataPoet1 = getPoetData(poetsForCompare.value[0].id.toString())
    const baseDataPoet2 = getPoetData(poetsForCompare.value[1].id.toString())

    poet1Data.value = baseDataPoet1
    poet2Data.value = baseDataPoet2

    console.log('出错后使用基础数据')
    updateChart()
  }
}

// 更新诗人生命阶段可视化
const updatePoetLifeStageVisual = () => {
  if (getChart() && selectedPoetLifeStage.value) {
    // 清除之前的生命阶段可视化元素
    clearPoetLifeStageElements()

    // 重新渲染
    const currentPoetName = selectedPoetName.value || getPoetData(selectedPoet.value).poetInfo.name
    renderPoetLifeStages(selectedPoetLifeStage.value, currentPoetName)
  }
}

// 处理诗人变更事件
const handlePoetChangedEvent = (event) => {
  console.log(`监听到poet-changed事件，完整事件详情:`, event)
  console.log(`监听到poet-changed事件的详情数据:`, event.detail)

  if (event.detail) {
    // 更新selectedPoet值，优先使用名称
    const poetName = event.detail.name || event.detail.poet
    const poetId = event.detail.id

    if (poetName) {
      console.log(`诗人变更为: 名称=${poetName}, ID=${poetId}`)

      // 重置比较模式
      compareMode.value = false
      poetsForCompare.value = []
      // 重置多选模式相关状态
      multiSelectMode.value = false
      selectedPoets.value = []

      // 更新选择的诗人ID和名称
      selectedPoet.value = poetId ? poetId.toString() : '0'
      selectedPoetName.value = poetName

      // 清除当前的生命阶段可视化元素和连接线
      clearPoetLifeStageElements()
      clearTimelineConnections()

      // 重置选中的诗人生命阶段数据，避免显示旧数据
      selectedPoetLifeStage.value = null

      // 如果是全部诗人，清空时间线数据
      if (poetId === 0 || poetId === '0' || poetName.includes('全部诗人')) {
        poetTimelines.value = []
        console.log('切换到全部诗人，清除生命阶段和时间线数据')

        // 清除背景时间点（全部诗人模式下不需要）
        const myChart = getChart()
        if (myChart) {
          clearBackgroundTimePoints(myChart.getZr())
        }

        // 更新图表以显示热力图
        updateChart()

        // 修复：获取全部诗人的时间线数据、生命线等，但不需要重新渲染生命阶段
        fetchTimelineData('0')
        setTimeout(() => {
          fetchPoetsData().then(() => {
            // 热力图已在updateChart中渲染，这里仅渲染生命线和统计
            renderAllPoetLifeSpans() // 渲染所有生命线
            fetchAllPoetsStageData().then(() => {
              // 获取并渲染全部诗人统计
              if (allPoetsStageData.value) {
                renderAllPoetsStageData()
              }
            })
          })
        }, 200)
        return
      }

      // 更新图表 (会渲染背景时间点)
      updateChart()

      // 当选择诗人变化时，重新获取该诗人的生命阶段数据和事件数据
      console.log(`准备重新获取诗人 ${poetName} 的生命阶段数据和事件数据`)
      // 添加短暂延时确保异步操作顺序正确
      setTimeout(() => {
        fetchPoetLifeStageData(clearPoetLifeStageElements)
        fetchPoetTimelineData() // 获取单个诗人的时间线
        // 背景点已在 updateChart 中处理
      }, 200)
    } else {
      console.warn('收到的poet-changed事件缺少必要的诗人名称信息:', event)
    }
  } else {
    console.warn('收到的poet-changed事件缺少必要的详情信息:', event)
  }
}

// 处理诗人比较事件
const handlePoetsCompareEvent = (event) => {
  console.log('监听到poets-compare事件:', event.detail)

  if (event.detail && event.detail.enabled && event.detail.poets) {
    const poets = event.detail.poets

    // 启用比较模式
    compareMode.value = true
    poetsForCompare.value = poets

    // 清除当前的生命阶段可视化元素和连接线
    clearPoetLifeStageElements()
    clearTimelineConnections()

    // 清除单诗人数据
    selectedPoetLifeStage.value = null

    // 清除背景时间点（比较模式下不需要）
    const myChart = getChart()
    if (myChart) {
      clearBackgroundTimePoints(myChart.getZr())
    }

    // 获取比较数据并更新地图
    fetchComparisonData()
  }
}

// 处理诗人对比变更事件
const handlePoetsComparisonChangedEvent = (event) => {
  console.log('监听到poets-comparison-changed事件:', event.detail)

  if (event.detail && event.detail.poets && event.detail.poets.length === 2) {
    // 获取两位诗人信息
    const poets = event.detail.poets

    // 启用比较模式
    compareMode.value = true
    poetsForCompare.value = poets

    // 清除当前的生命阶段可视化元素和连接线
    clearPoetLifeStageElements()
    clearTimelineConnections()

    // 清除单诗人数据
    selectedPoetLifeStage.value = null

    // 清除背景时间点（比较模式下不需要）
    const myChart = getChart()
    if (myChart) {
      clearBackgroundTimePoints(myChart.getZr())
    }

    // 获取比较数据并更新地图
    fetchComparisonData()
  } else if (event.detail && (!event.detail.poets || event.detail.poets.length === 0)) {
    // 如果选择了空选项，则退出比较模式
    compareMode.value = false
    poetsForCompare.value = []
    updateChart()
  }
}

// 处理比较模式变更事件
const handleCompareModeChangedEvent = (event) => {
  console.log('监听到compare-mode-changed事件:', event.detail)

  if (event.detail && !event.detail.enabled) {
    // 禁用比较模式
    compareMode.value = false
    poetsForCompare.value = []

    // 清除当前的生命阶段可视化元素和连接线
    clearPoetLifeStageElements()
    clearTimelineConnections()

    // 更新图表恢复到单诗人模式
    updateChart()
  }
}

// 监听诗人多选模式变化
const handleMultiSelectModeChanged = (event) => {
  console.log('接收到多选模式变更事件:', event.detail)
  const isEnabled = event.detail.enabled
  multiSelectMode.value = isEnabled

  if (isEnabled) {
    // 进入多选模式
    console.log('进入多选模式，清除单诗人可视化...')
    compareMode.value = false // 确保比较模式关闭
    selectedPoetLifeStage.value = null // 清除可能残留的单诗人生命阶段数据
    poetTimelines.value = [] // 清除可能残留的单诗人时间线数据
    selectedPoet.value = '' // 清除当前选中的单诗人ID
    selectedPoetName.value = '' // 清除当前选中的单诗人名称

    // 如果之前有选中的多选诗人，保留列表，否则清空
    // selectedPoets.value = []; // 由 poets-multi-selected 事件更新

    // 清除 ECharts 上的图形元素
    clearPoetLifeStageElements()
    clearTimelineConnections()
    clearImageLayers()

    // 清除背景时间点（多选模式下不需要）
    const myChart = getChart()
    if (myChart) {
      clearBackgroundTimePoints(myChart.getZr())
    }

    // 重新渲染一个干净的地图（无路径）
    renderMap(null, [], [], [])

    // 等待用户通过 poets-multi-selected 事件触发新的渲染
  } else {
    // 退出多选模式
    console.log('退出多选模式，等待 poet-changed 事件来更新视图')
    // 如果之前有选中的多选诗人，清除列表
    if (selectedPoets.value.length > 0) {
      selectedPoets.value = []
    }
  }
}

// 处理多选诗人变化
const handlePoetsMultiSelected = (event) => {
  const poets = event.detail.poets
  console.log('接收到多个诗人选择事件:', poets)

  if (poets && poets.length > 0) {
    // 确保id字段是数字类型
    const normalizedPoets = poets.map((poet) => ({
      ...poet,
      id: Number(poet.id) // 确保ID是数字类型
    }))

    selectedPoets.value = normalizedPoets
    multiSelectMode.value = true // 确保处于多选模式

    console.log(
      `选中了 ${normalizedPoets.length} 位诗人:`,
      normalizedPoets.map((p) => `${p.name}(ID:${p.id})`)
    )

    // 切换视图显示这些选中的诗人
    if (renderAllPoetLifeSpans) {
      // 清除之前的元素
      clearPoetLifeStageElements()
      clearTimelineConnections()
      clearImageLayers() // 清除地图轨迹等

      // 清除背景时间点
      const myChart = getChart()
      if (myChart) {
        clearBackgroundTimePoints(myChart.getZr())
      }

      // 重新渲染基础地图
      renderMap(null, [], [], [])

      // 先渲染生命线
      console.log('正在渲染选中诗人的生命线...')
      renderAllPoetLifeSpans(selectedPoets.value)

      // 渲染选中诗人的泡沫图
      console.log('正在渲染选中诗人的泡沫图...')
      renderPlaceBubbles(selectedPoets.value)

      // 获取并显示选中诗人的统计数据
      console.log('正在获取选中诗人的统计数据...')
      fetchAllPoetsStageData(selectedPoets.value).then((data) => {
        if (data) {
          console.log(
            '获取到选中诗人的统计数据，进行渲染:',
            data.stages.map((s) => `${s.name}: ${s.value}`)
          )
          renderAllPoetsStageData()
        } else {
          console.error('未获取到选中诗人的统计数据')
        }
      })
    } else {
      console.error('renderAllPoetLifeSpans 函数不可用，无法渲染选中诗人')
    }
  }
}

onMounted(() => {
  // 添加全局事件监听 - 这些监听器用于接收来自外部组件的诗人选择数据
  window.addEventListener('poet-changed', handlePoetChangedEvent)
  window.addEventListener('poets-compare', handlePoetsCompareEvent)
  window.addEventListener('poets-comparison-changed', handlePoetsComparisonChangedEvent)
  window.addEventListener('compare-mode-changed', handleCompareModeChangedEvent)
  window.addEventListener('multi-select-mode-changed', handleMultiSelectModeChanged)
  window.addEventListener('poets-multi-selected', handlePoetsMultiSelected)

  // 保存引用以便在卸载时使用，使用自定义属性来存储
  window.poetChangedHandler = handlePoetChangedEvent
  window.poetsCompareHandler = handlePoetsCompareEvent
  window.poetsComparisonChangedHandler = handlePoetsComparisonChangedEvent
  window.compareModeChangedHandler = handleCompareModeChangedEvent

  // 获取诗人生命阶段数据
  fetchPoetLifeStageData(clearPoetLifeStageElements)

  // 获取诗人时间线数据
  fetchPoetTimelineData()

  // 初始化图表
  initializeChart()
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  // 正确地移除事件监听器，使用相同的函数引用
  if (window.poetChangedHandler) {
    window.removeEventListener('poet-changed', window.poetChangedHandler)
    window.poetChangedHandler = null
  }

  // 移除诗人比较事件监听器
  if (window.poetsCompareHandler) {
    window.removeEventListener('poets-compare', window.poetsCompareHandler)
    window.poetsCompareHandler = null
  }

  // 移除诗人对比变更事件监听器
  if (window.poetsComparisonChangedHandler) {
    window.removeEventListener('poets-comparison-changed', window.poetsComparisonChangedHandler)
    window.poetsComparisonChangedHandler = null
  }

  // 移除比较模式变更事件监听器
  if (window.compareModeChangedHandler) {
    window.removeEventListener('compare-mode-changed', window.compareModeChangedHandler)
    window.compareModeChangedHandler = null
  }

  // 移除多选模式相关事件监听器
  window.removeEventListener('multi-select-mode-changed', handleMultiSelectModeChanged)
  window.removeEventListener('poets-multi-selected', handlePoetsMultiSelected)

  // 移除窗口调整大小事件
  window.removeEventListener('resize', resizeChart)
})

// 监听比较模式变化
watch(compareMode, (newVal) => {
  if (!newVal) {
    // 退出比较模式时，清除比较数据
    poet1Data.value = null
    poet2Data.value = null
  }
})

// 监听生命阶段数据变化，更新可视化
watch(selectedPoetLifeStage, () => {
  if (selectedPoetLifeStage.value) {
    updatePoetLifeStageVisual()
  }
})

// 将activeStage和activePoint连接起来，以便实现交互
watch(activeStage, (newVal, oldVal) => {
  if (newVal && poetTimelines.value.length > 0) {
    // 当生命阶段点被激活时，匹配时间线
    matchLifeStageToTimeline(
      newVal,
      selectedPoetLifeStage.value,
      poetTimelines.value,
      getPoetData,
      showTooltip,
      getColorByStage
    )
  } else if (!newVal && oldVal) {
    // 当生命阶段点不再被激活时，清除连接线
    clearTimelineConnections()
  }
})

watch(activePoint, (newVal, oldVal) => {
  if (newVal && selectedPoetLifeStage.value) {
    // 当地图点被激活时，匹配生命阶段
    matchTimelineToLifeStage(
      newVal,
      selectedPoetLifeStage.value,
      poetTimelines.value,
      showTooltip,
      getColorByStage
    )
  } else if (!newVal && oldVal) {
    // 当地图点不再被激活时，清除连接线
    clearTimelineConnections()
  }
})
</script>

<template>
  <div class="map-container">
    <img :src="mapSvg" alt="Map Icon" class="map-icon" />
    <div ref="chartRef" class="map"></div>
  </div>
</template>

<style scoped>
.map-container {
  position: relative; /* 父容器需要相对定位 */
  width: 700px;
  height: 700px;
}

.map {
  position: relative;
  width: 100%; /* 让地图占满父容器 */
  height: 100%;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin: 0 auto;
  transition: all 0.3s ease;
}

.map-icon {
  position: absolute;
  top: 10px; /* 距离顶部10px */
  left: -20px; /* 距离左侧10px */
  width: 200px; /* 设置合适的宽度 */
  height: 200px; /* 设置合适的高度 */
  z-index: 10; /* 确保图标在地图上层 */
  opacity: 1; /* 可以设置一些透明度 */
}

/* 自定义tooltip样式 - 这些样式会被ECharts使用 */
:deep(.tooltip-content) {
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  max-width: 240px;
  border: 1px solid #555;
}

:deep(.tooltip-title) {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 6px;
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
}

:deep(.tooltip-info) {
  font-size: 14px;
  color: #eee;
  margin: 4px 0;
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .map {
    width: 100%;
    height: 500px;
  }
}
</style>
