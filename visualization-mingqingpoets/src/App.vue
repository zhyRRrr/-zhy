<script setup>
// import Map from '@/views/map.vue'
import MapRefactored from '@/views/MapRefactored.vue'
// import Map from '@/views/map.vue'
import WordCloudView from '@/views/WordCloudView.vue'
import TestComponent from '@/components/TestComponent.vue'
import PoetSelector from '@/components/PoetSelector.vue'
import EmotionVisualization from '@/views/EmotionVisualization.vue'
import TopicVisualization from '@/views/TopicVisualization.vue'
import HighlightController from '@/components/HighlightController.vue'
import { ref, watch, onMounted } from 'vue'

const selectedPoet = ref('全部诗人')

// 添加watch以在控制台输出诗人变化，便于调试
watch(selectedPoet, (newPoet, oldPoet) => {
  console.log(`App.vue - 诗人从 "${oldPoet}" 变更为 "${newPoet}"`)
})

// 测试 PoetSelector 组件
const selectedPoetNames = ref([])

// 模拟更新诗人列表的函数
const updatePoets = (scenario) => {
  switch (scenario) {
    case '多诗人':
      selectedPoetNames.value = ['錢守璞', '陸鳳池', '屠鏡心', '曹貞秀']
      break
    case '单诗人':
      selectedPoetNames.value = ['左錫嘉']
      break
    case '清空':
      selectedPoetNames.value = []
      break
  }
}

// 添加情感和主题列表的状态
const selectedEmotions = ref(['喜', '乐'])
const selectedTopics = ref(['主题1', '主题2'])

// 测试更新情感和主题列表的函数
const updateEmotionsAndTopics = (scenario) => {
  switch (scenario) {
    case '情感1':
      selectedEmotions.value = ['喜', '怒/豪']
      break
    case '情感2':
      selectedEmotions.value = ['思', '哀']
      break
    case '主题1':
      selectedTopics.value = ['主题0', '主题3']
      break
    case '主题2':
      selectedTopics.value = ['主题1', '主题2']
      break
    case '全部':
      selectedEmotions.value = ['思', '乐', '哀', '喜', '怒/豪']
      selectedTopics.value = ['主题0', '主题1', '主题2', '主题3']
      break
    case '清空':
      selectedEmotions.value = []
      selectedTopics.value = []
      break
  }
}

// 组件挂载后自动测试一次多诗人场景
onMounted(() => {
  setTimeout(() => updatePoets('多诗人'), 1000)
})
</script>

<template>
  <div id="main" style="position: absolute">
    <!-- PoetSelector 测试面板 -->
    <div class="poet-selector-test">
      <h3>PoetSelector 组件测试</h3>
      <div class="test-buttons">
        <button @click="updatePoets('多诗人')">多诗人</button>
        <button @click="updatePoets('单诗人')">单诗人</button>
        <button @click="updatePoets('清空')">清空选择</button>
      </div>
      <div class="test-status">当前列表: {{ selectedPoetNames }}</div>

      <PoetSelector :poet-names="selectedPoetNames"/>
    </div>

    <!-- 高亮控制器测试面板 -->
    <div class="highlight-controller-test">
      <h3>高亮控制器测试</h3>
      <div class="test-buttons">
        <button @click="updateEmotionsAndTopics('情感1')">情感测试1</button>
        <button @click="updateEmotionsAndTopics('情感2')">情感测试2</button>
        <button @click="updateEmotionsAndTopics('主题1')">主题测试1</button>
        <button @click="updateEmotionsAndTopics('主题2')">主题测试2</button>
        <button @click="updateEmotionsAndTopics('全部')">全部选择</button>
        <button @click="updateEmotionsAndTopics('清空')">清空选择</button>
      </div>
      <div class="test-status">
        <div>当前情感: {{ selectedEmotions }}</div>
        <div>当前主题: {{ selectedTopics }}</div>
      </div>
    </div>

    <!-- <ChinaNavigate style="position: absolute; top: 0; left: 399px; border: 1px solid black;"></ChinaNavigate> -->
    <MapRefactored
      style="position: absolute; top: 0; left: 0; border: 1px solid black; height: 700px"
    ></MapRefactored>

    <!-- 词云图组件 -->
    <WordCloudView
      :selected-poet="selectedPoet"
      style="
        position: absolute;
        top: 0;
        left: 710px;
        width: 400px;
        height: 700px;
        border: 1px solid black;
      "
    ></WordCloudView>

    <!-- 测试组件 -->
    <TestComponent
      style="
        position: absolute;
        top: 0;
        left: 1120px;
        width: 300px;
        height: 700px;
        border: 1px solid black;
      "
    ></TestComponent>

    <!-- 情感可视化组件 -->
    <EmotionVisualization
      style="
        position: absolute;
        top: 710px;
        left: 0;
        width: 920px;
        height: 700px;
        border: 1px solid black;
      "
    ></EmotionVisualization>

    <!-- 主题可视化组件 -->
    <TopicVisualization
      style="
        position: absolute;
        top: 710px;
        left: 930px;
        width: 920px;
        height: 700px;
        border: 1px solid black;
      "
    ></TopicVisualization>

    <!-- 高亮控制器组件 -->
    <HighlightController :emotions="selectedEmotions" :topics="selectedTopics" />
  </div>
</template>

<style scoped>
#main {
  background-image: url('./assets/honeycombCracks_1.jpg');
  position: absolute;
  left: 0;
  top: 0;
  width: 2560px;
  height: 1440px;
  overflow: hidden;
}

/* PoetSelector 测试面板样式 */
.poet-selector-test {
  position: absolute;
  top: 600px;
  left: 10px;
  width: 300px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.poet-selector-test h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
  text-align: center;
}

/* 高亮控制器测试面板样式 */
.highlight-controller-test {
  position: absolute;
  top: 400px;
  left: 10px;
  width: 300px;
  padding: 15px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.highlight-controller-test h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
  text-align: center;
}

.test-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.test-buttons button {
  flex: 1;
  min-width: 80px;
  padding: 5px 10px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.test-buttons button:hover {
  background-color: #45a049;
}

.test-status {
  background-color: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-all;
}
</style>
