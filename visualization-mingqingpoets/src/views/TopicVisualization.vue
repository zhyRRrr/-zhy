<script setup>
import { ref, onMounted, reactive, nextTick, computed, watch } from 'vue'
import * as echarts from 'echarts'
import { useHighlightStore } from '@/stores/highlightStore'
import { storeToRefs } from 'pinia'

// 图表容器引用
const chartRef = ref(null)
const chartInstance = ref(null)

// 数据状态
const state = reactive({
  loading: false,
  topicData: [],
  selectedPoint: null,
  checkedTopics: [0, 1, 2, 3] // 默认所有主题都被选中
})

// 主题映射配置
const topicConfig = {
  names: {
    0: '主题0',
    1: '主题1',
    2: '主题2',
    3: '主题3'
  },
  colors: {
    0: '#e8614c',
    1: '#f1b555',
    2: '#5da5da',
    3: '#60bd68'
  },
  maskColor: '#d3d3d3',
  maskOpacity: 0.1,
  maskSymbolSize: 3,
  internalGreyColor: '#bbbbbb',
  internalGreyOpacity: 0.5,
  internalGreySymbolSize: 8
}

// WebSocket连接
const ws = ref(null)
const wsConnected = ref(false)

// 高亮状态管理
const highlightStore = useHighlightStore()
const { isHighlightActive, selectedTopics } = storeToRefs(highlightStore)

// 监听高亮状态或选中列表变化，触发重新渲染
watch(
  [isHighlightActive, selectedTopics],
  () => {
    if (chartInstance.value && state.topicData.length > 0) {
      console.log('Highlight state or selected topics changed, rerendering topic chart...')
      renderChart()
    }
  },
  { deep: true } // deep: true 确保能监听到 selectedTopics 数组内部的变化
)

// 连接WebSocket
const connectWebSocket = () => {
  ws.value = new WebSocket('ws://localhost:6789')

  ws.value.onopen = () => {
    console.log('WebSocket连接已建立')
    wsConnected.value = true
    fetchTopicData()
  }

  ws.value.onclose = () => {
    console.log('WebSocket连接已关闭')
    wsConnected.value = false
  }

  ws.value.onerror = (error) => {
    console.error('WebSocket错误:', error)
    wsConnected.value = false
  }

  ws.value.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data)

      if (response.type === 'topic_data' && response.success) {
        handleTopicDataReceived(response.data)
      } else if (response.type === 'poem_data' && response.success) {
        // 处理诗歌数据
        console.log('获取到诗歌数据:', response.data)
      } else if (!response.success) {
        console.error('API请求失败:', response.message)
      }
    } catch (e) {
      console.error('解析WebSocket消息时出错:', e)
    }
  }
}

// 获取主题可视化数据
const fetchTopicData = () => {
  if (!wsConnected.value) {
    console.error('WebSocket未连接')
    return
  }

  state.loading = true

  const request = {
    action: 'get_topic_data',
    filter: {
      limit: 8000 // 获取足够的数据点
    }
  }

  ws.value.send(JSON.stringify(request))
}

// 处理接收到的主题数据
const handleTopicDataReceived = (data) => {
  console.log(`接收到${data.length}个主题数据点`)
  state.topicData = data
  state.loading = false

  if (data.length > 0) {
    renderChart()
  }
}

// 根据主题编号获取主题名称
const getTopicName = (topicId) => {
  return topicConfig.names[topicId] || `未知主题(${topicId})`
}

// 处理点击事件
const handlePointClick = (params) => {
  // 获取点击点的完整数据
  const pointData = params.data.originalData

  // 设置当前选中的点
  state.selectedPoint = pointData

  // 触发自定义事件，传递诗歌ID
  if (pointData && pointData.poem_id) {
    const topicIdx = getDominantTopicIndex(pointData)
    console.log(
      `TopicVisualization - 散点图点击：诗歌ID = ${pointData.poem_id}, 主题 = ${topicIdx}`
    )

    // 发送自定义事件，传递诗歌ID和主题信息
    window.dispatchEvent(
      new CustomEvent('topic-point-clicked', {
        detail: {
          poemId: pointData.poem_id,
          topicLabel: topicIdx,
          topicName: getTopicName(topicIdx)
        }
      })
    )
  }
}

// 获取点的主导主题索引
const getDominantTopicIndex = (item) => {
  try {
    const vector = JSON.parse(item.vector_json || '[]')
    if (!vector || vector.length === 0) return -1
    return vector.indexOf(Math.max(...vector))
  } catch (e) {
    console.warn('Error parsing vector_json for dominant topic:', item.vector_json, e)
    return -1
  }
}

// 渲染ECharts图表
const renderChart = async () => {
  await nextTick()
  if (!chartRef.value) return

  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  chartInstance.value = echarts.init(chartRef.value)
  chartInstance.value.showLoading()

  const topicSeries = [0, 1, 2, 3].map((topicIndex) => {
    const filteredData = state.topicData
      .filter((item) => getDominantTopicIndex(item) === topicIndex)
      .map((item) => {
        // 1. 获取内部选中状态
        const isCheckedInternal = state.checkedTopics.includes(topicIndex)

        // 2. 获取外部选中状态
        const isSelectedExternal = selectedTopics.value.includes(topicIndex)
        const applyMask = isHighlightActive.value && !isSelectedExternal

        // 3. 决定最终样式
        let finalColor, finalOpacity, finalSize, finalZ

        if (applyMask) {
          // 优先应用外部遮罩 (修改为与内部灰色一致)
          finalColor = topicConfig.internalGreyColor
          finalOpacity = topicConfig.internalGreyOpacity
          finalSize = topicConfig.internalGreySymbolSize
          finalZ = 1 // 层级与内部灰色一致
        } else if (!isCheckedInternal) {
          // 如果外部没遮罩，但内部未选中，则显示内部灰色 (保持不变)
          finalColor = topicConfig.internalGreyColor
          finalOpacity = topicConfig.internalGreyOpacity
          finalSize = topicConfig.internalGreySymbolSize
          finalZ = 1 // 中间层
        } else {
          // 内部选中且外部未遮罩
          finalColor = topicConfig.colors[topicIndex]
          finalOpacity = 0.7
          finalSize = 10
          finalZ = 2 // 最上层
        }

        return {
          name: getTopicName(topicIndex),
          value: [item.umap_x, item.umap_y],
          itemStyle: {
            color: finalColor,
            opacity: finalOpacity
          },
          symbolSize: finalSize,
          originalData: item,
          z: finalZ
        }
      })

    return {
      name: getTopicName(topicIndex),
      type: 'scatter',
      symbolSize: 10,
      data: filteredData,
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          opacity: 0.9
        },
        scale: 1.2
      }
    }
  })

  // 图表 Option 配置
  const option = {
    title: {
      text: '主题降维可视化',
      subtext: '基于UMAP降维的主题分布',
      left: 'center'
    },
    legend: {
      show: false
    },
    grid: {
      left: '5%',
      right: '3%',
      top: '10%',
      bottom: '5%'
    },
    tooltip: {
      trigger: 'item',
      formatter: function (params) {
        if (params.data && params.data.originalData) {
          const data = params.data.originalData
          const topicIdx = getDominantTopicIndex(data)
          let highlightStatus = ''
          if (isHighlightActive.value) {
            const isHighlightedExternal = selectedTopics.value.includes(topicIdx)
            highlightStatus = isHighlightedExternal ? '(外部高亮)' : '(外部未选)'
          }
          const vector = JSON.parse(data.vector_json || '[]')
          let vectorHtml = ''
          if (vector && vector.length > 0) {
            for (let i = 0; i < vector.length; i++) {
              vectorHtml += `<div>主题${i}: ${vector[i] ? Number(vector[i]).toFixed(3) : 'N/A'}</div>`
            }
          }
          return `
            <div style="font-weight:bold;margin-bottom:5px;">主题：${params.name} ${highlightStatus}</div>
            ${vectorHtml}
            <div>诗词ID：${data.poem_id}</div>
            <div>聚类：${data.cluster_label}</div>
          `
        }
        return `主题: ${params.name}<br/>坐标: (${params.value[0].toFixed(2)}, ${params.value[1].toFixed(2)})`
      }
    },
    xAxis: {
      type: 'value',
      scale: true,
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          opacity: 0.5
        }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed',
          opacity: 0.5
        }
      }
    },
    series: topicSeries
  }

  chartInstance.value.setOption(option, { notMerge: true })
  chartInstance.value.hideLoading()

  chartInstance.value.off('click')
  chartInstance.value.on('click', 'series', handlePointClick)
  chartInstance.value.off('legendselectchanged')
  chartInstance.value.on('legendselectchanged', (params) => {
    const selected = params.selected
    const newChecked = []
    Object.entries(topicConfig.names).forEach(([index, name]) => {
      if (selected[name]) {
        newChecked.push(Number(index))
      }
    })
    state.checkedTopics = newChecked
    renderChart()
  })

  const resizeHandler = () => chartInstance.value?.resize()
  window.removeEventListener('resize', resizeHandler)
  window.addEventListener('resize', resizeHandler)
}

// 切换主题选择状态
const toggleTopic = (topicLabel) => {
  const index = state.checkedTopics.indexOf(topicLabel)
  if (index > -1) {
    state.checkedTopics.splice(index, 1)
  } else {
    state.checkedTopics.push(topicLabel)
  }
  if (chartInstance.value) {
    const legendSelected = {}
    Object.entries(topicConfig.names).forEach(([idx, name]) => {
      legendSelected[name] = state.checkedTopics.includes(Number(idx))
    })
    chartInstance.value.dispatchAction({ type: 'legendSelect', name: Object.keys(legendSelected) })
    chartInstance.value.dispatchAction({
      type: 'legendUnSelect',
      name: Object.keys(legendSelected).filter((k) => !legendSelected[k])
    })
  }
  renderChart()
}

// 格式化概率为百分比
const formatProbability = (value) => {
  return (value * 100).toFixed(1) + '%'
}

// 计算最高概率的主题
const dominantTopic = computed(() => {
  if (!state.selectedPoint || !state.selectedPoint.vector_json) return null

  try {
    const vector = JSON.parse(state.selectedPoint.vector_json)

    // 创建主题概率对象数组
    const topics = vector.map((value, index) => ({
      name: `主题${index}`,
      value: value
    }))

    // 返回值最大的主题
    return topics.reduce((max, topic) => (topic.value > max.value ? topic : max), {
      name: '',
      value: -Infinity
    })
  } catch (e) {
    console.error('解析向量数据出错:', e)
    return null
  }
})

// 获取主题向量
const topicVector = computed(() => {
  if (!state.selectedPoint || !state.selectedPoint.vector_json) return []

  try {
    return JSON.parse(state.selectedPoint.vector_json)
  } catch (e) {
    console.error('解析向量数据出错:', e)
    return []
  }
})

// 初始化
onMounted(() => {
  connectWebSocket()
})
</script>

<template>
  <div class="topic-visualization">
    <!-- 加载指示器 -->
    <div v-if="state.loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载数据...</div>
    </div>

    <!-- 主视图布局 -->
    <div class="main-content">
      <!-- 图表容器 -->
      <div ref="chartRef" class="chart-container"></div>

      <!-- 右侧控制面板 -->
      <div class="sidebar">
        <!-- 主题筛选器 -->
        <div class="filter-panel">
          <h3>主题筛选 (内部)</h3>
          <div class="topic-filters">
            <div
              v-for="index in 4"
              :key="index - 1"
              class="topic-checkbox"
              :class="{ checked: state.checkedTopics.includes(index - 1) }"
              @click="toggleTopic(index - 1)"
            >
              <span
                class="topic-color"
                :style="{ backgroundColor: topicConfig.colors[index - 1] }"
              ></span>
              <span class="topic-name">{{ topicConfig.names[index - 1] }}</span>
            </div>
          </div>
        </div>

        <!-- 点详情面板 -->
        <div class="details-panel">
          <h3>详细信息</h3>
          <div v-if="state.selectedPoint" class="point-details">
            <div class="detail-row">
              <span class="detail-label">ID:</span>
              <span class="detail-value">{{ state.selectedPoint.id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">诗歌ID:</span>
              <span class="detail-value">{{ state.selectedPoint.poem_id }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">聚类标签:</span>
              <span class="detail-value">{{ state.selectedPoint.cluster_label }}</span>
            </div>
            <div class="detail-row" v-if="state.selectedPoint.original_topics">
              <span class="detail-label">原始主题:</span>
              <span class="detail-value">{{ state.selectedPoint.original_topics }}</span>
            </div>

            <div class="probability-section" v-if="topicVector.length">
              <h4>主题概率分布</h4>
              <div class="probability-bars">
                <div class="prob-bar" v-for="(prob, index) in topicVector" :key="index">
                  <div class="prob-label">主题{{ index }}:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${prob * 100}%`,
                        backgroundColor: topicConfig.colors[index]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">{{ formatProbability(prob) }}</div>
                </div>
              </div>

              <div v-if="dominantTopic" class="dominant-topic">
                <strong>主导主题:</strong> {{ dominantTopic.name }} ({{
                  formatProbability(dominantTopic.value)
                }})
              </div>
            </div>

            <div class="topic-words" v-if="state.selectedPoint.topic_words">
              <h4>主题词:</h4>
              <div class="topic-words-content">
                {{ state.selectedPoint.topic_words }}
              </div>
            </div>

            <div class="coordinate-info" v-if="state.selectedPoint.umap_x !== undefined">
              <div class="detail-row">
                <span class="detail-label">UMAP-X:</span>
                <span class="detail-value">{{ state.selectedPoint.umap_x.toFixed(4) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">UMAP-Y:</span>
                <span class="detail-value">{{ state.selectedPoint.umap_y.toFixed(4) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="no-selection">
            <p>点击图表中的点查看详细信息</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topic-visualization {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: 'SimHei', sans-serif;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-top: 10px;
  font-size: 16px;
}

.main-content {
  display: flex;
  width: 100%;
  height: 100%;
}

.chart-container {
  flex: 2.5;
  min-width: 0;
  height: 100%;
}

.sidebar {
  width: 230px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #eee;
  background-color: #f9f9f9;
}

.filter-panel,
.details-panel {
  padding: 15px;
}

.filter-panel {
  border-bottom: 1px solid #eee;
}

.details-panel {
  flex: 1;
  overflow-y: auto;
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #333;
}

.topic-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.topic-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.topic-checkbox:hover {
  background-color: #f0f0f0;
}

.topic-checkbox.checked {
  background-color: #e6f7ff;
}

.topic-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  margin-right: 8px;
}

.point-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-weight: bold;
  color: #666;
}

.detail-value {
  color: #333;
}

.probability-section {
  margin-top: 15px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.probability-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #333;
}

.probability-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prob-bar {
  display: flex;
  align-items: center;
  height: 24px;
}

.prob-label {
  width: 60px;
  text-align: right;
  padding-right: 8px;
  font-size: 13px;
}

.prob-track {
  flex: 1;
  height: 10px;
  background-color: #eee;
  border-radius: 5px;
  overflow: hidden;
}

.prob-fill {
  height: 100%;
  border-radius: 5px;
}

.prob-value {
  width: 50px;
  text-align: left;
  padding-left: 8px;
  font-size: 12px;
}

.dominant-topic {
  margin-top: 10px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}

.topic-words {
  margin-top: 15px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.topic-words h4 {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
}

.topic-words-content {
  font-size: 13px;
  line-height: 1.4;
  max-height: 100px;
  overflow-y: auto;
  background-color: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
}

.coordinate-info {
  margin-top: 15px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #999;
  font-style: italic;
}
</style>
