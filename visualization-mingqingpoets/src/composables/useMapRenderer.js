import * as echarts from 'echarts'
import chinaMap from '../assets/json/china.json'
import honeycombImage from '../assets/honeycombCracks_1.jpg' // 导入蜂窝纹理图片
// import qingdynastymapImage from '../assets/qingdynastymap.png' // 导入清朝地图图片
// import taiwanImage from '../assets/taiwan.png' // 导入台湾图片
// import hainanImage from '../assets/hainan.png' // 导入海南图片
import axios from 'axios' // 导入axios用于API请求
import { ref } from 'vue' // 导入 ref

// 地点坐标映射表（简化版）
const locationCoordinates = {
    '江西奉新': [115.4, 28.7],
    '廣東中山': [113.4, 22.5],
    '浙江紹興': [120.6, 30.0],
    '江蘇宜興': [119.8, 31.4],
    '浙江杭州': [120.2, 30.3],
    '江蘇泰州': [119.9, 32.5],
    '江蘇揚州': [119.4, 32.4],
    '江蘇儀徵': [119.2, 32.3],
    '江蘇常熟': [120.7, 31.7],
    '江蘇常州': [119.9, 31.8],
    '江蘇丹徒': [119.4, 32.1],
    '江蘇句容': [119.2, 31.9],
    '浙江永康': [120.0, 29.0],
    '吉林長白': [128.2, 41.4],
    '上海松江': [121.2, 31.0],
    '安徽涇縣': [118.4, 30.7],
    '浙江桐鄉': [120.5, 30.6],
    '山東曲阜': [117.0, 35.6],
    '江蘇無錫': [120.3, 31.6],
    '江蘇南京': [118.8, 32.1],
    '湖南寧鄉': [112.6, 28.3],
    '江蘇吳縣': [120.6, 31.3],
    '福建閩侯': [119.1, 26.1],
    '北京': [116.4, 39.9],
    '河北河間': [116.1, 38.4],
    '上海青浦': [121.1, 31.2],
    '浙江嘉興': [120.8, 30.8],
    '湖南湘陰': [112.9, 28.7],
    '江蘇蘇州': [120.6, 31.3],
    '安徽懷寧': [116.8, 30.7],
    '江蘇如皐': [120.6, 32.4],
    '江蘇江陰': [120.3, 31.9],
    '四川成都': [104.1, 30.7],
    '廣東順德': [113.3, 22.8]
}

export function useMapRenderer() {
    // 1. 添加 ref 存储省份统计数据
    const provincePoetCounts = ref({});

    // 保存图层引用，便于更新时清除
    let imageLayersRefs = {
        qingdynastymap: null,
        patternImage: null,
        taiwanImage: null,
        hainanImage: null
    }

    // 保存泡沫图层引用
    let bubbleLayerRef = null
    // 保存热力图层引用
    let heatmapLayerRef = null

    // 图表实例
    let myChart = null

    // 初始化图表
    const initChart = (chartRef) => {
        myChart = echarts.init(chartRef.value)
        echarts.registerMap('china', chinaMap)
        return myChart
    }

    // 获取图表实例
    const getChart = () => myChart

    // 清除图层
    const clearImageLayers = () => {
        if (!myChart) return

        // 2. 清空省份统计数据
        provincePoetCounts.value = {};

        const zr = myChart.getZr()

        // 清除清朝地图图层
        if (imageLayersRefs.qingdynastymap) {
            zr.remove(imageLayersRefs.qingdynastymap)
            imageLayersRefs.qingdynastymap = null
        }

        // 清除其他图层
        if (imageLayersRefs.patternImage) {
            zr.remove(imageLayersRefs.patternImage)
            imageLayersRefs.patternImage = null
        }

        // 确保台湾图层被正确清除
        if (imageLayersRefs.taiwanImage) {
            console.log('清除台湾图层')
            zr.remove(imageLayersRefs.taiwanImage)
            imageLayersRefs.taiwanImage = null
        }

        // 确保海南图层被正确清除
        if (imageLayersRefs.hainanImage) {
            console.log('清除海南图层')
            zr.remove(imageLayersRefs.hainanImage)
            imageLayersRefs.hainanImage = null
        }

        // 清除泡沫图层
        if (bubbleLayerRef) {
            console.log('清除泡沫图层')
            myChart.setOption({
                series: myChart.getOption().series.filter(s => s.name !== '地点分布')
            })
            bubbleLayerRef = null
        }

        // 清除热力图层
        if (heatmapLayerRef) {
            console.log('清除热力图层')
            myChart.setOption({
                series: myChart.getOption().series.filter(s => s.type !== 'heatmap')
            })
            heatmapLayerRef = null
        }

        // 清除 visualMap 组件
        myChart.setOption({
            visualMap: null
        })
    }

    // 渲染地图
    const renderMap = (poetInfo, pointsData, routesData, endpoints) => {
        if (!myChart) return

        // 清除之前的图层 (包括可能存在的泡沫图或热力图)
        clearImageLayers()

        // 处理点数据，为起点和终点设置特殊形状和颜色
        const processedPointsData = pointsData.map((point) => {
            // !! 修改：处理单诗人起点和终点标记
            let isStart = false;
            let isEnd = false;

            // 检查是否为单诗人模式下的起点或终点
            if (endpoints && typeof endpoints === 'object' && !Array.isArray(endpoints)) {
                isStart = point.name === endpoints.startPoint;
                isEnd = point.name === endpoints.endPoint;
            }

            // 如果是起点
            if (isStart) {
                return {
                    ...point,
                    symbol: 'triangle', // 起点使用三角形
                    symbolRotate: 0, // 三角形默认向上
                    symbolSize: 8, // 调小起点大小 (从10改为8)
                    itemStyle: {
                        ...point.itemStyle,
                        color: '#00FF00' // 起点绿色
                    },
                    label: {
                        ...point.label,
                        offset: [0, -10] // 调整标签位置避免遮挡
                    }
                };
            }
            // 如果是终点
            else if (isEnd) {
                return {
                    ...point,
                    symbol: 'rect', // 终点使用正方形
                    symbolSize: 8, // 调小终点大小 (从10改为8)
                    itemStyle: {
                        ...point.itemStyle,
                        color: '#FF0000' // 终点红色
                    }
                };
            }
            // 对比模式下的数据或普通点，保持原样
            // （注意：对比模式下点的样式已在usePoetData中处理，这里主要处理单诗人）
            else if (point.poetName) {
                // 如果是对比模式下的数据，保留原始样式
                return point;
            }

            // 默认返回普通点数据（如果不是起点/终点/对比模式点）
            return {
                ...point,
                symbolSize: 5 // 确保普通点大小为5
            };
        });

        // 指定图表的配置项和数据
        var option = {
            backgroundColor: 'rgba(250, 244, 225, 0.9)', // 设置背景颜色为米黄色
            // 添加提示框组件
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(0,0,0,0.8)', // 修改为黑色背景
                borderColor: '#333', // 边框颜色
                borderWidth: 1,
                padding: 10,
                textStyle: {
                    color: '#fff',
                    fontSize: 14
                },
                formatter: function (params) {
                    console.log('Tooltip Params:', params); // 打印收到的参数
                    console.log('Province Counts:', provincePoetCounts.value); // 打印当前的省份统计数据
                    // 5. 修改 formatter
                    // 地图省份悬浮提示
                    if (params.componentType === 'geo') {
                        const provinceName = params.name;
                        const count = provincePoetCounts.value[provinceName] || 0;
                        return `<div style="font-weight: bold;">${provinceName}</div><div>诗人总数: ${count} 位</div>`;
                    }
                    // 热力图提示 (禁用)
                    else if (params.seriesType === 'heatmap') {
                        return null; // 不显示热力图自身的 tooltip
                    }
                    // 散点/特效散点图提示
                    else if (params.seriesType === 'effectScatter' || params.seriesType === 'scatter') {
                        let pointInfo = '';

                        // 对比模式下显示诗人名称
                        if (params.data.poetName) {
                            pointInfo = `<div>诗人：${params.data.poetName}</div>`;
                        } else {
                            pointInfo = `<div>诗人：${poetInfo ? poetInfo.name : '全部诗人'}</div>`;
                        }

                        // 检查是否为起点/终点
                        let pointType = '';
                        if (endpoints && typeof endpoints === 'object' && !Array.isArray(endpoints)) { // 确保是单诗人模式
                            if (params.name === endpoints.startPoint) { pointType = ' (起点)'; } // 加空格
                            else if (params.name === endpoints.endPoint) { pointType = ' (终点)'; } // 加空格
                        }

                        // 显示额外的时间和事件信息
                        let timeInfo = params.data.time ? `<div>时间: ${params.data.time}</div>` : '';
                        // 为泡沫显示适当的信息
                        let bubbleInfo = '';
                        if (params.seriesName === '地点分布') {
                            bubbleInfo = `<div>现代地名</div>`;
                        }

                        return `<div style="padding: 5px">
                            <div style="font-weight: bold; margin-bottom: 5px; font-size: 16px">${params.name}${pointType}</div>
                            ${pointInfo}
                            ${timeInfo}
                            ${bubbleInfo}
                        </div>`
                    } else {
                        return `` // 路线不显示tooltip
                    }
                }
            },
            geo: {
                type: 'map',
                map: 'china',
                label: {
                    show: false, // 默认不显示标签
                    color: '#fff',
                    fontSize: 8
                },
                itemStyle: {
                    areaColor: '#fff', // 设置地图区域为半透明灰色
                    borderColor: '#bbb'
                },
                zoom: 1, // 将地图缩放级别调整为 1.0 (原为 1.2)
                top: 91, // 增加top值将地图向下移动 (原为 15)
                left: 91.5,
                showLegendSymbol: false, // 不显示图例中的小圆点
                silent: false, // 响应地图交互
                selectedMode: false, // 不允许选择地图区域
                roam: false, // 不允许缩放和平移
                // 禁用南海诸岛显示
                regions: [{
                    name: '南海诸岛',
                    itemStyle: {
                        opacity: 0, // 透明度设置为0，相当于隐藏
                        borderWidth: 0 // 边框宽度设置为0
                    },
                    label: { show: false } // 隐藏标签
                }],
                emphasis: {
                    label: {
                        show: true, // 鼠标悬浮时显示标签
                        color: '#333'
                    },
                    itemStyle: {
                        areaColor: '#1BC1AD'
                    }
                },
                // 4. 设置 geo 的 zlevel
                zlevel: 1.5,
                tooltip: {
                    trigger: 'item',
                    formatter: function (params) {
                        // !! 增加判断：仅在 provincePoetCounts 有效时显示省份统计
                        const provinceCounts = provincePoetCounts.value;
                        // 地图省份悬浮提示
                        if (params.componentType === 'geo' && provinceCounts && Object.keys(provinceCounts).length > 0) {
                            // 使用之前添加的日志进行调试
                            console.log('[GEO Tooltip] Params:', params);
                            console.log('[GEO Tooltip] Province Counts:', provinceCounts);

                            const provinceName = params.name;
                            const count = provinceCounts[provinceName]; // 直接使用 provinceCounts
                            console.log(`[GEO Tooltip] Province: ${provinceName}, Found count: ${count}`);
                            if (count !== undefined) {
                                return `<div style="font-weight: bold;">${provinceName}</div><div>诗人总数: ${count} 位</div>`;
                            } else {
                                // 如果省份名称在统计数据中确实没有，显示 0
                                return `<div style="font-weight: bold;">${provinceName}</div><div>诗人总数: 0 位</div>`;
                            }
                        } else {
                            // 对于非 geo 事件，或者非全部诗人模式（provinceCounts为空），不显示 tooltip
                            // console.log('[GEO Tooltip] Not a geo component event or not in all poets mode', params);
                            return null;
                        }
                    }
                }
            },
            series: [
                // 添加图片覆盖层 (轨迹点)
                {
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    tooltip: {
                        formatter: function (params) {
                            console.log('[EffectScatter Tooltip] Params:', params);
                            let pointInfo = '';
                            // 获取端点信息 (endpoints 是 renderMap 的参数，在此作用域可用)
                            let pointType = '';
                            if (endpoints && typeof endpoints === 'object' && !Array.isArray(endpoints)) { // 确保是单诗人模式
                                if (params.name === endpoints.startPoint) { pointType = ' (起点)'; } // 加空格
                                else if (params.name === endpoints.endPoint) { pointType = ' (终点)'; } // 加空格
                            }
                            let timeInfo = params.data.time ? `<div>时间: ${params.data.time}</div>` : '';
                            let bubbleInfo = '';
                            if (params.seriesName === '地点分布' || params.seriesName === '多选诗人分布') { // 兼容新旧系列名称
                                bubbleInfo = `<div>现代地名</div>`;
                            }
                            return `<div style="padding: 5px">
                                        <div style="font-weight: bold; margin-bottom: 5px; font-size: 16px">${params.name}${pointType}</div>
                                        ${pointInfo}
                                        ${timeInfo}
                                        ${bubbleInfo}
                                    </div>`
                        }
                    },
                    label: {
                        formatter: '{b}',
                        position: 'right',
                        show: false, // 默认不显示标签
                        fontSize: 12, //
                        fontWeight: 'bold',
                        color: '#000'
                    },
                    emphasis: {
                        label: {
                            show: true, // 修改为鼠标悬浮时显示标签
                            color: '#fff',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            padding: [4, 8],
                            borderRadius: 4
                        },
                        itemStyle: {
                            color: '#ffcc00', // 悬浮时点的高亮颜色
                            borderColor: '#fff',
                            borderWidth: 2,
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        },
                        scale: true // 启用缩放效果
                    },
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: '#f00',
                        color: '#f00'
                    },
                    symbolSize: 5, // 减小点的大小
                    rippleEffect: {
                        brushType: 'stroke',
                        scale: 2.5 // 减小特效的大小
                    },
                    zlevel: 5, // 增加点的层级，确保在最上层
                    data: processedPointsData
                },
                // 动态生成路线系列
                ...routesData.map((route) => ({
                    type: 'lines',
                    zlevel: 2, // 设置zlevel高于地图和图片，但低于点
                    tooltip: { show: false },
                    effect: {
                        show: true, // 修改：默认显示箭头动画效果
                        period: 5,
                        symbol: 'arrow',
                        symbolSize: 5,
                        color: route.lineStyle?.color || route.color || '#f00'
                    },
                    lineStyle: {
                        color: route.lineStyle?.color || route.color || '#f00',
                        width: route.lineStyle?.width || 1.5,
                        opacity: route.lineStyle?.opacity || 0.9, // 修改：默认设置为可见
                        curveness: route.lineStyle?.curveness || route.curveness || 0.1
                    },
                    emphasis: {
                        lineStyle: {
                            opacity: 0.9 // 悬浮时增加透明度
                        },
                        effect: {
                            show: true, // 悬浮时显示箭头效果
                            opacity: 1 // 悬浮时箭头完全不透明
                        }
                    },
                    data: route.data
                }))
            ]
        }

        // 使用刚指定的配置项和数据显示图表。
        console.log('渲染地图数据:', {
            poetInfo,
            pointsData: processedPointsData,
            routesData,
            endpoints
        })
        myChart.setOption(option, true)

        // 添加装饰图层
        addDecorationLayers()

        return myChart
    }

    // 添加装饰图层
    const addDecorationLayers = () => {
        if (!myChart) return

        const zr = myChart.getZr()
        // const scaleFactor = 0.8 // 缩放因子 (80%)

        // 添加覆盖图片（清朝地图）
        // const qingWidth = 730 * scaleFactor
        // const qingHeight = 520 * scaleFactor
        // const qingX = -12 + (730 * (1 - scaleFactor)) / 2
        // const qingY = -3 + (520 * (1 - scaleFactor)) / 2
        // imageLayersRefs.qingdynastymap = new echarts.graphic.Image({
        //     style: {
        //         image: qingdynastymapImage,
        //         x: qingX,
        //         y: qingY,
        //         width: qingWidth,
        //         height: qingHeight,
        //         opacity: 0.15
        //     },
        //     zlevel: 1.2
        // })
        // zr.add(imageLayersRefs.qingdynastymap)

        // 预加载蜂窝纹理图片并确保图片加载完成后再进行后续操作
        const honeycombImg = new Image()
        honeycombImg.onload = function () {
            // 获取ZRender实例和Canvas上下文
            const canvas = document.createElement('canvas')
            canvas.width = myChart.getWidth()
            canvas.height = myChart.getHeight()
            const ctx = canvas.getContext('2d')

            // 绘制蜂窝纹理作为背景
            ctx.drawImage(honeycombImg, 0, 0, canvas.width, canvas.height)

            // 创建圆形遮罩（挖洞）
            ctx.globalCompositeOperation = 'destination-out'
            ctx.beginPath()
            ctx.arc(400, 300, 200, 0, Math.PI * 2)
            ctx.fill()

            // 重置合成模式
            ctx.globalCompositeOperation = 'source-over'

            // 恢复圆形边框
            ctx.strokeStyle = 'rgb(162, 162, 162)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(400, 300, 200, 0, Math.PI * 2)
            ctx.stroke()

            // 将Canvas作为图像添加到图表
            imageLayersRefs.patternImage = new echarts.graphic.Image({
                style: {
                    image: canvas,
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                    opacity: 1
                },
                zlevel: 2, // 高于热力图 (zlevel: 3)
                silent: true // 忽略鼠标事件，允许事件穿透
            })
            zr.add(imageLayersRefs.patternImage)

            // // 独立加载台湾图片
            // if (imageLayersRefs.taiwanImage === null) {
            //     const taiwanImg = new Image()
            //     taiwanImg.onload = function () {
            //         if (imageLayersRefs.taiwanImage === null) {
            //             console.log('添加台湾图片')
            //             const taiwanWidth = 23 * scaleFactor
            //             const taiwanHeight = 55 * scaleFactor
            //             const taiwanX = 478 + (23 * (1 - scaleFactor)) / 2
            //             const taiwanY = 400 + (55 * (1 - scaleFactor)) / 2
            //             imageLayersRefs.taiwanImage = new echarts.graphic.Image({
            //                 style: {
            //                     image: taiwanImg,
            //                     x: taiwanX,
            //                     y: taiwanY,
            //                     width: taiwanWidth,
            //                     height: taiwanHeight,
            //                     opacity: 0.1
            //                 },
            //                 zlevel: 10
            //             })
            //             zr.add(imageLayersRefs.taiwanImage)
            //         }
            //     }
            //     taiwanImg.src = taiwanImage
            // }

            // // 独立加载海南图片
            // if (imageLayersRefs.hainanImage === null) {
            //     const hainanImg = new Image()
            //     hainanImg.onload = function () {
            //         if (imageLayersRefs.hainanImage === null) {
            //             console.log('添加海南图片')
            //             const hainanWidth = 28 * scaleFactor
            //             const hainanHeight = 28 * scaleFactor
            //             const hainanX = 381 + (28 * (1 - scaleFactor)) / 2
            //             const hainanY = 460 + (28 * (1 - scaleFactor)) / 2
            //             imageLayersRefs.hainanImage = new echarts.graphic.Image({
            //                 style: {
            //                     image: hainanImg,
            //                     x: hainanX,
            //                     y: hainanY,
            //                     width: hainanWidth,
            //                     height: hainanHeight,
            //                     opacity: 0.1
            //                 },
            //                 zlevel: 10
            //             })
            //             zr.add(imageLayersRefs.hainanImage)
            //         }
            //     }
            //     hainanImg.src = hainanImage
            // }
        }

        // 设置图片源，触发加载
        honeycombImg.src = honeycombImage
    }

    // 渲染泡沫图
    const renderPlaceBubbles = async (selectedPoets = []) => {
        if (!myChart) return

        // 确保在泡沫模式下清除热力图
        if (heatmapLayerRef) {
            console.log('清除热力图层（切换到泡沫图）')
            myChart.setOption({
                series: myChart.getOption().series.filter(s => s.type !== 'heatmap'),
                visualMap: null // 同时清除 visualMap
            })
            heatmapLayerRef = null
        }

        try {
            console.log('开始获取地点和诗人数据以渲染泡沫图')

            // 清除已有的泡沫图层
            if (bubbleLayerRef) {
                console.log('清除现有泡沫图层')
                myChart.setOption({
                    series: myChart.getOption().series.filter(s => s.name !== '地点分布')
                })
                bubbleLayerRef = null
            }

            // 获取地点和诗人数据
            const response = await axios.get('http://localhost:8080/api/poet-life/all-places')
            const placePoetPairs = response.data // 现在是 {place: string, poetName: string}[]

            // 检查是否需要根据选中诗人过滤数据
            const isMultiSelectMode = selectedPoets && selectedPoets.length > 0

            let filteredPairs = placePoetPairs
            if (isMultiSelectMode) {
                // 获取选中诗人的姓名列表
                const selectedPoetNames = selectedPoets.map(poet => poet.name)
                console.log(`多选模式：已选择诗人 ${selectedPoetNames.join(', ')}，将过滤泡沫`)

                // 过滤只保留选中诗人的地点
                filteredPairs = placePoetPairs.filter(pair =>
                    selectedPoetNames.includes(pair.poetName)
                )

                console.log(`过滤后的地点-诗人数据: ${filteredPairs.length} 条`)
            } else {
                // 如果不是多选模式，不应该显示泡沫图，交由热力图处理
                console.warn('renderPlaceBubbles 被调用，但不是多选模式。应由热力图处理此情况。' +
                    '清空泡沫图层并返回。')
                return;
            }

            console.log(isMultiSelectMode ? '多选诗人模式的泡沫数据:' : '原始地点-诗人数据:', filteredPairs)

            // 如果没有数据可显示，返回
            if (filteredPairs.length === 0) {
                console.warn('没有要显示的地点数据')
                return
            }

            // 从原始数据创建泡沫数据（每个地点-诗人对都可能创建一个泡沫）
            // 注意：一个地点可能对应多个诗人，这里会为每个关联关系创建一个泡沫
            const bubbleData = filteredPairs.map((pair, index) => {
                const placeName = pair.place; // 获取地点名称
                const poetName = pair.poetName; // 获取诗人名称

                // 检查是否有该地点的坐标
                if (locationCoordinates[placeName]) {
                    // 获取基础坐标
                    const [baseLng, baseLat] = locationCoordinates[placeName]

                    // 改进偏移量计算逻辑，使泡沫更好地错开显示
                    // 1. 创建更具区分度的偏移种子
                    let offsetSeed = 0;

                    // 使用诗人名字的每个字符生成偏移种子
                    if (poetName) {
                        for (let i = 0; i < poetName.length; i++) {
                            offsetSeed += poetName.charCodeAt(i);
                        }
                    }

                    // 加入地点名称的信息
                    for (let i = 0; i < Math.min(placeName.length, 3); i++) {
                        offsetSeed += placeName.charCodeAt(i);
                    }

                    // 再加入索引确保唯一性
                    offsetSeed = (offsetSeed * 13 + index * 7) % 997; // 使用质数增加随机性

                    // 将偏移种子归一化到 [0,1] 范围
                    const normalizedSeed = offsetSeed / 997;

                    // 2. 生成环形分布的偏移
                    // 将种子转换为角度 (0-2π)
                    const angle = normalizedSeed * Math.PI * 2;

                    // 计算偏移距离 (0.1-0.4 范围内)
                    const distance = 0.1 + normalizedSeed * 0.3;

                    // 根据角度和距离计算 x, y 偏移
                    const offsetLng = Math.cos(angle) * distance;
                    const offsetLat = Math.sin(angle) * distance;

                    return {
                        name: placeName, // 泡沫的名称仍然是地点
                        poetName: poetName, // 存储关联的诗人名称
                        coord: [baseLng + offsetLng, baseLat + offsetLat],
                        index: index, // 保存索引，用于创建唯一标识
                        // 添加原始坐标，用于工具提示显示
                        originalCoord: [baseLng, baseLat]
                    }
                }
                return null
            }).filter(item => item !== null) // 过滤掉没有坐标的地点

            console.log('准备渲染的泡沫数据:', bubbleData)

            // 如果没有有效数据，返回
            if (bubbleData.length === 0) {
                console.warn('没有有效的地点坐标数据，无法渲染泡沫图')
                return
            }

            // 为多选模式中的选中诗人分配不同颜色
            const poetColorMap = new Map()
            if (isMultiSelectMode) {
                const poetColors = [
                    '#8B5CF6', // 紫色
                    '#EC4899', // 粉色
                    '#3B82F6', // 蓝色
                    '#10B981', // 绿色
                    '#F59E0B', // 黄色
                    '#EF4444', // 红色
                    '#6366F1', // 靛蓝
                    '#14B8A6', // 青绿
                    '#F97316'  // 橙色
                ]
                selectedPoets.forEach((poet, index) => {
                    poetColorMap.set(poet.name, poetColors[index % poetColors.length])
                })
            }

            // 转换数据为ECharts格式
            const echartsMultiSelectPointsData = bubbleData.map(item => {
                // 确定点的颜色 - 在多选模式下使用诗人对应的颜色
                let pointColor = '#3B82F6' // 默认蓝色
                let pointSize = 3 // 默认大小，与轨迹点一致（从5改为3）

                if (isMultiSelectMode && poetColorMap.has(item.poetName)) {
                    pointColor = poetColorMap.get(item.poetName)
                    pointSize = 4 // 选中诗人的点稍大一些（从6改为4）
                }

                return {
                    name: item.name, // 地点名称
                    poetName: item.poetName, // 添加诗人名称
                    value: item.coord.concat(1), // 1是默认值，用于保持接口一致
                    symbolSize: pointSize, // 点的大小
                    itemId: item.index, // 使用索引作为唯一标识
                    originalCoord: item.originalCoord, // 保存原始坐标
                    itemStyle: {
                        color: pointColor // 点的颜色
                        // 移除阴影效果
                    }
                }
            })

            // 添加多选模式的特效散点图图层
            const multiSelectPointsSeries = {
                name: '多选诗人分布', // 修改系列名称以便区分
                type: 'effectScatter', // 修改类型为 effectScatter
                coordinateSystem: 'geo',
                data: echartsMultiSelectPointsData,
                zlevel: 6,
                rippleEffect: { // 添加特效
                    brushType: 'stroke',
                    scale: 1.8 // 减小特效规模(从2.5改为1.8)
                },
                label: {
                    show: false, // 不显示标签
                    position: 'right',
                    formatter: '{b}'
                },
                emphasis: {
                    label: {
                        show: true,
                        color: '#fff',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: [4, 8],
                        borderRadius: 4
                    },
                    itemStyle: {
                        color: '#FF7E50', // 高亮时颜色为橙色
                        borderColor: '#fff',
                        borderWidth: 2
                        // 移除阴影效果
                    },
                    scale: true // 启用缩放效果
                }
            }

            // 获取当前配置
            const option = myChart.getOption()

            // 移除旧的'地点分布'系列（如果存在）
            option.series = option.series.filter(s => s.name !== '地点分布');

            // 添加新的'多选诗人分布'系列
            option.series.push(multiSelectPointsSeries)

            // 更新图表
            myChart.setOption(option)

            // 保存引用 (更新引用名称)
            bubbleLayerRef = multiSelectPointsSeries // 注意：这里依然使用 bubbleLayerRef，但指向的是新系列

            console.log(`多选诗人分布图渲染完成，共 ${echartsMultiSelectPointsData.length} 个点`)
        } catch (error) {
            console.error('渲染多选诗人分布图失败:', error)
        }
    }

    // 新增：渲染热力图
    const renderHeatmap = async () => {
        if (!myChart) return;

        // 确保在热力图模式下清除泡沫图
        if (bubbleLayerRef) {
            console.log('清除泡沫图层（切换到热力图）');
            myChart.setOption({
                series: myChart.getOption().series.filter(s => s.name !== '地点分布')
            });
            bubbleLayerRef = null;
        }

        try {
            console.log('开始获取地点数据以渲染热力图');
            // 获取地点和诗人数据
            const response = await axios.get('http://localhost:8080/api/poet-life/all-places');
            const placePoetPairs = response.data;

            if (!placePoetPairs || placePoetPairs.length === 0) {
                console.warn('没有获取到地点数据，无法渲染热力图');
                return;
            }

            // 聚合数据：计算每个地点的诗人数量
            const placeCounts = {};
            placePoetPairs.forEach(pair => {
                const placeName = pair.place;
                if (locationCoordinates[placeName]) {
                    if (!placeCounts[placeName]) {
                        placeCounts[placeName] = {
                            coord: locationCoordinates[placeName],
                            count: 0
                        };
                    }
                    placeCounts[placeName].count += 1;
                }
            });

            // 3. 计算省份统计数据
            const tempProvinceCounts = {};
            // !! 保持使用简体全称作为 Key 和 Value，因为地图事件params.name是简体
            const provinceNameMapping = {
                '京': '北京市', '津': '天津市', '沪': '上海市', '渝': '重庆市',
                '冀': '河北省', '豫': '河南省', '云': '云南省', '辽': '辽宁省',
                '黑': '黑龙江省', '湘': '湖南省', '皖': '安徽省', '鲁': '山东省',
                '新': '新疆维吾尔自治区', '苏': '江苏省', '浙': '浙江省', '赣': '江西省',
                '鄂': '湖北省', '桂': '广西壮族自治区', '甘': '甘肃省', '晋': '山西省',
                '蒙': '内蒙古自治区', '陕': '陕西省', '吉': '吉林省', '闽': '福建省',
                '贵': '贵州省', '粤': '广东省', '青': '青海省', '藏': '西藏自治区',
                '川': '四川省', '宁': '宁夏回族自治区', '琼': '海南省'
            };
            // 添加一个繁体简称到简体全称的映射 (仅用于匹配输入)
            const traditionalToSimplifiedMap = {
                '廣東': '广东省', '廣西': '广西壮族自治区', '臺灣': '台湾省', // 示例
                '江蘇': '江苏省', '江西': '江西省', '遼寧': '辽宁省',
                '陝西': '陕西省', '雲南': '云南省', '貴州': '贵州省',
                // ... 可能需要补充更多 ...
            };

            Object.entries(placeCounts).forEach(([placeName, data]) => {
                let provinceFullName = '未知省份'; // 最终存储的 Key (简体全称)

                if (locationCoordinates[placeName]) { // 确保地点有效
                    // 1. 精确匹配直辖市 (简体)
                    const prefix2Simplified = placeName.substring(0, 2); // 假设 placeName 可能是繁体
                    if (['北京', '天津', '上海', '重庆'].includes(prefix2Simplified)) {
                        provinceFullName = prefix2Simplified + '市';
                    } else {
                        let foundMatch = false;

                        // 2. 优先匹配繁体简称（如果输入是繁体）
                        for (const traditionalShortName in traditionalToSimplifiedMap) {
                            if (placeName.startsWith(traditionalShortName)) {
                                provinceFullName = traditionalToSimplifiedMap[traditionalShortName]; // 获取对应的简体全称
                                foundMatch = true;
                                break;
                            }
                        }

                        // 3. 如果繁体没匹配上，再尝试匹配简体长简称
                        if (!foundMatch) {
                            const sortedProvinceShortNames = Object.values(provinceNameMapping)
                                .map(p => p.replace(/省|市|自治区|壮族自治区|回族自治区|维吾尔自治区$/, ''))
                                .filter(name => name.length > 1)
                                .sort((a, b) => b.length - a.length);

                            for (const shortName of sortedProvinceShortNames) {
                                if (placeName.startsWith(shortName)) {
                                    provinceFullName = Object.values(provinceNameMapping).find(value =>
                                        value.startsWith(shortName)
                                    ) || '未知省份';
                                    foundMatch = true;
                                    break;
                                }
                            }
                        }

                        // 4. 如果还没匹配上，尝试单字简称 (简体)
                        if (!foundMatch) {
                            const prefix1 = placeName.substring(0, 1);
                            if (provinceNameMapping[prefix1]) {
                                // ... (冲突检查逻辑可以保留或简化)
                                provinceFullName = provinceNameMapping[prefix1];
                            }
                        }
                    }
                    console.log(`[Province Mapping] Place: "${placeName}" -> Province Key: "${provinceFullName}"`);
                }

                if (provinceFullName !== '未知省份') {
                    // 使用确定的简体全称作为 Key 累加计数
                    tempProvinceCounts[provinceFullName] = (tempProvinceCounts[provinceFullName] || 0) + data.count;
                }
            });

            // 更新 ref
            provincePoetCounts.value = tempProvinceCounts;
            console.log("按省份统计诗人数量 (使用全称):", provincePoetCounts.value);

            // 转换数据为 ECharts 热力图格式：[lng, lat, count]
            const heatmapData = Object.values(placeCounts).map(item => [
                item.coord[0],
                item.coord[1],
                item.count
            ]);

            // 找到最大计数值，用于 visualMap
            const maxCount = Math.max(...heatmapData.map(item => item[2]), 0);

            console.log(`准备渲染热力图数据，共 ${heatmapData.length} 个地点，最大热度: ${maxCount}`);

            const heatmapSeries = {
                name: '诗人分布热力',
                type: 'heatmap',
                coordinateSystem: 'geo',
                data: heatmapData,
                pointSize: 8, // 增大热力图点的大小（原为5）
                blurSize: 6, // 增大热力图模糊大小（原为6）
                zlevel: 3, // 热力图层级，在地图之上，轨迹之下
                tooltip: {
                    show: false // 禁用热力图自身的 tooltip
                }
            };

            // 获取当前配置
            const option = myChart.getOption();

            // 添加热力图系列
            option.series.push(heatmapSeries);

            // 添加 visualMap 组件控制颜色
            option.visualMap = {
                min: 0,
                max: maxCount,
                calculable: true,
                seriesIndex: option.series.length - 1, // 指向新添加的热力图系列
                orient: 'horizontal',
                left: 'center',
                bottom: 10,
                splitNumber: 5,
                inRange: {
                    color: ['#f9d776', '#f59e56', '#e37145', '#d04e37', '#b22222'].reverse() // 更深的颜色从黄色到红色
                },
                textStyle: {
                    color: '#333'
                }
            };

            // 更新图表
            myChart.setOption(option);

            // 保存引用
            heatmapLayerRef = heatmapSeries;

            console.log('热力图渲染完成');

        } catch (error) {
            console.error('渲染热力图失败:', error);
        }
    };

    // 设置点悬停事件处理
    const setupPointHoverEvents = (callback) => {
        if (!myChart) return

        // 为点添加mouseover事件处理
        myChart.getZr().on('mouseover', function (params) {
            // 检查是否为泡沫图层
            if (params.target && params.target.__ec_inner && params.target.__ec_inner.seriesModel && params.target.__ec_inner.seriesModel.name === '地点分布') {
                const dataIndex = params.target.dataIndex;
                const option = myChart.getOption();
                const seriesData = option.series.find(s => s.name === '地点分布')?.data;
                if (seriesData && dataIndex >= 0 && dataIndex < seriesData.length) {
                    const point = seriesData[dataIndex];
                    // 显示 tooltip (注意：泡沫图的 tooltip 格式在 renderMap 中定义)
                    myChart.dispatchAction({
                        type: 'showTip',
                        seriesIndex: option.series.findIndex(s => s.name === '地点分布'), // 找到泡沫图系列的索引
                        dataIndex: dataIndex
                    });
                    // 调用回调处理悬停事件 (如果需要对泡沫图做特殊处理)
                    if (callback) {
                        callback('hover', point, 'bubble'); // 添加类型标识
                    }
                }
            }
            // 处理轨迹点 (保持原有逻辑)
            else if (params.target && params.target.dataIndex !== undefined) {
                // ... (原有轨迹点 mouseover 逻辑)
                const dataIndex = params.target.dataIndex
                const option = myChart.getOption()
                // 假设轨迹点是第一个 series
                const pointsData = option.series[0]?.data

                if (pointsData && dataIndex >= 0 && dataIndex < pointsData.length) {
                    const point = pointsData[dataIndex]
                    // 高亮轨迹点
                    myChart.dispatchAction({
                        type: 'highlight',
                        seriesIndex: 0,
                        dataIndex: dataIndex
                    })
                    // 显示轨迹点 tooltip
                    myChart.dispatchAction({
                        type: 'showTip',
                        seriesIndex: 0,
                        dataIndex: dataIndex
                    })
                    // 调用回调处理悬停事件
                    if (callback) {
                        callback('hover', point, 'trace') // 添加类型标识
                    }
                }
            }
        })

        // 为点添加mouseout事件处理
        myChart.getZr().on('mouseout', function (params) {
            // 检查是否为泡沫图层
            if (params.target && params.target.__ec_inner && params.target.__ec_inner.seriesModel && params.target.__ec_inner.seriesModel.name === '地点分布') {
                // 隐藏 tooltip
                myChart.dispatchAction({ type: 'hideTip' });
                // 调用回调处理离开事件 (如果需要对泡沫图做特殊处理)
                if (callback) {
                    callback('leave', null, 'bubble'); // 添加类型标识
                }
            }
            // 处理轨迹点 (保持原有逻辑)
            else if (params.target && params.target.dataIndex !== undefined) {
                // ... (原有轨迹点 mouseout 逻辑)
                const dataIndex = params.target.dataIndex
                // 取消高亮轨迹点
                myChart.dispatchAction({
                    type: 'downplay',
                    seriesIndex: 0,
                    dataIndex: dataIndex
                })
                // 隐藏轨迹点 tooltip
                myChart.dispatchAction({
                    type: 'hideTip'
                })
                // 调用回调处理离开事件
                if (callback) {
                    callback('leave', null, 'trace') // 添加类型标识
                }
            }
        })
    }

    // 调整图表大小
    const resizeChart = () => {
        if (myChart) {
            myChart.resize()
        }
    }

    return {
        initChart,
        getChart,
        clearImageLayers,
        renderMap,
        setupPointHoverEvents,
        resizeChart,
        renderPlaceBubbles, // 导出泡沫图渲染函数
        renderHeatmap       // 导出热力图渲染函数
    }
}