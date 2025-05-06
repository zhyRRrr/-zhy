// 显示提示信息
export const showTooltip = (text, x, y) => {
    if (!myChart) return

    // 先隐藏之前的提示框
    hideTooltip()

    // 获取图表相对于视窗的位置
    const chartRect = myChart.getDom().getBoundingClientRect()

    // 将文本分割为多行
    const lines = text.split('\n')
    const padding = 10
    const width = 220 // 增加悬浮窗宽度，以适应更多内容

    // 调整位置避免溢出视窗
    let tooltipX = x - width / 2 // 将悬浮窗水平居中于鼠标位置
    let tooltipY = y + 15 // 向下偏移一点距离，显示在点的下方

    // 确保悬浮窗不会超出图表边界
    if (tooltipX < 20) tooltipX = 20
    if (tooltipX + width > chartRect.width - 20) tooltipX = chartRect.width - width - 20

    // 创建一个div元素作为提示框的容器
    const tooltipContainer = document.createElement('div')
    tooltipContainer.style.position = 'fixed'
    tooltipContainer.style.left = chartRect.left + tooltipX + 'px'
    tooltipContainer.style.top = chartRect.top + tooltipY + 'px'
    tooltipContainer.style.width = width + 'px'
    tooltipContainer.style.padding = padding + 'px'
    tooltipContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
    tooltipContainer.style.color = '#fff'
    tooltipContainer.style.borderRadius = '4px'
    tooltipContainer.style.zIndex = '10000' // 非常高的z-index确保在最上层
    tooltipContainer.style.pointerEvents = 'none' // 避免捕获鼠标事件
    tooltipContainer.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)'
    tooltipContainer.style.maxHeight = '300px' // 限制最大高度
    tooltipContainer.style.overflowY = 'auto' // 如果内容过多可以滚动

    // 检查文本是否包含HTML标签
    const containsHtml = /<[a-z][\s\S]*>/i.test(text);

    if (containsHtml) {
        // 如果包含HTML，直接设置innerHTML
        tooltipContainer.innerHTML = text;
    } else {
        // 添加文本内容，根据是否为标题行使用不同样式
        let isPoetList = false;

        lines.forEach((line, index) => {
            const div = document.createElement('div')
            div.textContent = line

            // 第一行为标题（年份），设置为粗体
            if (index === 0) {
                div.style.fontWeight = 'bold'
                div.style.fontSize = '14px'
                div.style.marginBottom = '6px'
            }
            // 第二行为诗人数量，设置较大间距
            else if (index === 1) {
                div.style.marginBottom = '8px'
                div.style.fontSize = '12px'
            }
            // 空行表示下一部分是诗人列表
            else if (line === '') {
                isPoetList = true
                div.style.height = '4px'
            }
            // 诗人姓名显示为特殊样式
            else if (isPoetList) {
                div.style.color = '#ffcccc' // 诗人姓名使用浅红色
                div.style.fontSize = '12px'
                div.style.marginBottom = '3px'
                div.style.paddingLeft = '10px'
            }
            // 其他内容
            else {
                div.style.marginBottom = index < lines.length - 1 ? '4px' : '0'
                div.style.fontSize = '12px'
            }

            div.style.fontFamily = 'Microsoft YaHei, sans-serif'
            tooltipContainer.appendChild(div)
        })
    }

    // 将提示框添加到body
    document.body.appendChild(tooltipContainer)

    // 保存提示框引用，以便后续移除
    myChart.poetTooltip = tooltipContainer
}

// 隐藏提示信息
export const hideTooltip = () => {
    if (!myChart) return

    if (myChart.poetTooltip) {
        // 如果提示框是DOM元素，直接从文档中移除
        if (myChart.poetTooltip instanceof HTMLElement) {
            document.body.removeChild(myChart.poetTooltip)
        }
        // 如果是echarts元素，从zrender中移除
        else {
            const zr = myChart.getZr()
            // 如果有文本元素，一并移除
            if (myChart.poetTooltip.textElements) {
                myChart.poetTooltip.textElements.forEach((textElement) => {
                    zr.remove(textElement)
                })
            }
            zr.remove(myChart.poetTooltip)
        }

        myChart.poetTooltip = null
    }
}

// 提示框模块需要访问图表实例
let myChart = null

// 初始化函数，用于设置图表实例
export const setTooltipChart = (chart) => {
    myChart = chart
} 