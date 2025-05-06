import { ref, onMounted } from 'vue'
import axios from 'axios'

// 导入拆分出的组件
import { getColorByStage } from './utils'
import { showTooltip, hideTooltip, setTooltipChart } from './tooltip'
import { renderPoetLifeStages, renderBasicElements } from './rendering'
import { renderPoetLifeSpans, clearRenderedPoetsRecord } from './lifeSpans' // 导入生命线渲染函数和清除函数
import { renderTimePoints } from './timePoints' // 导入时间点渲染函数
import { useAllPoetDistributions } from '../allpoetdata/useAllPoetDistributions'

// 定义半径常量
const RADIUS_ALL_POETS = 160; // 全部诗人模式的小半径
const RADIUS_DEFAULT = 200;  // 默认大半径

export function useLifeStageVisualization() {
    // 当前激活的生命阶段点
    const activeStage = ref(null)
    // 存储诗人时间线数据
    const poetTimelineData = ref({
        minYear: 0,
        maxYear: 0,
        timePoints: [],
        yearCounts: {},
        yearPoets: {},
        poetLifeSpans: []
    })

    // 存储API返回的时间线数据
    const timelineData = ref({
        poets: [],
        timelines: []
    })

    // 存储全部诗人诗词量统计数据
    const allPoetsStageData = ref(null)

    // 存储选中的多个诗人
    const selectedPoets = ref([])

    // 存储诗人事件数据
    const poetEventsData = ref([])

    // 当前选中的诗人ID
    const selectedPoetId = ref(null)

    // 当前选中的诗人名称
    const selectedPoetName = ref('')

    // *** 2. 调用 useAllPoetDistributions 获取数据 ***
    const {
        allYearCounts,
        minYear: distributionMinYear, // 重命名以避免与 poetTimelineData 冲突
        maxYear: distributionMaxYear, // 重命名以避免与 poetTimelineData 冲突
        isLoading: distributionIsLoading,
        error: distributionError
    } = useAllPoetDistributions();

    // 获取全部诗人诗词量统计数据
    const fetchAllPoetsStageData = async (selectedPoetsList = []) => {
        try {
            console.log('获取全部诗人诗词量统计数据...')
            const response = await axios.get('http://localhost:5000/api/all_poets_poem_count')
            if (response.data && response.data.status === 'success') {
                const poetsData = response.data.data.poets
                console.log(`获取到 ${poetsData.length} 个诗人的诗词量数据`)

                // 打印前10条数据作为示例
                console.log('诗人数据示例:', poetsData.slice(0, 10).map(p =>
                    `${p.poetName}(ID:${p.poetID},诗词量:${p.totalPoems})`))

                // 筛选选中的诗人数据（如果有指定）
                let filteredPoetsData = poetsData
                if (selectedPoetsList && selectedPoetsList.length > 0) {
                    // 对selectedPoetsList进行去重处理
                    const uniquePoets = [];
                    const poetIds = new Set();

                    selectedPoetsList.forEach(poet => {
                        if (!poetIds.has(poet.id)) {
                            poetIds.add(poet.id);
                            uniquePoets.push(poet);
                        } else {
                            console.log(`统计数据：检测到重复选择的诗人 ${poet.name}(ID:${poet.id})，将忽略重复数据`);
                        }
                    });

                    console.log('选中的诗人列表(去重后):', uniquePoets.map(p =>
                        `${p.name}(ID:${p.id},类型:${typeof p.id})`));

                    // 检查仲振宣是否在选择列表中
                    const isZhongZhenxuanSelected = uniquePoets.some(p =>
                        p.name === '仲振宣' || p.name.includes('仲振宣'));

                    console.log(`【多选模式调试】仲振宣是否被选中: ${isZhongZhenxuanSelected}`);

                    // 直接使用名称进行匹配，不再使用ID映射
                    const selectedPoetNames = uniquePoets.map(poet => poet.name);
                    console.log('选中的诗人名称列表:', selectedPoetNames);

                    // 使用名称进行匹配
                    filteredPoetsData = poetsData.filter(poet => {
                        const isSelected = selectedPoetNames.some(name =>
                            poet.poetName === name ||
                            // 处理匹配不精确的情况
                            (name === '仲振宣' && poet.poetName === '仲振宣')
                        );

                        if (isSelected) {
                            console.log(`✓ 成功匹配诗人: ${poet.poetName} (ID: ${poet.poetID})`);

                            // 特别关注仲振宣
                            if (poet.poetName === '仲振宣') {
                                console.log(`【多选模式调试】找到仲振宣的数据:`, {
                                    poetID: poet.poetID,
                                    totalPoems: poet.totalPoems,
                                    stages: {
                                        stage_child: poet.stage_child,
                                        stage_youth: poet.stage_youth,
                                        stage_prime: poet.stage_prime,
                                        stage_middle: poet.stage_middle,
                                        stage_elder: poet.stage_elder
                                    }
                                });
                            }
                        }

                        return isSelected;
                    });

                    console.log(`筛选结果: 选中了 ${filteredPoetsData.length} 个诗人:`,
                        filteredPoetsData.map(p => `${p.poetName}(ID:${p.poetID},诗词量:${p.totalPoems})`));
                }

                // 计算所有诗人在各生命阶段的诗词量总和
                const totalStageData = {
                    stage_child: 0,
                    stage_youth: 0,
                    stage_prime: 0,
                    stage_middle: 0,
                    stage_elder: 0,
                    totalPoems: 0
                }

                filteredPoetsData.forEach(poet => {
                    // 确保累加的是数字
                    totalStageData.stage_child += Number(poet.stage_child || 0)
                    totalStageData.stage_youth += Number(poet.stage_youth || 0)
                    totalStageData.stage_prime += Number(poet.stage_prime || 0)
                    totalStageData.stage_middle += Number(poet.stage_middle || 0)
                    totalStageData.stage_elder += Number(poet.stage_elder || 0)
                    totalStageData.totalPoems += Number(poet.totalPoems || 0)
                })

                console.log('生命阶段诗词量统计:', totalStageData)

                // 将统计数据转换为渲染所需的格式
                const stageNames = {
                    stage_child: "少年期(5-15岁)",
                    stage_youth: "青年期(16-25岁)",
                    stage_prime: "壮年期(26-40岁)",
                    stage_middle: "中年期(41-60岁)",
                    stage_elder: "晚年期(61岁以上)"
                }

                // 为每个生命阶段指定角度，确保布局一致
                const stageAngles = {
                    stage_child: 0,    // 右侧 - 少年期
                    stage_youth: 72,   // 右下 - 青年期
                    stage_prime: 144,  // 左下 - 壮年期
                    stage_middle: 216, // 左侧 - 中年期
                    stage_elder: 288   // 左上 - 晚年期
                }

                // 转换为stage数组格式
                const stages = Object.keys(stageNames).map(key => {
                    return {
                        name: stageNames[key],
                        value: totalStageData[key],
                        stage_key: key,
                        angle: stageAngles[key]
                    }
                })

                // 保存数据供渲染使用
                allPoetsStageData.value = {
                    poetName: selectedPoetsList && selectedPoetsList.length > 0
                        ? selectedPoetsList.length > 1
                            ? selectedPoetsList.length <= 3
                                ? selectedPoetsList.map(poet => poet.name).join('、')
                                : `${selectedPoetsList[0].name}、${selectedPoetsList[1].name}等${selectedPoetsList.length}位诗人`
                            : selectedPoetsList[0].name
                        : "全部诗人",
                    totalPoems: totalStageData.totalPoems,
                    stages: stages
                }

                console.log('格式化后的生命阶段数据:', allPoetsStageData.value)

                // 如果当前选择的是"全部诗人"或有多个选中的诗人，立即渲染统计数据
                if (selectedPoetName.value === '全部诗人' || selectedPoetId.value === '0' ||
                    (selectedPoetsList && selectedPoetsList.length > 0)) {
                    renderAllPoetsStageData()
                }

                return allPoetsStageData.value
            }
        } catch (error) {
            console.error('获取全部诗人诗词量统计数据失败:', error)
            return null
        }
    }

    // 渲染全部诗人诗词量统计数据
    const renderAllPoetsStageData = () => {
        // 多选模式下直接返回，不渲染统计曲线
        if (selectedPoets.value && selectedPoets.value.length > 0) {
            console.log('多选模式下跳过渲染统计曲线');
            return;
        }

        if (!myChart || !allPoetsStageData.value) {
            console.warn('无法渲染全部诗人诗词量统计：缺少图表实例或统计数据')
            return
        }



        // 将新创建的元素保存到lifeStageElements
        lifeStageElements = [...lifeStageElements]

    }

    // 从后端获取所有诗人数据
    const fetchPoetsData = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/all_poets?page_size=1000')
            if (response.data && response.data.data && response.data.data.poets) {
                const poets = response.data.data.poets

                // 提取所有有效的出生和去世年份
                const birthYears = poets
                    .map(poet => parseInt(poet.StartYear))
                    .filter(year => !isNaN(year) && year > 0)

                const deathYears = poets
                    .map(poet => parseInt(poet.EndYear))
                    .filter(year => !isNaN(year) && year > 0)

                // 保存完整的诗人生命信息（用于绘制生命线）
                const poetLifeSpans = poets
                    .filter(poet => {
                        const birthYear = parseInt(poet.StartYear);
                        // 至少要有出生年份
                        return !isNaN(birthYear) && birthYear > 0;
                    })
                    .map(poet => {
                        let birthYear = parseInt(poet.StartYear);
                        let deathYear = parseInt(poet.EndYear);

                        // 如果没有死亡年份，估计寿命为60年
                        if (isNaN(deathYear) || deathYear <= 0) {
                            deathYear = birthYear + 60;
                        }

                        // 确保死亡年份大于出生年份
                        if (deathYear <= birthYear) {
                            deathYear = birthYear + 60;
                        }

                        return {
                            id: poet.poetID,
                            name: poet.NameHZ || poet.NamePY || `诗人ID:${poet.poetID}`,
                            birthYear,
                            deathYear,
                            gender: poet.Sex || '未知'
                        };
                    });

                if (birthYears.length > 0) {
                    // 找出最早出生年份和最晚去世年份
                    const earliestBirthYear = Math.min(...birthYears)
                    let latestDeathYear = Math.max(...deathYears)

                    // 如果没有有效的去世年份，使用最晚出生年份加上估计寿命
                    if (deathYears.length === 0) {
                        latestDeathYear = Math.max(...birthYears) + 80 // 估计寿命为80岁
                    }

                    // 计算时间跨度
                    const timeSpan = latestDeathYear - earliestBirthYear

                    // 生成均匀分布的时间点
                    const timePointCount = 24 // 每15度一个点，总共24个点
                    const timePoints = []

                    for (let i = 0; i < timePointCount; i++) {
                        const year = Math.floor(earliestBirthYear + (timeSpan * i) / (timePointCount - 1))
                        timePoints.push(year)
                    }

                    // 统计每个年份的诗人数量和姓名
                    const yearCounts = {}
                    const yearPoets = {}

                    poets.forEach(poet => {
                        const birthYear = parseInt(poet.StartYear)
                        if (!isNaN(birthYear) && birthYear > 0) {
                            // 找到最接近的时间点
                            const closestYear = timePoints.reduce((prev, curr) =>
                                Math.abs(curr - birthYear) < Math.abs(prev - birthYear) ? curr : prev
                            )

                            // 更新该年份诗人数量
                            yearCounts[closestYear] = (yearCounts[closestYear] || 0) + 1

                            // 保存该年份出生的诗人姓名
                            if (!yearPoets[closestYear]) {
                                yearPoets[closestYear] = []
                            }
                            yearPoets[closestYear].push(poet.NameHZ || poet.NamePY || `诗人ID:${poet.poetID}`)
                        }
                    })

                    // 更新时间线数据
                    poetTimelineData.value = {
                        minYear: earliestBirthYear,
                        maxYear: latestDeathYear,
                        timePoints: timePoints,
                        yearCounts,
                        yearPoets,
                        poetLifeSpans // 添加诗人生命信息
                    }

                    console.log('诗人时间线数据:', poetTimelineData.value)

                    // 数据加载后立即渲染生命线 - 默认显示全部诗人
                    if (myChart) {
                        renderAllPoetLifeSpans();
                    }
                }
            }
        } catch (error) {
            console.error('获取诗人数据失败:', error)
        }
    }

    // 获取诗人时间线数据
    const fetchTimelineData = async (poetId = null) => {
        try {
            selectedPoetId.value = poetId
            console.log(`开始获取时间线数据，诗人ID: ${poetId}，是否为全部诗人: ${poetId === '0' || !poetId}`);

            // 构建API URL
            let url = 'http://localhost:5000/api/poet_timelines'
            if (poetId && poetId !== '0') {
                url += `?poet_id=${poetId}`
            }

            console.log(`正在获取时间线数据: ${url}`)

            const response = await axios.get(url)

            if (response.data && response.data.status === 'success') {
                timelineData.value = response.data.data || { poets: [], timelines: [] }
                console.log(`获取到${timelineData.value.timelines.length}条时间线数据:`, timelineData.value)

                // 获取到数据后，检查是否需要更新生命线
                if (poetId === '0' || !poetId) {
                    console.log('切换到全部诗人，强制重新渲染所有生命线');
                    // 当切换到全部诗人时，确保使用之前获取的完整生命线数据
                    selectedPoetName.value = '全部诗人';
                    renderAllPoetLifeSpans(); // 直接调用渲染全部诗人方法

                    // 如果不是多选模式，才获取和渲染全部诗人的统计数据
                    if (!selectedPoets.value || selectedPoets.value.length === 0) {
                        console.log("不是多选模式，获取全部诗人统计数据");
                        fetchAllPoetsStageData();
                    } else {
                        console.log("多选模式，跳过全部诗人统计数据");
                    }
                } else {
                    updateLifeSpansRendering();
                }
            } else {
                console.error('获取时间线数据失败:', response.data ? response.data.message : '服务器无响应')
                timelineData.value = { poets: [], timelines: [] }

                // 失败时仍尝试渲染
                if (poetId === '0' || !poetId) {
                    renderAllPoetLifeSpans();

                    // 如果不是多选模式，才尝试获取全部诗人统计数据
                    if (!selectedPoets.value || selectedPoets.value.length === 0) {
                        fetchAllPoetsStageData();
                    }
                } else {
                    updateLifeSpansRendering();
                }
            }
        } catch (error) {
            console.error('获取时间线数据出错:', error)
            timelineData.value = { poets: [], timelines: [] }

            // 错误时仍尝试渲染
            if (poetId === '0' || !poetId) {
                renderAllPoetLifeSpans();

                // 如果不是多选模式，才尝试获取全部诗人统计数据
                if (!selectedPoets.value || selectedPoets.value.length === 0) {
                    fetchAllPoetsStageData();
                }
            } else {
                updateLifeSpansRendering();
            }
        }
    }

    // 获取诗人事件数据
    const fetchPoetEvents = async (poetName) => {
        try {
            if (!poetName) {
                console.error('获取诗人事件数据失败: 缺少诗人名称')
                poetEventsData.value = []
                return []
            }

            console.log(`正在获取诗人 ${poetName} 的事件数据`)
            const response = await axios.get(`http://localhost:5000/api/poet_events?poet_name=${encodeURIComponent(poetName)}`)

            if (response.data && response.data.data) {
                poetEventsData.value = response.data.data
                console.log(`获取到${poetEventsData.value.length}条诗人事件数据:`, poetEventsData.value)
                return response.data.data
            } else {
                console.error('获取诗人事件数据失败:', response.data ? response.data.message : '服务器无响应')
                poetEventsData.value = []
                return []
            }
        } catch (error) {
            console.error('获取诗人事件数据出错:', error)
            poetEventsData.value = []
            return []
        }
    }

    // 更新当前选中的诗人名称
    const updateSelectedPoet = (poetName, poetId = null) => {
        // 修复：统一处理"全部诗人"选择的情况
        if (poetName === '0' || poetName === 0 || !poetName) {
            poetName = '全部诗人';
        }

        if (poetId === '0' || poetId === 0 || !poetId) {
            selectedPoetId.value = '0';
        } else if (poetId) {
            selectedPoetId.value = poetId;
        }

        // 检查是否与当前选中的诗人相同，如果相同则跳过后续处理
        if (poetName === selectedPoetName.value &&
            ((poetId && poetId === selectedPoetId.value) || (!poetId && !selectedPoetId.value))) {
            console.log(`选择的诗人 ${poetName} 与当前已选中的诗人相同，跳过重复渲染`);
            return;
        }

        selectedPoetName.value = poetName;
        console.log(`更新选中的诗人为: ${poetName}, ID: ${selectedPoetId.value}`);

        // 先清除旧元素，确保不会出现重叠显示
        clearPoetLifeStageElements();

        // 如果是切换到全部诗人，直接调用特定函数
        if (poetName === '全部诗人' || selectedPoetId.value === '0') {
            console.log('切换到全部诗人，调用renderAllPoetLifeSpans()');
            // 确保重新获取全部诗人数据
            renderAllPoetLifeSpans();

            // 如果不是多选模式，才获取全部诗人统计数据
            if (!selectedPoets.value || selectedPoets.value.length === 0) {
                console.log("不是多选模式，获取并渲染全部诗人统计数据");
                fetchAllPoetsStageData();
            } else {
                console.log("多选模式，跳过获取全部诗人统计数据");
            }
        } else {
            // 检查是否在多选模式下
            if (selectedPoets.value && selectedPoets.value.length > 0) {
                console.log("多选模式下更新选中的诗人");
                // 在多选模式下，根据updateSelectedPoet的调用目的可能有两种情况:
                // 1. 添加新诗人到多选列表
                // 2. 切换到单选模式并选择特定诗人

                // 这里假设是添加新诗人到多选列表，实际使用时需要根据业务逻辑调整
                // 这种情况下应该重新渲染所有选中的诗人
                renderAllPoetLifeSpans(selectedPoets.value);
            } else {
                // 更新生命线渲染
                updateLifeSpansRendering();
            }
        }
    }

    // 渲染全部诗人的生命线
    const renderAllPoetLifeSpans = (selectedPoetsList = [], forceRender = false) => {
        if (!myChart || !poetTimelineData.value || !poetTimelineData.value.poetLifeSpans) {
            console.warn('无法渲染诗人生命线：缺少图表实例或诗人数据');
            return;
        }

        console.log(`渲染诗人生命线... forceRender: ${forceRender}`);
        if (selectedPoetsList && selectedPoetsList.length > 0) {
            console.log(`选中了 ${selectedPoetsList.length} 位诗人:`,
                selectedPoetsList.map(p => `${p.name}(ID:${p.id})`));
        }
        console.log(`poetTimelineData中的诗人生命线数据数量: ${poetTimelineData.value.poetLifeSpans.length}`);

        // 确保有时间点数据
        if (!poetTimelineData.value.timePoints || poetTimelineData.value.timePoints.length === 0) {
            console.error('缺少时间点数据，无法渲染生命线');
            return;
        }

        // 确保数据已完全加载
        if (poetTimelineData.value.poetLifeSpans.length === 0) {
            console.log('诗人生命线数据尚未加载，尝试重新获取数据');
            fetchPoetsData().then(() => {
                if (poetTimelineData.value.poetLifeSpans.length > 0) {
                    console.log(`成功重新获取诗人数据，现有${poetTimelineData.value.poetLifeSpans.length}个诗人生命线数据`);
                    // 异步加载完成后调用自身
                    renderAllPoetLifeSpans(selectedPoetsList, forceRender);
                }
            }).catch(err => {
                console.error('重新获取诗人数据失败:', err);
            });
            return;
        }

        const zr = myChart.getZr();
        const elements = [];
        const center = [400, 300];
        const isMultiSelect = selectedPoetsList && selectedPoetsList.length > 0;
        const baseRadius = isMultiSelect ? RADIUS_DEFAULT : RADIUS_ALL_POETS;
        // 计算标记点半径 (仅在全部诗人模式下需要提前计算以传递给 renderBasicElements)
        const markerRadiusForBasic = isMultiSelect ? baseRadius : baseRadius + 40;
        console.log(`渲染模式: ${isMultiSelect ? '多选/单选' : '全部诗人'}, 使用半径: ${baseRadius}, 基础元素半径: ${markerRadiusForBasic}`);

        // 先清除可能存在的旧元素
        clearPoetLifeStageElements();

        // 使用rendering.js中的基础渲染函数，渲染圆形边框
        try {
            // 修改：根据模式传递不同的半径给 renderBasicElements
            renderBasicElements(zr, elements, center, markerRadiusForBasic);

            // *** 3. 构建传递给 renderTimePoints 的 timelineData ***
            let timelineDataForRender = {
                ...poetTimelineData.value
            };

            if (!isMultiSelect) {
                // 单选（全部诗人）模式下，添加诗词分布数据
                if (!distributionIsLoading.value && !distributionError.value && allYearCounts.value && distributionMinYear.value !== null && distributionMaxYear.value !== null) {
                    timelineDataForRender.allYearCounts = allYearCounts.value;
                    timelineDataForRender.minYear = distributionMinYear.value;
                    timelineDataForRender.maxYear = distributionMaxYear.value;
                    console.log('单选模式：已将诗词分布数据添加到 timelineDataForRender', { min: timelineDataForRender.minYear, max: timelineDataForRender.maxYear, countKeys: Object.keys(timelineDataForRender.allYearCounts).length });
                } else {
                    console.warn('单选模式：诗词分布数据尚未加载或无效，将使用 poetTimelineData 中的默认年份范围（可能不准确）');
                }
            } else {
                console.log('多选模式：使用原始 poetTimelineData');
            }

            // 渲染时间点 - 仍然传递原始的 baseRadius
            renderTimePoints(zr, elements, center, baseRadius, timelineDataForRender, isMultiSelect, selectedPoetsList);

            console.log(`已渲染基础圆形边框(半径:${markerRadiusForBasic})和时间点，多选模式:`, isMultiSelect);
        } catch (error) {
            console.error('渲染基础元素或时间点时出错:', error);
        }

        // 确定要显示的生命线
        if (selectedPoetsList && selectedPoetsList.length > 0) {
            // 多选模式下需要进行去重处理，防止重复选择同一诗人导致叠加
            const uniquePoets = [];
            const poetIds = new Set();

            // 对诗人列表进行去重
            selectedPoetsList.forEach(poet => {
                if (!poetIds.has(poet.id)) {
                    poetIds.add(poet.id);
                    uniquePoets.push(poet);
                } else {
                    console.log(`检测到重复选择的诗人 ${poet.name}(ID:${poet.id})，将忽略重复渲染`);
                }
            });

            console.log(`去重后剩余 ${uniquePoets.length} 位诗人`);

            // 多选模式下，为每个诗人单独渲染生命线和诗词点，不渲染统计效果
            selectedPoets.value = uniquePoets;
            console.log(`多选模式：选中了${uniquePoets.length}位诗人，将为每位诗人单独渲染`);

            // 使用包装函数一次性渲染所有选中诗人的生命线
            // 传入诗人名称数组
            const poetNames = uniquePoets.map(poet => poet.name);
            console.log(`为 ${poetNames.length} 位诗人渲染生命线: ${poetNames.join(', ')}`);
            wrappedRenderPoetLifeSpans(zr, elements, center, baseRadius, poetTimelineData.value, poetNames, forceRender);

            // 为每个诗人单独渲染诗词曲线
            uniquePoets.forEach(poet => {
                const poetKey = `${poet.id}-${poet.name}`;

                // 检查该诗人的生命线是否已经渲染，如果强制渲染则忽略此检查
                if (!forceRender && renderedPoetsLifeLines.has(poetKey)) {
                    console.log(`诗人 ${poet.name} (ID:${poet.id}) 的生命线已经渲染，跳过`);
                    return;
                }

                console.log(`为诗人 ${poet.name} (ID:${poet.id}) 渲染诗词曲线`);

                // 标记该诗人的生命线已经渲染
                renderedPoetsLifeLines.add(poetKey);

                // 查找诗人的生命周期数据，获取角度范围
                const poetLifeSpan = poetTimelineData.value.poetLifeSpans.find(p =>
                    p.name === poet.name || (poet.name === '仲振宣' && p.name === '仲振宣')
                );

                let angleRange = null;
                if (poetLifeSpan) {
                    // 计算诗人角度范围
                    // 1. 获取诗人生命年份
                    const birthYear = poetLifeSpan.birthYear;
                    // 2. 计算所有选中诗人的年份范围（从最早到最晚）
                    const allYears = new Set();
                    selectedPoets.value.forEach(poet => {
                        const foundPoet = poetTimelineData.value.poetLifeSpans.find(p =>
                            p.name === poet.name || (poet.name === '仲振宣' && p.name === '仲振宣')
                        );
                        if (foundPoet && foundPoet.birthYear && foundPoet.deathYear) {
                            for (let year = foundPoet.birthYear; year <= foundPoet.deathYear; year++) {
                                allYears.add(year);
                            }
                        }
                    });

                    // 3. 排序年份数组
                    const sortedYears = Array.from(allYears).sort((a, b) => a - b);

                    // 找到出生年和死亡年在排序数组中的索引
                    let birthYearIndex = -1;
                    let deathYearIndex = -1;

                    // 根据诗人生命年份，找到在排序年份中最接近的索引
                    const closestBirthYear = sortedYears.reduce((prev, curr) =>
                        Math.abs(curr - birthYear) < Math.abs(prev - birthYear) ? curr : prev,
                        sortedYears[0]
                    );
                    birthYearIndex = sortedYears.indexOf(closestBirthYear);

                    // 同样方式找到最接近死亡年的索引
                    const deathYear = poetLifeSpan.deathYear;
                    const closestDeathYear = sortedYears.reduce((prev, curr) =>
                        Math.abs(curr - deathYear) < Math.abs(prev - deathYear) ? curr : prev,
                        sortedYears[sortedYears.length - 1]
                    );
                    deathYearIndex = sortedYears.indexOf(closestDeathYear);

                    // 4. 计算角度
                    if (birthYearIndex !== -1 && deathYearIndex !== -1 && sortedYears.length > 0) {
                        const startAngle = (birthYearIndex / sortedYears.length) * 360;
                        const endAngle = (deathYearIndex / sortedYears.length) * 360;

                        angleRange = {
                            startAngle,
                            endAngle
                        };

                        console.log(`为诗人 ${poet.name} 计算的角度范围(根据时间点索引): ${startAngle} - ${endAngle}`);
                    } else {
                        // 使用基于固定索引的角度计算
                        const timePoints = poetTimelineData.value.timePoints;
                        if (timePoints && timePoints.length > 0) {
                            // 找到最接近出生年份的时间点
                            const closestYear = timePoints.reduce((prev, curr) =>
                                Math.abs(curr - birthYear) < Math.abs(prev - birthYear) ? curr : prev
                            );

                            // 找到该时间点在数组中的索引
                            const yearIndex = timePoints.indexOf(closestYear);

                            // 计算该索引对应的角度（24个点，每个点15度）
                            const startAngle = (yearIndex / timePoints.length) * 360;
                            const endAngle = startAngle + 60; // 分配约60度的角度范围

                            angleRange = {
                                startAngle,
                                endAngle
                            };

                            console.log(`为诗人 ${poet.name} 计算的角度范围(备用方法): ${startAngle} - ${endAngle}`);
                        }
                    }
                }

                // 获取该诗人的生命阶段数据，并渲染其诗词曲线
                fetchPoetLifeStageDataForMultiSelect(poet.name, poet.id, angleRange).then(poetLifeStage => {
                    if (poetLifeStage) {
                        console.log(`获取到诗人 ${poet.name} 的生命阶段数据，渲染其诗词曲线`);

                        // 添加选中的诗人列表信息
                        poetLifeStage.selectedPoets = selectedPoets.value;

                        renderPoetLifeStages(
                            myChart,
                            poetLifeStage,
                            poet.name,
                            { ...poetTimelineData.value, ...timelineData.value },
                            activeStage,
                            [],
                            newElements => {
                                lifeStageElements = [...lifeStageElements, ...newElements];
                                console.log(`合并了诗人 ${poet.name} 的 ${newElements.length} 个元素，当前总元素: ${lifeStageElements.length}`);
                            },
                            poet.id,
                            poetEventsData.value,
                            angleRange // 传递角度范围参数
                        );
                    }
                });
            });
        } else {
            // 单诗人或全部诗人模式
            const displayName = selectedPoetName.value || '全部诗人';
            selectedPoets.value = [];

            // 调用包装的生命线渲染函数
            wrappedRenderPoetLifeSpans(zr, elements, center, baseRadius, poetTimelineData.value, displayName, forceRender);

            // 只在真正的"全部诗人"模式下渲染统计数据
            if (displayName === '全部诗人' || selectedPoetId.value === '0') {
                console.log("渲染全部诗人统计数据...");
                fetchAllPoetsStageData().then(() => {
                    if (allPoetsStageData.value) {
                        renderAllPoetsStageData();
                    }
                });
            }
        }

        // 保存渲染的元素
        lifeStageElements = [...lifeStageElements, ...elements];
        console.log(`已添加 ${elements.length} 个生命线元素`);
    }

    // 新增函数：为多选模式获取单个诗人的生命阶段数据
    const fetchPoetLifeStageDataForMultiSelect = async (poetName, poetId, angleRange = null) => {
        try {
            console.log(`为多选模式获取诗人 ${poetName} (ID:${poetId}) 的生命阶段数据`);

            // 修改API URL，使用与单人模式相同的端点
            const url = `http://localhost:5000/api/poet_life_stages?poet_name=${encodeURIComponent(poetName)}`;

            console.log(`向API请求: ${url}`);
            const response = await axios.get(url);

            if (response.data && response.data.status === 'success' && response.data.data) {
                const poetData = response.data.data;
                console.log(`成功获取诗人 ${poetName} 的生命阶段数据:`, poetData);

                // 获取第一个数据项（通常只有一个）
                const firstData = Array.isArray(poetData) ? poetData[0] : poetData;

                // 创建基础对象，确保包含所有必要字段
                const formattedData = {
                    poetName: poetName,
                    poetId: poetId,
                    // 添加生卒年数据
                    startYear: firstData.startYear || firstData.StartYear || 0,
                    endYear: firstData.endYear || firstData.EndYear || 0,
                    // 添加poetID字段，某些函数可能需要它
                    poetID: poetId,
                    totalPoems: 0,
                    // 标记这是多选模式数据
                    isMultiSelect: true
                };

                // 查找诗人的生命数据，用于更精确的生卒年信息
                const poetLife = poetTimelineData.value.poetLifeSpans.find(
                    poet => poet.name === poetName || (poetName === '仲振宣' && poet.name === '仲振宣')
                );

                if (poetLife) {
                    // 使用找到的更准确的生卒年数据
                    formattedData.startYear = poetLife.birthYear || formattedData.startYear;
                    formattedData.endYear = poetLife.deathYear || formattedData.endYear;

                    console.log(`找到诗人 ${poetName} 的生命数据，更新生卒年为: ${formattedData.startYear}-${formattedData.endYear}`);
                }

                // 如果提供了角度范围，添加到数据中
                if (angleRange) {
                    formattedData.angleRange = angleRange;
                    console.log(`添加角度范围信息: ${angleRange.startAngle}-${angleRange.endAngle}`);
                }

                // 添加时间点数据，用于正确计算角度
                formattedData.timePoints = poetTimelineData.value.timePoints;

                // 确保数据格式与生命阶段渲染函数期望的一致
                let stagesWithPoetName;
                if (!firstData.stages) {
                    // 如果API返回的数据格式不符合预期，转换为所需格式
                    stagesWithPoetName = [
                        { name: "少年期(5-15岁)", value: firstData.stage_child || 0, stage_key: "stage_child", poetName: poetName },
                        { name: "青年期(16-25岁)", value: firstData.stage_youth || 0, stage_key: "stage_youth", poetName: poetName },
                        { name: "壮年期(26-40岁)", value: firstData.stage_prime || 0, stage_key: "stage_prime", poetName: poetName },
                        { name: "中年期(41-60岁)", value: firstData.stage_middle || 0, stage_key: "stage_middle", poetName: poetName },
                        { name: "晚年期(61岁以上)", value: firstData.stage_elder || 0, stage_key: "stage_elder", poetName: poetName }
                    ];
                    formattedData.totalPoems = stagesWithPoetName.reduce((sum, stage) => sum + stage.value, 0);
                } else {
                    // 如果API返回了stages数组，遍历并添加poetName
                    stagesWithPoetName = firstData.stages.map(stage => ({
                        ...stage,
                        poetName: poetName // 添加诗人名称
                    }));
                    formattedData.totalPoems = firstData.totalPoems || stagesWithPoetName.reduce((sum, stage) => sum + stage.value, 0);
                }

                // 将带有 poetName 的 stages 数组赋值给 formattedData
                formattedData.stages = stagesWithPoetName;

                console.log(`处理后的诗人生命阶段数据:`, {
                    poetName: formattedData.poetName,
                    poetId: formattedData.poetId,
                    startYear: formattedData.startYear,
                    endYear: formattedData.endYear,
                    totalPoems: formattedData.totalPoems,
                    stages: formattedData.stages.map(s => `${s.name}: ${s.value}`),
                    angleRange: formattedData.angleRange,
                    isMultiSelect: formattedData.isMultiSelect,
                    timePointsLength: formattedData.timePoints ? formattedData.timePoints.length : 0
                });

                return formattedData;
            } else {
                console.error(`获取诗人 ${poetName} 的生命阶段数据失败:`,
                    response.data ? response.data.message : '服务器无响应');
                return null;
            }
        } catch (error) {
            console.error(`获取诗人 ${poetName} 的生命阶段数据出错:`, error);

            // 尝试从已有的全部诗人数据中获取
            console.log(`尝试从已有数据中查找诗人 ${poetName} 的生命阶段数据`);
            try {
                const allPoetsResponse = await axios.get('http://localhost:5000/api/all_poets_poem_count');
                if (allPoetsResponse.data && allPoetsResponse.data.status === 'success') {
                    const poetsData = allPoetsResponse.data.data.poets;
                    const poetData = poetsData.find(p => p.poetName === poetName);

                    if (poetData) {
                        console.log(`从全部诗人数据中找到了 ${poetName} 的生命阶段数据`, poetData);

                        // 查找诗人的生命数据，获取生卒年
                        const poetLife = poetTimelineData.value.poetLifeSpans.find(
                            poet => poet.name === poetName || (poetName === '仲振宣' && poet.name === '仲振宣')
                        );

                        let startYear = 0;
                        let endYear = 0;

                        if (poetLife) {
                            startYear = poetLife.birthYear;
                            endYear = poetLife.deathYear;
                            console.log(`找到诗人 ${poetName} 的生命数据，生卒年: ${startYear}-${endYear}`);
                        }

                        // 转换为所需格式
                        const stageData = {
                            poetName: poetName,
                            poetId: poetId,
                            poetID: poetId,
                            startYear: startYear,
                            endYear: endYear,
                            totalPoems: poetData.totalPoems || 0,
                            isMultiSelect: true,
                            stages: [
                                // 在这里创建 stages 时也添加 poetName
                                { name: "少年期(5-15岁)", value: poetData.stage_child || 0, stage_key: "stage_child", poetName: poetName },
                                { name: "青年期(16-25岁)", value: poetData.stage_youth || 0, stage_key: "stage_youth", poetName: poetName },
                                { name: "壮年期(26-40岁)", value: poetData.stage_prime || 0, stage_key: "stage_prime", poetName: poetName },
                                { name: "中年期(41-60岁)", value: poetData.stage_middle || 0, stage_key: "stage_middle", poetName: poetName },
                                { name: "晚年期(61岁以上)", value: poetData.stage_elder || 0, stage_key: "stage_elder", poetName: poetName }
                            ]
                        };

                        // 无需再次遍历添加，因为创建时已包含
                        // stageData.stages.forEach(stage => stage.poetName = poetName);

                        // 如果提供了角度范围，添加到数据中
                        if (angleRange) {
                            stageData.angleRange = angleRange;
                            console.log(`添加角度范围信息: ${angleRange.startAngle}-${angleRange.endAngle}`);
                        }

                        // 添加时间点数据，用于正确计算角度
                        stageData.timePoints = poetTimelineData.value.timePoints;

                        console.log(`处理后的备用诗人生命阶段数据:`, {
                            poetName: stageData.poetName,
                            poetId: stageData.poetId,
                            startYear: stageData.startYear,
                            endYear: stageData.endYear,
                            totalPoems: stageData.totalPoems,
                            stages: stageData.stages.map(s => `${s.name}: ${s.value}`),
                            angleRange: stageData.angleRange,
                            isMultiSelect: stageData.isMultiSelect,
                            timePointsLength: stageData.timePoints ? stageData.timePoints.length : 0
                        });

                        return stageData;
                    }
                }
            } catch (fallbackError) {
                console.error(`备用方法也无法获取诗人 ${poetName} 的数据:`, fallbackError);
            }

            return null;
        }
    }

    // 根据选中的诗人更新生命线渲染
    const updateLifeSpansRendering = () => {
        if (!myChart) {
            console.error('无法更新生命线渲染：缺少图表实例');
            return;
        }

        // 清除之前的生命线元素
        clearPoetLifeStageElements();

        // 修复：确保poetName有值，默认为'全部诗人'
        let poetName = selectedPoetName.value;
        if (!poetName || poetName === '0') {
            poetName = '全部诗人';
        }
        console.log(`准备更新生命线渲染，当前选择的诗人: ${poetName}`);

        // 检查是否有诗人生命周期数据
        if (!poetTimelineData.value || !poetTimelineData.value.poetLifeSpans || poetTimelineData.value.poetLifeSpans.length === 0) {
            console.error('无法渲染生命线：缺少诗人生命周期数据');
            return;
        }

        console.log(`可用生命线数据: ${poetTimelineData.value.poetLifeSpans.length}个诗人`);

        const zr = myChart.getZr();
        const elements = [];
        const center = [400, 300];
        const isMultiSelect = selectedPoets.value && selectedPoets.value.length > 0;
        const baseRadius = isMultiSelect ? RADIUS_DEFAULT : RADIUS_ALL_POETS;
        console.log(`渲染模式: ${isMultiSelect ? '多选/单选' : '全部诗人'}, 使用半径: ${baseRadius}`);

        // 添加当前诗人到已渲染集合
        if (poetName !== '全部诗人') {
            const poetKey = `${selectedPoetId.value}-${poetName}`;
            renderedPoetsLifeLines.add(poetKey);
            console.log(`将诗人 ${poetName} 添加到已渲染诗人集合`);
        }

        // 调用包装的生命线渲染函数
        wrappedRenderPoetLifeSpans(zr, elements, center, baseRadius, poetTimelineData.value, poetName);

        // 保存渲染的元素
        lifeStageElements = [...lifeStageElements, ...elements];
        console.log(`已更新 ${elements.length} 个生命线元素`);
    }

    // 在组件挂载时获取数据
    onMounted(() => {
        fetchPoetsData()
        fetchTimelineData() // 获取所有诗人的时间线数据
        fetchAllPoetsStageData() // 获取全部诗人诗词量统计数据
    })

    // 保存图表引用
    let myChart = null
    // 保存所有添加的元素引用
    let lifeStageElements = []
    // 跟踪已渲染的诗人生命线，用于防止重复渲染
    let renderedPoetsLifeLines = new Set()
    // 跟踪已经渲染的诗人组合，用于防止相同诗人组合的重复渲染
    let renderedPoetCombinations = new Set()

    // 创建一个包装函数，替代直接调用renderPoetLifeSpans，防止重复渲染
    const wrappedRenderPoetLifeSpans = (zr, elements, center, baseRadius, timelineData, currentPoetName, forceRender = false) => {
        // 生成一个唯一标识，代表当前渲染的诗人组合
        let renderKey = '';

        if (Array.isArray(currentPoetName)) {
            // 如果是数组，按字母顺序排序并连接，确保相同组合产生相同的key
            renderKey = [...currentPoetName].sort().join('|');
        } else {
            renderKey = String(currentPoetName || '全部诗人');
        }

        // 添加一个前缀，避免与已存在的key混淆
        const lastPoetRenderKey = `poet:${renderKey}`;

        console.log(`准备渲染诗人生命线，renderKey: ${lastPoetRenderKey}, forceRender: ${forceRender}`);

        // 检查是否已经渲染过这个组合，如果强制渲染则忽略此检查
        if (!forceRender && renderedPoetCombinations.has(lastPoetRenderKey)) {
            console.log(`跳过重复渲染: ${lastPoetRenderKey} 已经被渲染过`);
            return;
        }

        // 标记这个组合已经被渲染
        renderedPoetCombinations.add(lastPoetRenderKey);
        console.log(`添加到已渲染组合: ${lastPoetRenderKey}`);

        // 调用原始的渲染函数，传递forceRender参数
        renderPoetLifeSpans(zr, elements, center, baseRadius, timelineData, currentPoetName, forceRender);
    }

    // 设置图表实例
    const setChart = (chart) => {
        myChart = chart
        // 同时更新提示框模块的图表引用
        setTooltipChart(chart)

        // 如果已经有数据，立即渲染生命线
        if (poetTimelineData.value && poetTimelineData.value.poetLifeSpans && poetTimelineData.value.poetLifeSpans.length > 0) {
            renderAllPoetLifeSpans();
        }
    }

    // 清除诗人生命阶段元素
    const clearPoetLifeStageElements = () => {
        if (!myChart) return

        const zr = myChart.getZr()

        // 清除提示框
        if (myChart.poetTooltip) {
            if (myChart.poetTooltip instanceof HTMLElement) {
                document.body.removeChild(myChart.poetTooltip)
            } else {
                zr.remove(myChart.poetTooltip)
            }
            myChart.poetTooltip = null
        }

        // 清除之前的生命阶段可视化元素
        if (lifeStageElements && lifeStageElements.length > 0) {
            console.log(`清除 ${lifeStageElements.length} 个生命阶段可视化元素`)
            lifeStageElements.forEach((element) => {
                if (element) {
                    zr.remove(element)
                }
            })
            lifeStageElements = []
        }

        // 清除已渲染的诗人生命线记录
        renderedPoetsLifeLines.clear()
        // 清除已渲染的诗人组合记录
        renderedPoetCombinations.clear()
        // 清除lifeSpans.js中的已渲染诗人记录
        clearRenderedPoetsRecord()

        console.log('已清除所有已渲染诗人记录')
    }

    // 专门用于处理确认选择按钮点击的函数
    const handleConfirmSelection = (poetNames = [], poetIds = []) => {
        console.log(`处理确认选择: ${poetNames.length}个诗人`);

        // 清除当前渲染记录，强制重新渲染
        clearPoetLifeStageElements();

        // 转换数据结构为与renderAllPoetLifeSpans函数兼容的格式
        const selectedList = poetNames.map((name, index) => {
            return {
                name: name,
                id: poetIds[index] || `id-${name}`
            };
        });

        // 如果是单个诗人，使用updateSelectedPoet
        if (selectedList.length === 1) {
            const poet = selectedList[0];

            // 检查是否与当前选中诗人相同
            if (poet.name === selectedPoetName.value) {
                console.log(`确认选择：当前已经选中诗人 ${poet.name}，强制重新渲染`);

                // 直接使用包装函数强制渲染
                const zr = myChart.getZr();
                const elements = [];
                const center = [400, 300];
                const baseRadius = RADIUS_DEFAULT; // 单个诗人使用默认半径

                // 强制重新渲染
                wrappedRenderPoetLifeSpans(zr, elements, center, baseRadius, poetTimelineData.value, poet.name, true);

                // 保存渲染的元素
                lifeStageElements = [...lifeStageElements, ...elements];
            } else {
                // 正常更新选中诗人
                updateSelectedPoet(poet.name, poet.id);
            }
        }
        // 如果是多个诗人，直接渲染
        else if (selectedList.length > 1) {
            selectedPoets.value = selectedList;

            // 强制重新渲染所有选中诗人
            const zr = myChart.getZr();
            const elements = [];
            const center = [400, 300];
            const baseRadius = RADIUS_DEFAULT; // 多选模式使用默认半径

            // 渲染基础元素（圆形边框）
            renderBasicElements(zr, elements, center, baseRadius);

            // 多选模式下，特殊处理时间点渲染
            console.log("多选模式：特殊处理时间点渲染");
            renderTimePoints(zr, elements, center, baseRadius, poetTimelineData.value, true, selectedList);

            // 使用诗人名称数组
            const poetNames = selectedList.map(poet => poet.name);
            // 强制重新渲染
            wrappedRenderPoetLifeSpans(zr, elements, center, baseRadius, poetTimelineData.value, poetNames, true);

            // 保存渲染的元素
            lifeStageElements = [...lifeStageElements, ...elements];

            console.log(`已完成多选模式下 ${selectedList.length} 位诗人的时间点和生命线渲染`);
        }
        // 如果没有选择诗人，显示全部
        else {
            updateSelectedPoet('全部诗人', '0'); // 这会触发 renderAllPoetLifeSpans，使用其内部的半径逻辑
        }
    }

    return {
        activeStage,
        selectedPoetName,
        selectedPoets,
        updateSelectedPoet,
        handleConfirmSelection, // 导出新函数
        renderAllPoetLifeSpans,
        updateLifeSpansRendering,
        setChart,
        clearPoetLifeStageElements,
        showTooltip,
        hideTooltip,
        getColorByStage,
        renderPoetLifeStages: (poetLifeStage, currentPoetName, poetId = null, angleRange = null) => {
            return renderPoetLifeStages(
                myChart,
                poetLifeStage,
                currentPoetName,
                // 将timeline数据替换poetTimelineData
                { ...poetTimelineData.value, ...timelineData.value },
                activeStage,
                lifeStageElements,
                elements => {
                    lifeStageElements = elements
                },
                poetId || selectedPoetId.value,
                poetEventsData.value, // 添加事件数据
                angleRange // 添加角度范围参数
            )
        },
        poetTimelineData,
        timelineData,
        fetchPoetsData,
        fetchTimelineData,
        fetchPoetEvents,
        fetchAllPoetsStageData,
        renderAllPoetsStageData,
        allPoetsStageData,
        poetEventsData,
        selectedPoetId
    }
} 