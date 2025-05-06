<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PoetSelector from './PoetSelector.vue' // 导入新的诗人选择器组件

// 定义主题聚类命令
const topicCommand =
  'python lda_visualization/topic_clustering.py --n_neighbors 3 --min_dist 2.0 --spread 4.0 --scale 3.0 --n_clusters 8 --output topic_clusters_interactive.png --input processdata/topic.csv'
// 定义情感可视化命令
const emotionCommand =
  'python emotion/emotion_visualization.py --n_neighbors 3 --min_dist 2.0 --spread 4.0 --scale 3.0 --point_size 15 --point_alpha 0.7 --jitter 0.03 --boundary_alpha 0.04 --expand_factor 0.4 --padding 0.2 --smoothness 0.6 --color_scheme Set1 --output ./emotion_clusters.png'
// 定义词云图命令
const wordcloudCommand = 'python wordcloud_ciyun/create_wordcloud.py'

// 使用Map记录每个脚本的运行状态 (明确 key/value 类型)
const runningScripts = ref<Map<string, string>>(new Map())
// 定义是否连接到服务器
const isConnected = ref(false)
// 定义最大重连尝试次数
const maxReconnectAttempts = 5
// 当前重连尝试次数
let reconnectAttempts = 0
// 重连定时器
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

// 定义输出日志
const outputLog = ref('')
// 定义是否显示输出窗口
const showOutput = ref(false)
// 定义是否显示服务器帮助窗口
const showServerHelp = ref(false)

let socket: WebSocket | null = null

// 检查脚本是否在运行的 ref (现在与诗人选择无关)
const isTopicScriptRunning = ref(false)
const isEmotionScriptRunning = ref(false)
const isWordcloudScriptRunning = ref(false)

// 连接到本地WebSocket服务器
const connectToServer = () => {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close()
  }
  socket = new WebSocket('ws://localhost:6789')
  socket.onopen = () => {
    console.log('TestComponent - 已连接到Python服务器')
    isConnected.value = true
    reconnectAttempts = 0
    checkRunningScripts()
  }
  socket.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'output') {
        outputLog.value += data.content + '\n'
      } else if (data.type === 'status') {
        if (data.status === 'completed' || data.status === 'error') {
          if (data.scriptId && runningScripts.value.has(data.scriptId)) {
            const scriptMap = new Map(runningScripts.value)
            scriptMap.delete(data.scriptId)
            runningScripts.value = scriptMap
            updateScriptRunningStatus()
            if (data.scriptId === currentScriptId.value) {
              showOutput.value = true // 显示完成或错误后的输出
            }
          }
        }
      } else if (data.type === 'script_list') {
        const scriptMap = new Map<string, string>()
        data.scripts.forEach((script: { id: string; command: string }) => {
          scriptMap.set(script.id, script.command)
        })
        runningScripts.value = scriptMap
        updateScriptRunningStatus()
      }
    } catch (e) {
      outputLog.value += event.data + '\n'
    }
  }
  socket.onclose = (event: CloseEvent) => {
    console.log('TestComponent - 与Python服务器的连接已关闭', event.code, event.reason)
    isConnected.value = false
    if (event.code !== 1000 && event.code !== 1001) {
      scheduleReconnect()
    }
  }
  socket.onerror = (error: Event) => {
    console.error('TestComponent - WebSocket错误:', error)
    isConnected.value = false
    if (reconnectAttempts >= maxReconnectAttempts) {
      showServerHelp.value = true
    }
  }
}

// 更新脚本运行状态按钮
const updateScriptRunningStatus = () => {
  isTopicScriptRunning.value = runningScripts.value.has('主题聚类')
  isEmotionScriptRunning.value = runningScripts.value.has('情感可视化')
  isWordcloudScriptRunning.value = runningScripts.value.has('词云图脚本')
}

// 安排重连
const scheduleReconnect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (reconnectAttempts < maxReconnectAttempts) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
    console.log(`TestComponent - 安排在 ${delay}ms 后重连... (第 ${reconnectAttempts + 1} 次)`)
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++
      connectToServer()
    }, delay)
  } else {
    console.log('TestComponent - 达到最大重连尝试次数')
    showServerHelp.value = true
  }
}

// 检查正在运行的脚本
const checkRunningScripts = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action: 'list_scripts' }))
  }
}

// 定时检查状态
let statusCheckInterval: ReturnType<typeof setInterval> | null = null
const startStatusCheck = () => {
  if (statusCheckInterval) clearInterval(statusCheckInterval)
  statusCheckInterval = setInterval(() => {
    if (isConnected.value) checkRunningScripts()
  }, 5000)
}

// 处理页面可见性变化
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    if (!isConnected.value) {
      console.log('TestComponent - 页面可见，尝试重连...')
      reconnectAttempts = 0
      connectToServer()
    } else {
      checkRunningScripts()
    }
  }
}

// 定义当前脚本ID，用于输出显示
const currentScriptId = ref('')

// 运行Python脚本
const runScript = (command: string, scriptId: string) => {
  if (!isConnected.value) {
    showServerHelp.value = true
    return
  }
  currentScriptId.value = scriptId
  outputLog.value = ''
  const scriptMap = new Map(runningScripts.value)
  scriptMap.set(scriptId, command)
  runningScripts.value = scriptMap
  updateScriptRunningStatus()
  socket?.send(JSON.stringify({ action: 'run', command, scriptId }))
}

// 运行主题聚类脚本
const runTopicScript = () => {
  runScript(topicCommand, '主题聚类')
}

// 运行情感可视化脚本
const runEmotionScript = () => {
  runScript(emotionCommand, '情感可视化')
}

// 运行词云图脚本
const runWordcloudScript = () => {
  runScript(wordcloudCommand, '词云图脚本')
}

// 关闭输出窗口
const closeOutput = () => {
  showOutput.value = false
}
// 关闭服务器帮助窗口
const closeServerHelp = () => {
  showServerHelp.value = false
}
// 重连到服务器
const reconnectToServer = () => {
  showServerHelp.value = false
  reconnectAttempts = 0
  connectToServer()
}

// 显示命令的相关代码
const showCommandModal = ref(false)
const currentCommand = ref('')
const copySuccess = ref(false)

const showTopicCommand = () => {
  currentCommand.value = topicCommand
  showCommandModal.value = true
  copySuccess.value = false
}
const showEmotionCommand = () => {
  currentCommand.value = emotionCommand
  showCommandModal.value = true
  copySuccess.value = false
}
const showWordcloudCommand = () => {
  currentCommand.value = wordcloudCommand
  showCommandModal.value = true
  copySuccess.value = false
}

// 复制命令到剪贴板
const copyCommand = async () => {
  try {
    await navigator.clipboard.writeText(currentCommand.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败: ', err)
  }
}
// 关闭模态框
const closeModal = () => {
  showCommandModal.value = false
}
// 尝试打开终端
const openTerminal = () => {
  if (navigator.platform.toUpperCase().indexOf('WIN') >= 0) {
    window.open('cmd://')
  } else if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
    window.open('terminal://')
  } else {
    alert('请手动打开终端并粘贴命令执行')
  }
}
// 终止脚本
const terminateScript = (scriptId: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log(`TestComponent - 请求终止脚本: ${scriptId}`)
    socket.send(JSON.stringify({ action: 'terminate', scriptId }))
    const scriptMap = new Map(runningScripts.value)
    scriptMap.delete(scriptId)
    runningScripts.value = scriptMap
    updateScriptRunningStatus()
  }
}

// --- 生命周期钩子 ---
onMounted(() => {
  // 不再监听 poet-changed 事件
  // window.addEventListener('poet-changed', handleGlobalPoetChanged)

  // 连接 WebSocket 服务器
  connectToServer()
  // 启动状态检查轮询
  startStatusCheck()
  // 监听浏览器标签页可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)
  console.log('TestComponent 已挂载并初始化 WebSocket 连接')
})

onUnmounted(() => {
  // 不再移除 poet-changed 事件监听
  // window.removeEventListener('poet-changed', handleGlobalPoetChanged)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // 关闭 WebSocket 连接
  if (socket) {
    socket.close(1000, 'Component unmounted')
  }
  // 清理定时器
  if (statusCheckInterval) clearInterval(statusCheckInterval)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  console.log('TestComponent 已卸载并清理 WebSocket 资源')
})
</script>

<template>
  <div class="test-component">
    <h2>测试组件 (拆分后)</h2>

    <!-- 诗人选择器组件 -->
    <PoetSelector />

    <hr style="margin: 20px 0" />

    <!-- 保留后端脚本控制部分 -->
    <h3>后端脚本控制</h3>
    <div class="buttonContainer">
      <div>
        <button class="actionButton" @click="runTopicScript" :disabled="!isConnected">
          <span v-if="isConnected">
            {{ isTopicScriptRunning ? '运行中...' : '运行主题聚类' }}
          </span>
          <span v-else>未连接</span>
        </button>
        <button class="helpButton" @click="showTopicCommand" title="查看命令">?</button>
      </div>
      <div>
        <button class="actionButton" @click="runEmotionScript" :disabled="!isConnected">
          <span v-if="isConnected">
            {{ isEmotionScriptRunning ? '运行中...' : '运行情感可视化' }}
          </span>
          <span v-else>未连接</span>
        </button>
        <button class="helpButton" @click="showEmotionCommand" title="查看命令">?</button>
      </div>
      <div>
        <button class="actionButton" @click="runWordcloudScript" :disabled="!isConnected">
          <span v-if="isConnected">
            {{ isWordcloudScriptRunning ? '运行中...' : '生成词云图(通用)' }}
          </span>
          <span v-else>未连接</span>
        </button>
        <button class="helpButton" @click="showWordcloudCommand" title="查看命令">?</button>
      </div>
      <div class="connectionStatus" :class="{ connected: isConnected, disconnected: !isConnected }">
        {{ isConnected ? '已连接' : '未连接' }}
      </div>
    </div>

    <div v-if="runningScripts.size > 0" class="taskListContainer">
      <h4>正在运行的任务</h4>
      <div class="taskList">
        <div v-for="[scriptId] in runningScripts" :key="scriptId" class="taskItem">
          <span class="taskName">{{ scriptId }}</span>
          <button class="terminateButton" @click="terminateScript(scriptId)" title="终止任务">
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- 保留模态框部分 -->
    <div v-if="showOutput" class="modalOverlay" @click="closeOutput">
      <div class="modalContent outputWindow" @click.stop>
        <h3>{{ currentScriptId }} 脚本输出</h3>
        <div class="outputDisplay">
          <pre>{{ outputLog }}</pre>
        </div>
        <div class="modalButtons">
          <button class="closeButton" @click="closeOutput">关闭</button>
        </div>
      </div>
    </div>
    <div v-if="showServerHelp" class="modalOverlay" @click="closeServerHelp">
      <div class="modalContent setupHelp" @click.stop>
        <h3>需要启动Python服务器</h3>
        <p>要直接运行Python脚本，需要在本地启动一个Python WebSocket服务器。</p>
        <ol class="instructionList">
          <li>确保已安装 Python。</li>
          <li>在终端中运行: <code>python python_socket_server.py</code> (假设脚本在项目根目录)</li>
          <li>服务器启动后，刷新此页面或点击下方重新连接按钮。</li>
        </ol>
        <div class="actionsContainer">
          <button class="reconnectButton" @click="reconnectToServer">重新连接</button>
          <button class="closeButton" @click="closeServerHelp">关闭</button>
        </div>
        <div class="noteBox">
          <p><strong>注意：</strong> 服务器运行时需保持终端窗口开启。</p>
        </div>
      </div>
    </div>
    <div v-if="showCommandModal" class="modalOverlay" @click="closeModal">
      <div class="modalContent" @click.stop>
        <h3>命令详情</h3>
        <div class="commandDisplay">
          <pre>{{ currentCommand }}</pre>
        </div>
        <div class="modalButtons">
          <button class="copyButton" @click="copyCommand">
            {{ copySuccess ? '已复制' : '复制命令' }}
          </button>
          <button class="terminalButton" @click="openTerminal">打开终端</button>
          <button class="closeButton" @click="closeModal">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 保留与后端脚本控制和模态框相关的样式 */
.test-component {
  padding: 15px;
  border-radius: 5px;
  background-color: rgba(255, 255, 255, 0.9);
  width: 300px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

h2 {
  text-align: center;
  margin-bottom: 15px;
  color: #333;
}

h3 {
  margin-top: 15px;
  margin-bottom: 10px;
}

.buttonContainer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.buttonContainer > div {
  display: flex;
  align-items: center;
}

.actionButton {
  padding: 8px 15px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.actionButton:hover {
  background-color: #45a049;
}

.actionButton:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.helpButton {
  margin-left: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  cursor: pointer;
  font-weight: bold;
  color: #666;
}

.connectionStatus {
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 14px;
  margin-left: auto;
  align-self: center;
}

.connected {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.disconnected {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.taskListContainer {
  margin-top: 20px;
  padding: 10px;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #eee;
}

.taskListContainer h4 {
  margin-top: 0;
  color: #333;
}

.taskList {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.taskItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.taskName {
  font-size: 14px;
  color: #444;
}

.terminateButton {
  background-color: #ff5252;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
}

.modalOverlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modalContent {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modalContent h3 {
  margin-top: 0;
  color: #333;
}

.outputDisplay,
.commandDisplay {
  background-color: #f6f8fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  white-space: pre-wrap;
}

.modalButtons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.modalButtons button {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  background-color: #f5f5f5;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.modalButtons button:hover {
  background-color: #e9e9e9;
}

.copyButton {
  background-color: #e3f2fd !important;
  color: #1976d2;
  border-color: #bbdefb !important;
}

.copyButton:hover {
  background-color: #bbdefb !important;
}

.closeButton {
  background-color: #f5f5f5;
  color: #666;
}

.terminalButton {
  background-color: #e8f5e9 !important;
  color: #388e3c;
  border-color: #c8e6c9 !important;
}

.terminalButton:hover {
  background-color: #c8e6c9 !important;
}

.reconnectButton {
  background-color: #4caf50 !important;
  color: white;
  border-color: #4caf50 !important;
}

.reconnectButton:hover {
  background-color: #45a049 !important;
}

.instructionList {
  margin: 15px 0;
  padding-left: 20px;
}

.instructionList li {
  margin-bottom: 8px;
}

.noteBox {
  margin-top: 15px;
  padding: 10px;
  background-color: #fff9c4;
  border-radius: 4px;
  border-left: 4px solid #fbc02d;
}
</style>
