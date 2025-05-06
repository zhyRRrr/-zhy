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
  emotionData: [],
  selectedPoint: null,
  checkedEmotions: [0, 1, 2, 3, 4] // 默认所有情感都被选中 (思 乐 哀 喜 怒/豪)
})

// 情感映射配置
const emotionConfig = {
  names: {
    0: '思',
    1: '乐',
    2: '哀',
    3: '喜',
    4: '怒/豪'
  },
  colors: {
    0: '#7fdcc5', // 思 - 淡竹绿 (原 #1ba784)
    1: '#f9a77b', // 乐 - 淡蟹壳红 (原 #f27635)
    2: '#6d93b8', // 哀 - 淡鷃蓝 (原 #144a74)
    3: '#f47a9e', // 喜 - 淡喜蛋红 (原 #ec2c64)
    4: '#c26b75' // 怒/豪 - 淡殷红 (原 #82111f)
  },
  maskColor: '#e0e0e0', // 更浅的遮罩色
  maskOpacity: 0.08, // 进一步降低遮罩透明度
  maskSymbolSize: 2, // 进一步减小遮罩点大小
  internalGreyColor: '#aeaeae', // 中度灰色
  internalGreyOpacity: 0.6, // 提高透明度
  internalGreySymbolSize: 9 // 显著增大尺寸
}

// WebSocket连接
const ws = ref(null)
const wsConnected = ref(false)

// 高亮状态管理
const highlightStore = useHighlightStore()
const { isHighlightActive, selectedEmotions } = storeToRefs(highlightStore)

// 监听高亮状态或选中列表变化，触发重新渲染
watch(
  [isHighlightActive, selectedEmotions],
  () => {
    if (chartInstance.value && state.emotionData.length > 0) {
      console.log('Highlight state or selected emotions changed, rerendering emotion chart...')
      renderChart()
    }
  },
  { deep: true } // deep: true 确保能监听到 selectedEmotions 数组内部的变化
)

// 连接WebSocket
const connectWebSocket = () => {
  ws.value = new WebSocket('ws://localhost:6789')

  ws.value.onopen = () => {
    console.log('WebSocket连接已建立')
    wsConnected.value = true
    fetchEmotionData()
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

      if (response.type === 'emotion_data' && response.success) {
        handleEmotionDataReceived(response.data)
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

// 获取情感可视化数据
const fetchEmotionData = () => {
  if (!wsConnected.value) {
    console.error('WebSocket未连接')
    return
  }

  state.loading = true

  const request = {
    action: 'get_emotion_data',
    filter: {
      limit: 8000 // 获取足够的数据点
    }
  }

  ws.value.send(JSON.stringify(request))
}

// 处理接收到的情感数据
const handleEmotionDataReceived = (data) => {
  console.log(`接收到${data.length}个情感数据点`)
  state.emotionData = data
  state.loading = false

  if (data.length > 0) {
    renderChart()
  }
}

// 根据情感编号获取情感名称
const getEmotionName = (emotionId) => {
  return emotionConfig.names[emotionId] || `未知情感(${emotionId})`
}

// 处理点击事件
const handlePointClick = (params) => {
  // 获取点击点的完整数据
  const pointData = params.data.originalData

  // 设置当前选中的点
  state.selectedPoint = pointData

  // 触发自定义事件，传递诗歌ID
  if (pointData && pointData.poem_id) {
    console.log(`EmotionVisualization - 散点图点击：诗歌ID = ${pointData.poem_id}`)
    // 发送自定义事件，传递诗歌ID
    window.dispatchEvent(
      new CustomEvent('emotion-point-clicked', {
        detail: {
          poemId: pointData.poem_id,
          emotionLabel: Number(pointData.cluster_label),
          emotionName: getEmotionName(pointData.cluster_label)
        }
      })
    )
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

  const emotionSeries = [0, 1, 2, 3, 4].map((emotionIndex) => {
    const filteredData = state.emotionData
      .filter((item) => Number(item.cluster_label) === emotionIndex)
      .map((item) => {
        const isCheckedInternal = state.checkedEmotions.includes(emotionIndex)
        const isSelectedExternal = selectedEmotions.value.includes(emotionIndex)
        const applyMask = isHighlightActive.value && !isSelectedExternal

        let finalColor, finalOpacity, finalSize, finalZ

        if (applyMask) {
          // 外部遮罩样式 (修改为与内部灰色一致)
          finalColor = emotionConfig.internalGreyColor
          finalOpacity = emotionConfig.internalGreyOpacity
          finalSize = emotionConfig.internalGreySymbolSize
          finalZ = 1 // 层级与内部灰色一致
        } else if (!isCheckedInternal) {
          // 内部未选中样式 (保持不变)
          finalColor = emotionConfig.internalGreyColor
          finalOpacity = emotionConfig.internalGreyOpacity
          finalSize = emotionConfig.internalGreySymbolSize
          finalZ = 1
        } else {
          // 正常显示样式 (最明显)
          finalColor = emotionConfig.colors[emotionIndex]
          finalOpacity = 0.7
          finalSize = 10
          finalZ = 2
        }

        return {
          name: getEmotionName(emotionIndex),
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

    // Series 配置保持不变，样式由 itemStyle 控制
    return {
      name: getEmotionName(emotionIndex),
      type: 'scatter',
      symbolSize: 10, // 基础大小，实际大小由 itemStyle 控制
      data: filteredData,
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          // 强调时恢复较高透明度和正常大小
          opacity: 0.9
        },
        scale: 1.2 // 强调时稍微放大
      }
    }
  })

  // 图表 Option 配置
  const option = {
    title: {
      text: '情感降维可视化',
      subtext: '基于UMAP降维的情感分布',
      left: 'center'
    },
    legend: {
      show: false // 设置为 false 来隐藏图例
    },
    grid: {
      left: '3%',
      right: '2%',
      top: '8%',
      bottom: '5%'
    },
    tooltip: {
      trigger: 'item',
      formatter: function (params) {
        if (params.data && params.data.originalData) {
          const data = params.data.originalData
          const emotionIdx = Number(data.cluster_label)
          // 添加高亮状态显示 (仅当高亮激活时)
          let highlightStatus = ''
          if (isHighlightActive.value) {
            const isHighlightedExternal = selectedEmotions.value.includes(emotionIdx)
            highlightStatus = isHighlightedExternal ? '(外部高亮)' : '(外部未选)'
          }
          // 保留原始 tooltip 内容，并添加高亮状态
          return `
            <div style="font-weight:bold;margin-bottom:5px;">情感：${params.name} ${highlightStatus}</div>
            <div>思：${data.si_prob ? Number(data.si_prob).toFixed(3) : 'N/A'}</div>
            <div>乐：${data.le_prob ? Number(data.le_prob).toFixed(3) : 'N/A'}</div>
            <div>哀：${data.ai_prob ? Number(data.ai_prob).toFixed(3) : 'N/A'}</div>
            <div>喜：${data.xi_prob ? Number(data.xi_prob).toFixed(3) : 'N/A'}</div>
            <div>怒/豪：${data.nu_hao_prob ? Number(data.nu_hao_prob).toFixed(3) : 'N/A'}</div>
          `
        }
        return `情感: ${params.name}<br/>坐标: (${params.value[0].toFixed(2)}, ${params.value[1].toFixed(2)})`
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
    series: emotionSeries
  }

  chartInstance.value.setOption(option, { notMerge: true })
  chartInstance.value.hideLoading()

  chartInstance.value.off('click') // 移除旧监听器
  chartInstance.value.on('click', 'series', handlePointClick)
  // 图例选择事件，用于同步内部 checkedEmotions
  chartInstance.value.off('legendselectchanged')
  chartInstance.value.on('legendselectchanged', (params) => {
    const selected = params.selected
    const newChecked = []
    Object.entries(emotionConfig.names).forEach(([index, name]) => {
      if (selected[name]) {
        newChecked.push(Number(index))
      }
    })
    state.checkedEmotions = newChecked
    renderChart() // 图例变化也重绘以更新原始样式
  })

  // 确保 resize 监听器只添加一次或正确管理
  const resizeHandler = () => chartInstance.value?.resize()
  window.removeEventListener('resize', resizeHandler) // 先移除可能存在的旧监听器
  window.addEventListener('resize', resizeHandler)
}

// 切换情感选择状态
const toggleEmotion = (emotionLabel) => {
  const index = state.checkedEmotions.indexOf(emotionLabel)
  if (index > -1) {
    state.checkedEmotions.splice(index, 1)
  } else {
    state.checkedEmotions.push(emotionLabel)
  }
  // 更新图例状态并重绘
  if (chartInstance.value) {
    const legendSelected = {}
    Object.entries(emotionConfig.names).forEach(([idx, name]) => {
      legendSelected[name] = state.checkedEmotions.includes(Number(idx))
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

// 计算最高概率的情感
const dominantEmotion = computed(() => {
  if (!state.selectedPoint) return null

  // 排序五个情感概率
  const emotions = [
    { name: '思', value: state.selectedPoint.si_prob },
    { name: '乐', value: state.selectedPoint.le_prob },
    { name: '哀', value: state.selectedPoint.ai_prob },
    { name: '喜', value: state.selectedPoint.xi_prob },
    { name: '怒/豪', value: state.selectedPoint.nu_hao_prob }
  ]

  // 返回值最大的情感
  return emotions.reduce((max, emotion) => (emotion.value > max.value ? emotion : max), {
    name: '',
    value: -Infinity
  })
})

// 初始化
onMounted(() => {
  connectWebSocket()
})
</script>

<template>
  <div class="emotion-visualization">
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
        <!-- 情感筛选器 -->
        <div class="filter-panel">
          <h3>情感筛选 (内部)</h3>
          <div class="emotion-filters">
            <div
              v-for="index in 5"
              :key="index - 1"
              class="emotion-checkbox"
              :class="{ checked: state.checkedEmotions.includes(index - 1) }"
              @click="toggleEmotion(index - 1)"
            >
              <span
                class="emotion-color"
                :style="{ backgroundColor: emotionConfig.colors[index - 1] }"
              ></span>
              <span class="emotion-name">{{ emotionConfig.names[index - 1] }}</span>
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
              <span class="detail-label">情感标签:</span>
              <span class="detail-value">{{
                getEmotionName(state.selectedPoint.cluster_label)
              }}</span>
            </div>
            <div class="detail-row" v-if="state.selectedPoint.original_emotion">
              <span class="detail-label">原始情感:</span>
              <span class="detail-value">{{
                state.selectedPoint.original_emotion || '未标注'
              }}</span>
            </div>

            <div class="probability-section" v-if="state.selectedPoint.si_prob !== undefined">
              <h4>情感概率分布</h4>
              <div class="probability-bars">
                <div class="prob-bar">
                  <div class="prob-label">思:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${state.selectedPoint.si_prob * 100}%`,
                        backgroundColor: emotionConfig.colors[0]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">{{ formatProbability(state.selectedPoint.si_prob) }}</div>
                </div>

                <div class="prob-bar">
                  <div class="prob-label">乐:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${state.selectedPoint.le_prob * 100}%`,
                        backgroundColor: emotionConfig.colors[1]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">{{ formatProbability(state.selectedPoint.le_prob) }}</div>
                </div>

                <div class="prob-bar">
                  <div class="prob-label">哀:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${state.selectedPoint.ai_prob * 100}%`,
                        backgroundColor: emotionConfig.colors[2]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">{{ formatProbability(state.selectedPoint.ai_prob) }}</div>
                </div>

                <div class="prob-bar">
                  <div class="prob-label">喜:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${state.selectedPoint.xi_prob * 100}%`,
                        backgroundColor: emotionConfig.colors[3]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">{{ formatProbability(state.selectedPoint.xi_prob) }}</div>
                </div>

                <div class="prob-bar">
                  <div class="prob-label">怒/豪:</div>
                  <div class="prob-track">
                    <div
                      class="prob-fill"
                      :style="{
                        width: `${state.selectedPoint.nu_hao_prob * 100}%`,
                        backgroundColor: emotionConfig.colors[4]
                      }"
                    ></div>
                  </div>
                  <div class="prob-value">
                    {{ formatProbability(state.selectedPoint.nu_hao_prob) }}
                  </div>
                </div>
              </div>

              <div v-if="dominantEmotion" class="dominant-emotion">
                <strong>主导情感:</strong> {{ dominantEmotion.name }} ({{
                  formatProbability(dominantEmotion.value)
                }})
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
.emotion-visualization {
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

.emotion-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emotion-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.emotion-checkbox:hover {
  background-color: #f0f0f0;
}

.emotion-checkbox.checked {
  background-color: #e6f7ff;
}

.emotion-color {
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
  width: 50px;
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

.dominant-emotion {
  margin-top: 10px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
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
