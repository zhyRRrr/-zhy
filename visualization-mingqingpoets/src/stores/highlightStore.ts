import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

// 定义所有可能的情感和主题索引
const ALL_EMOTIONS = [0, 1, 2, 3, 4]
const ALL_TOPICS = [0, 1, 2, 3]

export const useHighlightStore = defineStore('highlight', () => {
    // --- State ---
    // 存储当前选中的情感索引列表，默认为全部选中
    const selectedEmotions = ref<number[]>([...ALL_EMOTIONS])
    // 存储当前选中的主题索引列表，默认为全部选中
    const selectedTopics = ref<number[]>([...ALL_TOPICS])

    // --- Getters ---
    // 计算是否处于高亮激活状态 (即是否有筛选条件)
    const isHighlightActive = computed(() => {
        return (
            selectedEmotions.value.length !== ALL_EMOTIONS.length ||
            selectedTopics.value.length !== ALL_TOPICS.length
        )
    })

    // 检查特定情感是否被选中
    const isEmotionSelected = (emotionIndex: number): boolean => {
        // 如果高亮未激活，则认为所有都选中
        if (!isHighlightActive.value) return true
        return selectedEmotions.value.includes(emotionIndex)
    }

    // 检查特定主题是否被选中
    const isTopicSelected = (topicIndex: number): boolean => {
        // 如果高亮未激活，则认为所有都选中
        if (!isHighlightActive.value) return true
        return selectedTopics.value.includes(topicIndex)
    }

    // --- Actions ---
    // 设置选中的情感列表
    function setSelectedEmotions(emotions: number[]) {
        // 验证输入是否为有效的数字数组
        if (Array.isArray(emotions) && emotions.every(e => typeof e === 'number')) {
            selectedEmotions.value = [...new Set(emotions)] // 去重
            console.log('Highlight Store: Emotions updated', selectedEmotions.value)
        } else {
            console.warn('Highlight Store: Invalid emotions input, resetting to all.', emotions)
            resetEmotionHighlights()
        }
    }

    // 设置选中的主题列表
    function setSelectedTopics(topics: number[]) {
        // 验证输入是否为有效的数字数组
        if (Array.isArray(topics) && topics.every(t => typeof t === 'number')) {
            selectedTopics.value = [...new Set(topics)] // 去重
            console.log('Highlight Store: Topics updated', selectedTopics.value)
        } else {
            console.warn('Highlight Store: Invalid topics input, resetting to all.', topics)
            resetTopicHighlights()
        }
    }

    // 重置情感高亮为全部选中
    function resetEmotionHighlights() {
        selectedEmotions.value = [...ALL_EMOTIONS]
        console.log('Highlight Store: Emotions reset to all')
    }

    // 重置主题高亮为全部选中
    function resetTopicHighlights() {
        selectedTopics.value = [...ALL_TOPICS]
        console.log('Highlight Store: Topics reset to all')
    }

    // 重置所有高亮
    function resetAllHighlights() {
        resetEmotionHighlights()
        resetTopicHighlights()
    }

    return {
        selectedEmotions,
        selectedTopics,
        isHighlightActive,
        isEmotionSelected,
        isTopicSelected,
        setSelectedEmotions,
        setSelectedTopics,
        resetEmotionHighlights,
        resetTopicHighlights,
        resetAllHighlights
    }
}) 