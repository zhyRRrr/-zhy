<script setup lang="ts">
import { ref, watch } from 'vue'
import { useHighlightStore } from '@/stores/highlightStore'

const highlightStore = useHighlightStore()

// --- 情感和主题名称到索引的映射 ---
const emotionNameToIndex: { [key: string]: number } = {
  思: 0,
  乐: 1,
  哀: 2,
  喜: 3,
  '怒/豪': 4
}
const topicNameToIndex: { [key: string]: number } = {
  主题0: 0,
  主题1: 1,
  主题2: 2,
  主题3: 3
}

// 定义props接收外部传入的情感列表和主题列表
const props = defineProps({
  // 接收情感列表，如 ["喜", "怒", ...]
  emotions: {
    type: Array as () => string[],
    required: false,
    default: () => []
  },
  // 接收主题列表，如 ["主题1", "主题2", ...]
  topics: {
    type: Array as () => string[],
    required: false,
    default: () => []
  }
})

// --- 本地状态，用于表单输入 ---
const mockEmotionNamesInput = ref('乐, 喜') // 默认选中 乐, 喜
const mockTopicNamesInput = ref('主题0, 主题2') // 默认选中 主题0, 主题2

// 监听外部传入的情感列表变化
watch(
  () => props.emotions,
  (newEmotions) => {
    console.log('HighlightController - 收到情感列表更新:', newEmotions)

    // 检查传入的数据是否有效
    if (!newEmotions || !Array.isArray(newEmotions) || newEmotions.length === 0) {
      console.log('HighlightController - 由于情感列表无效/为空，重置所有情感高亮')
      highlightStore.resetEmotionHighlights()
      mockEmotionNamesInput.value = Object.keys(emotionNameToIndex).join(', ') // 更新输入框显示
      return
    }

    // 处理有效的情感列表
    const validEmotionNames = newEmotions.filter((emotion) => emotion in emotionNameToIndex)

    if (validEmotionNames.length === 0) {
      console.log('HighlightController - 传入的情感名称都无效，重置所有情感高亮')
      highlightStore.resetEmotionHighlights()
      mockEmotionNamesInput.value = Object.keys(emotionNameToIndex).join(', ')
    } else {
      // 映射到索引
      const emotionIndices = validEmotionNames.map((name) => emotionNameToIndex[name])
      highlightStore.setSelectedEmotions(emotionIndices)
      mockEmotionNamesInput.value = validEmotionNames.join(', ') // 更新输入框显示
    }
  },
  { immediate: true }
)

// 监听外部传入的主题列表变化
watch(
  () => props.topics,
  (newTopics) => {
    console.log('HighlightController - 收到主题列表更新:', newTopics)

    // 检查传入的数据是否有效
    if (!newTopics || !Array.isArray(newTopics) || newTopics.length === 0) {
      console.log('HighlightController - 由于主题列表无效/为空，重置所有主题高亮')
      highlightStore.resetTopicHighlights()
      mockTopicNamesInput.value = Object.keys(topicNameToIndex).join(', ') // 更新输入框显示
      return
    }

    // 处理有效的主题列表
    const validTopicNames = newTopics.filter((topic) => topic in topicNameToIndex)

    if (validTopicNames.length === 0) {
      console.log('HighlightController - 传入的主题名称都无效，重置所有主题高亮')
      highlightStore.resetTopicHighlights()
      mockTopicNamesInput.value = Object.keys(topicNameToIndex).join(', ')
    } else {
      // 映射到索引
      const topicIndices = validTopicNames.map((name) => topicNameToIndex[name])
      highlightStore.setSelectedTopics(topicIndices)
      mockTopicNamesInput.value = validTopicNames.join(', ') // 更新输入框显示
    }
  },
  { immediate: true }
)
</script>
