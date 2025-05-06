<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 定义props接收选中的诗人 (不再直接使用，由全局事件驱动)
// const props = defineProps({
//   selectedPoet: {
//     type: String,
//     default: '全部诗人'
//   }
// })

// 词云图URL
const wordCloudUrl = ref('')
// 加载状态
const loading = ref(false)
// 错误信息
const error = ref('')
// 内部保存当前显示名称
const currentPoetDisplay = ref('全部诗人')
// 内部保存当前查询标识符（字符串或数组）
const currentQueryIdentifier = ref('全部诗人')
// 是否处于多选模式
const isMultiSelectMode = ref(false)

// 监听全局单诗人变化事件
// 用于接收来自外部组件传递的单个诗人选择
// 外部组件需要触发 'poet-changed' 事件，并提供 {detail: {name/poet: '诗人名', id: '可选id'}}
const handlePoetChanged = (event) => {
  const newPoet = event.detail.name || event.detail.poet
  console.log('WordCloudView - 接收到全局单诗人变化事件:', newPoet)

  // 确保在非多选模式下才响应
  if (!isMultiSelectMode.value && newPoet && newPoet !== currentQueryIdentifier.value) {
    currentQueryIdentifier.value = newPoet
    currentPoetDisplay.value = newPoet
    generateWordCloud(newPoet)
  }
}

// 监听全局多选诗人变化事件
// 用于接收来自外部组件传递的多选诗人列表
// 外部组件需要触发 'poets-multi-selected' 事件，并提供 {detail: {poets: [{id: ..., name: ...}, ...]}}
const handlePoetsMultiSelected = (event) => {
  const poets = event.detail.poets // 假设 poets 是 [{id: ..., name: ...}, ...]
  console.log('WordCloudView - 接收到全局多选诗人事件:', poets)
  if (poets && poets.length > 0) {
    isMultiSelectMode.value = true
    const poetNames = poets.map((p) => p.name)
    currentQueryIdentifier.value = poetNames

    // 更新显示名称
    if (poetNames.length > 3) {
      currentPoetDisplay.value = `${poetNames[0]}、${poetNames[1]} 等 ${poetNames.length} 位诗人`
    } else {
      currentPoetDisplay.value = poetNames.join('、')
    }

    generateWordCloud(poetNames)
  } else {
    // 如果选择为空，可能需要恢复到"全部诗人"状态或上一个单选状态
    // 这里恢复到"全部诗人"
    isMultiSelectMode.value = false
    currentQueryIdentifier.value = '全部诗人'
    currentPoetDisplay.value = '全部诗人'
    generateWordCloud('全部诗人')
  }
}

// 监听多选模式启用/禁用事件
// 用于接收来自外部组件传递的多选模式状态变更
// 外部组件需要触发 'multi-select-mode-changed' 事件，并提供 {detail: {enabled: true/false}}
const handleMultiSelectModeChanged = (event) => {
  const isEnabled = event.detail.enabled
  console.log(`WordCloudView - 接收到多选模式变更事件: ${isEnabled}`)
  isMultiSelectMode.value = isEnabled
}

// 生成词云图 (参数 poets 可以是字符串或数组)
const generateWordCloud = async (poets) => {
  try {
    console.log('开始为诗人/诗人列表生成词云图:', poets)
    loading.value = true
    error.value = ''
    wordCloudUrl.value = '' // 清空旧图

    // 构造请求体
    let requestBody = {}
    if (Array.isArray(poets)) {
      requestBody = { poet_names: poets }
    } else {
      requestBody = { poet_name: poets }
    }

    // 请求生成词云图并获取图片
    const response = await fetch('http://localhost:5000/generate_wordcloud', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('API响应状态:', response.status)

    if (!response.ok) {
      // 尝试读取错误信息
      let errorData = null
      try {
        errorData = await response.json()
      } catch (e) {
        // 忽略解析错误
      }
      throw new Error(`请求失败：${response.status} ${errorData?.error || ''}`)
    }

    const data = await response.json()
    console.log('API返回数据:', Object.keys(data))

    if (data.success) {
      // 设置词云图URL (base64编码的图片数据)
      wordCloudUrl.value = `data:image/png;base64,${data.image}`
      currentPoetDisplay.value = data.poet // 使用后端返回的规范化名称
      console.log('词云图更新成功 for:', data.poet)
    } else {
      error.value = data.error || '生成词云图失败'
      console.error('词云图生成失败:', data.error)
    }
  } catch (err) {
    console.error('生成词云图错误:', err)
    error.value = `生成词云图错误: ${err.message}`
  } finally {
    loading.value = false
  }
}

// 初始化时设置事件监听
onMounted(() => {
  // 监听自定义事件 - 这些监听器用于接收来自外部组件的诗人选择数据
  window.addEventListener('poet-changed', handlePoetChanged)
  window.addEventListener('poets-multi-selected', handlePoetsMultiSelected)
  window.addEventListener('multi-select-mode-changed', handleMultiSelectModeChanged)

  // 初始生成"全部诗人"词云图
  generateWordCloud('全部诗人')

  console.log('WordCloudView 已挂载，初始显示:', currentPoetDisplay.value)
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('poet-changed', handlePoetChanged)
  window.removeEventListener('poets-multi-selected', handlePoetsMultiSelected)
  window.removeEventListener('multi-select-mode-changed', handleMultiSelectModeChanged)
})
</script>

<template>
  <div class="wordcloud-container">
    <div class="current-poet">
      <span>当前: {{ currentPoetDisplay }}</span>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在生成词云图...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="generateWordCloud(currentQueryIdentifier)">重试</button>
    </div>

    <div v-else-if="wordCloudUrl" class="wordcloud-display">
      <img :src="wordCloudUrl" alt="词云图" />
    </div>

    <div v-else class="empty-state">
      <p>暂无词云图数据</p>
    </div>
  </div>
</template>

<style scoped>
.wordcloud-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.current-poet {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  padding: 5px 10px;
  background-color: rgba(240, 240, 240, 0.7);
  border-radius: 4px;
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.wordcloud-display {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
}

.wordcloud-display img {
  max-width: 100%;
  max-height: 90%;
  object-fit: contain;
  background-color: transparent;
  mix-blend-mode: multiply;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.5);
  padding: 20px;
  border-radius: 8px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error {
  color: #e74c3c;
  text-align: center;
  padding: 20px;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
}

.empty-state {
  color: #7f8c8d;
  text-align: center;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 20px;
  border-radius: 8px;
}
</style>
