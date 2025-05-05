目前修改了代码只需要传入一个列表给PoetSelector  会检测列表的元素个数 如果为空或者是未知诗人，那么直接显示全部是人
如果是一个诗人那么就是显示这个诗人的数据   如果是两个或者以上诗人名字那么就是多选模式的

```vue
<PoetSelector :poet-names="selectedPoetNames" />
```

![image-20250427122658607](前端链接.assets/image-20250427122658607.png)

![image-20250427122814499](前端链接.assets/image-20250427122814499.png)

![image-20250427123118927](前端链接.assets/image-20250427123118927.png)

传入主题和情感列表动态显示  在App.vue文件中

![image-20250505111343390](前端链接.assets/image-20250505111343390.png)

![image-20250505111444509](前端链接.assets/image-20250505111444509.png)

```vue
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
```

![image-20250505111604701](前端链接.assets/image-20250505111604701.png)

获取点击散点图的诗词ID

```vue
<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

// 用来存储接收到的数据
const receivedPoemId = ref(null)
const receivedTopicName = ref(null)

// 事件处理函数
const handleTopicPointClicked = (event) => {
  const { poemId, topicLabel, topicName } = event.detail
  console.log(`收到主题点击事件，诗歌ID: ${poemId}, 主题: ${topicName}`)
  receivedPoemId.value = poemId
  receivedTopicName.value = topicName
  // 处理诗歌ID的逻辑...
}

// 在组件挂载时添加事件监听
onMounted(() => {
  window.addEventListener('topic-point-clicked', handleTopicPointClicked)
  
  // 如果也需要监听情感事件
  window.addEventListener('emotion-point-clicked', handleEmotionPointClicked)
})

// 在组件卸载时移除事件监听（避免内存泄漏）
onUnmounted(() => {
  window.removeEventListener('topic-point-clicked', handleTopicPointClicked)
  
  // 如果也监听了情感事件
  window.removeEventListener('emotion-point-clicked', handleEmotionPointClicked)
})

// 情感事件处理函数（如果需要）
const handleEmotionPointClicked = (event) => {
  const { poemId, emotionLabel, emotionName } = event.detail
  console.log(`收到情感点击事件，诗歌ID: ${poemId}, 情感: ${emotionName}`)
  // 处理诗歌ID的逻辑...
}
</script>
```

关键点:

1. 使用`addEventListener`注册事件监听
2. 在`onMounted`生命周期钩子中添加监听
3. 在`onUnmounted`中移除监听（这很重要，防止内存泄漏）
4. 通过`event.detail`获取事件传递的数据



**另外词云图和PoetSelector是一起变化的**，
当poetNames变化时，PoetSelector会触发全局事件：

- 触发poet-changed事件(单个诗人)

- 触发poets-multi-selected事件(多个诗人)

- 触发multi-select-mode-changed事件(模式变更)
  然后词云图中监听这个全局事件的变化，随时更改
