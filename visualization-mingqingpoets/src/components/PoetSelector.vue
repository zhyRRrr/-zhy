<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'

// 定义诗人接口
interface Poet {
  id: number
  name: string
}

// 定义动态获取的诗人列表
const poets = ref<Poet[]>([])
// 加载状态
const loading = ref(true)
// 加载错误信息
const error = ref<string | null>(null)

// 从API获取诗人列表
const fetchPoets = async () => {
  loading.value = true
  error.value = null

  try {
    // 从包含所有诗人诗词分布的API获取诗人列表
    const response = await axios.get('http://localhost:8080/api/poet-life/all-distributions')
    if (response.data && typeof response.data === 'object') {
      // 从对象的键提取诗人名称
      const poetNames = Object.keys(response.data)
      // 将名称转换为Poet对象数组
      poets.value = poetNames.map((name, index) => ({
        id: index + 1,
        name: name
      }))
      console.log(`PoetSelector - 成功从API获取 ${poets.value.length} 位诗人`)
    } else {
      throw new Error('API返回的数据格式不正确')
    }
  } catch (err) {
    console.error('获取诗人列表失败:', err)
    error.value = '获取诗人列表失败，使用默认列表'

    // 加载失败时使用备用数据 - 包含常用诗人
    // poets.value = [
    //   { id: 1, name: '曾懿' },
    //   { id: 2, name: '宗婉' },
    //   { id: 3, name: '左錫嘉' },
    //   { id: 4, name: '曾昭岷' },
    //   { id: 5, name: '曾华鹏' },
    //   { id: 6, name: '仲蓮慶' },
    //   { id: 7, name: '仲振宜' },
    //   { id: 8, name: '仲振宣' },
    //   { id: 9, name: '趙箋霞' },
    //   { id: 10, name: '洪湘蘭' },
    //   { id: 11, name: '仲貽鑾' },
    //   { id: 12, name: '張貽鷮' },
    //   { id: 13, name: '袁杼' },
    //   { id: 14, name: '袁棠' },
    //   { id: 15, name: '袁機' },
    //   { id: 16, name: '袁綬' },
    //   { id: 17, name: '錢守璞' }
    // ]
    console.log('PoetSelector - 使用备用诗人列表')
  } finally {
    loading.value = false
  }
}

// 组件挂载时获取诗人列表
onMounted(() => {
  fetchPoets()
})

// 定义 props
const props = defineProps({
  poetNames: {
    type: Array as () => string[],
    required: false,
    default: () => []
  }
})

// --- Event Dispatching Functions (由 watcher 调用) ---

const dispatchPoetChanged = (poet: Poet | { name: string; id: string | number }) => {
  window.dispatchEvent(
    new CustomEvent('poet-changed', {
      detail: { poet: poet.name, name: poet.name, id: poet.id }
    })
  )
  console.log(`PoetSelector - Dispatched poet-changed: ${poet.name}`)
}

const dispatchMultiSelectModeChanged = (enabled: boolean) => {
  window.dispatchEvent(
    new CustomEvent('multi-select-mode-changed', {
      detail: { enabled }
    })
  )
  console.log(`PoetSelector - Dispatched multi-select-mode-changed: ${enabled}`)
}

const dispatchPoetsMultiSelected = (selectedPoets: Poet[]) => {
  window.dispatchEvent(
    new CustomEvent('poets-multi-selected', {
      detail: { poets: [...selectedPoets] }
    })
  )
  console.log(
    `PoetSelector - Dispatched poets-multi-selected: ${selectedPoets.map((p: Poet) => p.name).join(', ')}`
  )
}

// --- Watcher for External poetNames Prop --- (直接触发事件，无内部状态)
watch(
  () => props.poetNames,
  (newNames) => {
    console.log('PoetSelector - Received poetNames prop update:', newNames)

    // 检查传入的数据是否有效
    if (!newNames || !Array.isArray(newNames) || newNames.length === 0) {
      console.log('PoetSelector - Resetting to "全部诗人" due to invalid/empty prop.')
      // 触发"全部诗人"状态
      dispatchMultiSelectModeChanged(false)
      dispatchPoetChanged({ name: '全部诗人', id: '0' })
      return
    }

    // 根据名称查找匹配的诗人对象
    const matchedPoets: Poet[] = newNames
      .map((name: string) => {
        // 使用动态加载的诗人列表
        const found = poets.value.find((p: Poet) => p.name === name)
        if (!found) {
          console.warn(`PoetSelector - Incoming poet name "${name}" not found in poets list.`)
        }
        return found
      })
      .filter((p): p is Poet => p !== undefined) // 过滤掉未找到的并确保类型安全

    // 根据匹配结果分发事件
    if (matchedPoets.length === 1) {
      const poet = matchedPoets[0]
      console.log('PoetSelector - Dispatching single-select mode via prop:', poet.name)
      dispatchMultiSelectModeChanged(false)
      dispatchPoetChanged(poet)
    } else if (matchedPoets.length >= 2) {
      console.log(
        'PoetSelector - Dispatching multi-select mode via prop:',
        matchedPoets.map((p: Poet) => p.name)
      )
      dispatchMultiSelectModeChanged(true)
      dispatchPoetsMultiSelected(matchedPoets)
    } else {
      // 如果提供了名称但一个都未匹配到
      console.log('PoetSelector - Resetting to "全部诗人" because no names matched.')
      dispatchMultiSelectModeChanged(false)
      dispatchPoetChanged({ name: '全部诗人', id: '0' })
    }
  },
  { immediate: true, deep: true } // immediate 确保初始加载时运行，deep 以防万一（虽然对 string[] 可能不需要）
)
</script>
