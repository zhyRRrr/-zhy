import { ref, onMounted } from 'vue';
import axios from 'axios';

/**
 * @description 获取并处理所有诗人诗词量按年分布的数据
 * @returns {object} 包含 allYearCounts, minYear, maxYear, isLoading, error 的响应式对象
 */
export function useAllPoetDistributions() {
    // 存储聚合后的每年诗词总数
    const allYearCounts = ref({});
    // 存储所有年份中的最早年份
    const minYear = ref(null);
    // 存储所有年份中的最晚年份
    const maxYear = ref(null);
    // 加载状态
    const isLoading = ref(false);
    // 错误状态
    const error = ref(null);

    /**
     * @description 异步获取和处理数据
     */
    const fetchData = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            // 调用 API 获取数据
            // 注意：确保你的 Vite 或 Webpack 配置了代理，或者提供完整的 URL
            const response = await axios.get('http://localhost:8080/api/poet-life/all-distributions');
            const rawData = response.data;

            if (!rawData || typeof rawData !== 'object') {
                throw new Error('无效的 API 响应数据格式');
            }

            let earliestYear = Infinity;
            let latestYear = -Infinity;
            const yearCountsMap = new Map();

            // 遍历每个诗人的数据
            for (const poetName in rawData) {
                // 使用 Object.hasOwnProperty.call 确保只处理对象自身的属性
                if (Object.hasOwnProperty.call(rawData, poetName)) {
                    const poetData = rawData[poetName];
                    // 确保诗人数据是数组
                    if (Array.isArray(poetData)) {
                        // 遍历该诗人的年度数据
                        poetData.forEach(entry => {
                            // 确保条目有效且包含年份和数量
                            if (entry && typeof entry.year === 'number' && typeof entry.count === 'number') {
                                const year = entry.year;
                                const count = entry.count;

                                // 更新最早和最晚年份
                                if (year < earliestYear) earliestYear = year;
                                if (year > latestYear) latestYear = year;

                                // 累加年份总数 - 使用 Map 存储中间结果
                                yearCountsMap.set(year, (yearCountsMap.get(year) || 0) + count);
                            }
                        });
                    }
                }
            }

            // 将 Map 转换为普通对象以存入 ref
            const aggregatedCounts = {};
            // 按年份排序 Map 的键（可选，但有助于调试和可能的后续处理）
            const sortedYears = Array.from(yearCountsMap.keys()).sort((a, b) => a - b);
            for (const year of sortedYears) {
                aggregatedCounts[year] = yearCountsMap.get(year);
            }

            // 更新响应式引用
            allYearCounts.value = aggregatedCounts;
            // 修正：minYear 和 maxYear 应该基于聚合数据的年份范围
            minYear.value = earliestYear === Infinity ? null : earliestYear;
            maxYear.value = latestYear === -Infinity ? null : latestYear;

            console.log('诗词分布数据处理完成:', {
                minYear: minYear.value,
                maxYear: maxYear.value,
                countKeys: Object.keys(allYearCounts.value).length
            });

        } catch (err) {
            console.error('获取或处理诗词分布数据时出错:', err);
            error.value = err.message || '获取数据失败';
            // 清空数据以防显示旧数据
            allYearCounts.value = {};
            minYear.value = null;
            maxYear.value = null;
        } finally {
            isLoading.value = false;
        }
    };

    // 组件挂载后自动获取数据
    onMounted(() => {
        fetchData();
    });

    // 返回响应式数据和状态
    return {
        allYearCounts,
        minYear,
        maxYear,
        isLoading,
        error,
        fetchData // 也暴露 fetchData 方法，以便手动刷新
    };
} 