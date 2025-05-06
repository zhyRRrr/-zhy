import * as echarts from 'echarts'
import { radians, calculateOverlap, getPreferredSegmentForAngle } from './utils'
import { showTooltip, hideTooltip } from './tooltip'
import axios from 'axios'

// 用于跟踪已经渲染过的诗人，防止重复渲染
let renderedPoets = new Set();

// 清除已渲染诗人记录的函数，在清除图表元素时调用
export const clearRenderedPoetsRecord = () => {
    renderedPoets.clear();
    console.log('已清除诗人生命线渲染记录');
}

// 渲染诗人生命周期曲线
export const renderPoetLifeSpans = (zr, elements, center, baseRadius, timelineData, currentPoetName, forceRender = false) => {
    if (!timelineData.poetLifeSpans || timelineData.poetLifeSpans.length === 0) {
        console.log('没有诗人生命周期数据，跳过渲染');
        return;
    }

    console.log(`renderPoetLifeSpans被调用，当前诗人: ${Array.isArray(currentPoetName) ? currentPoetName.join('、') : currentPoetName}, 可用诗人数据: ${timelineData.poetLifeSpans.length}个, forceRender: ${forceRender}`);

    // 如果强制渲染，先清除已渲染记录
    if (forceRender) {
        renderedPoets.clear();
        console.log('强制渲染模式：已清除诗人生命线渲染记录');
    }

    const { poetLifeSpans, timePoints } = timelineData;

    // 重新定义曲线所在的环形区域的内外半径，使生命线位于圆形遮罩和时间线之间
    const lifeLineInnerRadius = baseRadius + 5; // 更靠近圆形遮罩
    const lifeLineOuterRadius = baseRadius + 37; // 不超过时间线
    const lifeLineRadiusRange = lifeLineOuterRadius - lifeLineInnerRadius;

    // 根据当前选择的诗人过滤显示的诗人数据
    let selectedPoets = [];
    if (currentPoetName) {
        // 处理多选模式情况下的单个诗人名称字符串（非数组）
        if (!Array.isArray(currentPoetName) && typeof currentPoetName === 'string' && currentPoetName !== '全部诗人' && currentPoetName !== '0') {
            console.log(`单选模式或多选模式中的单个诗人: ${currentPoetName}, 只显示该诗人的生命线`);

            // 首先尝试从已有数据中查找匹配的诗人
            const matchingPoet = poetLifeSpans.find(poet =>
                poet.name === currentPoetName ||
                // 处理仲振宣特殊情况
                (currentPoetName === '仲振宣' && poet.name === '仲振宣')
            );

            if (matchingPoet) {
                selectedPoets = [matchingPoet];
                console.log(`在现有数据中找到诗人 ${currentPoetName} 的信息`, matchingPoet);
            } else {
                // 如果在现有数据中找不到，尝试从API获取
                console.log(`在现有数据中找不到诗人 ${currentPoetName}，尝试从API获取数据`);
                fetchPoetDataByName(currentPoetName).then(poetData => {
                    if (poetData) {
                        selectedPoets = [poetData];
                        // 注意：由于异步调用，这里需要重新调用渲染逻辑
                        continueRenderWithPoets([poetData], timePoints);
                    } else {
                        console.warn(`无法从API获取诗人 ${currentPoetName} 的数据`);
                        // 修复: 如果找不到特定诗人，回退到显示全部诗人
                        continueRenderWithPoets([...poetLifeSpans], timePoints);
                    }
                }).catch(error => {
                    console.error(`获取诗人数据出错:`, error);
                    // 修复: 发生错误时也回退到显示全部诗人
                    continueRenderWithPoets([...poetLifeSpans], timePoints);
                });
                // 由于异步调用，先返回，避免重复渲染
                return;
            }
        }
        // 处理多选诗人情况（数组形式）
        else if (Array.isArray(currentPoetName) && currentPoetName.length > 0) {
            console.log(`选中了多个诗人: ${currentPoetName.join('、')}, 显示这些诗人的生命线`);

            // 从已有数据中查找匹配的诗人
            selectedPoets = poetLifeSpans.filter(poet => {
                // 特殊处理仲振宣匹配问题
                if (currentPoetName.includes('仲振宣') && poet.name === '仲振宣') {
                    console.log(`【特殊处理】找到仲振宣的生命线数据: ID=${poet.id}, 生于${poet.birthYear}, 卒于${poet.deathYear}`);
                    return true;
                }
                return currentPoetName.includes(poet.name);
            });

            console.log(`在现有数据中找到 ${selectedPoets.length} 个匹配的诗人`);

            // 如果找到的诗人数量少于选中的数量，尝试从API获取缺失的诗人数据
            if (selectedPoets.length < currentPoetName.length) {
                const missingPoets = currentPoetName.filter(name => {
                    // 特殊处理仲振宣
                    if (name === '仲振宣' && selectedPoets.some(p => p.name === '仲振宣')) {
                        return false; // 如果已找到仲振宣，不再查找
                    }
                    return !selectedPoets.some(poet => poet.name === name);
                });

                console.log(`有 ${missingPoets.length} 个诗人在现有数据中找不到，尝试从API获取: ${missingPoets.join('、')}`);

                // 收集所有获取缺失诗人数据的Promise
                const fetchPromises = missingPoets.map(poetName =>
                    fetchPoetDataByName(poetName)
                );

                // 等待所有Promise完成，然后继续渲染
                Promise.all(fetchPromises).then(poetDataList => {
                    // 过滤出成功获取的诗人数据
                    const validPoetData = poetDataList.filter(data => data !== null);
                    console.log(`成功从API获取了 ${validPoetData.length} 个诗人的数据`);

                    if (validPoetData.length > 0) {
                        // 将API获取的数据与已有的数据合并
                        const combinedPoets = [...selectedPoets, ...validPoetData];
                        console.log(`合并后有 ${combinedPoets.length} 个诗人数据`);

                        // 使用合并后的数据继续渲染
                        continueRenderWithPoets(combinedPoets, timePoints);
                    } else if (selectedPoets.length > 0) {
                        // 如果没有从API获取到新数据，但已有一些匹配的诗人数据，使用已有数据继续渲染
                        continueRenderWithPoets(selectedPoets, timePoints);
                    } else {
                        // 如果完全没有找到匹配的诗人数据，回退到显示全部诗人
                        console.warn(`无法找到任何选中诗人的数据，回退到显示全部诗人`);
                        continueRenderWithPoets(poetLifeSpans, timePoints);
                    }
                }).catch(error => {
                    console.error(`获取诗人数据出错:`, error);
                    // 发生错误时，如果有部分诗人数据，使用这些数据；否则回退到显示全部诗人
                    if (selectedPoets.length > 0) {
                        continueRenderWithPoets(selectedPoets, timePoints);
                    } else {
                        continueRenderWithPoets(poetLifeSpans, timePoints);
                    }
                });

                // 由于异步调用，先返回，避免重复渲染
                return;
            }
        }
        // 显示全部诗人（或默认情况）
        else if (currentPoetName === '全部诗人' || currentPoetName === '0') {
            // 显示全部诗人
            selectedPoets = [...poetLifeSpans];
            console.log(`选中了全部诗人，显示所有 ${selectedPoets.length} 位诗人的生命线`);
        } else {
            // 默认显示全部诗人
            selectedPoets = [...poetLifeSpans];
            console.log(`未指定明确的诗人，显示所有 ${selectedPoets.length} 位诗人的生命线`);
        }
    } else {
        // 默认显示全部诗人
        selectedPoets = [...poetLifeSpans];
        console.log(`未指定诗人，显示所有 ${selectedPoets.length} 位诗人的生命线`);
    }

    // 继续使用过滤后的诗人数据进行渲染
    continueRenderWithPoets(selectedPoets, timePoints);

    // 辅助函数：从API获取特定诗人的数据
    async function fetchPoetDataByName(poetName) {
        try {
            console.log(`向API请求诗人 ${poetName} 的数据`);
            const response = await axios.get(`http://localhost:5000/api/poet_by_name?name=${encodeURIComponent(poetName)}`);
            if (response.data && response.data.status === 'success' && response.data.data) {
                const poetData = response.data.data;
                console.log(`成功从API获取诗人 ${poetName} 的数据:`, poetData);

                // 转换API返回的数据为生命线所需格式
                return {
                    id: poetData.poetID || 0,
                    name: poetData.NameHZ || poetData.NamePY || poetName,
                    birthYear: parseInt(poetData.StartYear) || 0,
                    deathYear: parseInt(poetData.EndYear) || parseInt(poetData.StartYear) + 60, // 如果没有死亡年份，假设寿命60年
                    gender: poetData.Sex || '未知'
                };
            }
            console.error(`API返回的诗人 ${poetName} 数据无效或格式错误`);
            return null;
        } catch (error) {
            console.error(`获取诗人 ${poetName} 数据失败:`, error);
            return null;
        }
    }

    // 辅助函数：使用过滤后的诗人数据继续渲染过程
    function continueRenderWithPoets(poets, timePointsData) {
        if (!poets || poets.length === 0) {
            console.log('没有可渲染的诗人数据');
            return;
        }

        // 确保timePointsData有效
        if (!timePointsData || timePointsData.length === 0) {
            console.error('无效的时间点数据，无法继续渲染');
            return;
        }

        console.log(`准备渲染 ${poets.length} 位诗人的生命线，时间点数据长度: ${timePointsData.length}`);

        // 对诗人进行去重，防止重复渲染
        const uniquePoets = [];
        const seenPoetIds = new Set();
        const seenPoetNames = new Set();

        poets.forEach(poet => {
            // 使用ID和名称双重检查
            const poetKey = `${poet.id}-${poet.name}`;
            if (!seenPoetIds.has(poet.id) && !seenPoetNames.has(poet.name) && !seenPoetNames.has(poetKey)) {
                seenPoetIds.add(poet.id);
                seenPoetNames.add(poet.name);
                seenPoetNames.add(poetKey);
                uniquePoets.push(poet);
            } else {
                console.log(`跳过重复的诗人: ${poet.name} (ID: ${poet.id})`);
            }
        });

        if (uniquePoets.length < poets.length) {
            console.log(`去重后: 从${poets.length}个诗人减少到${uniquePoets.length}个唯一诗人`);
            poets = uniquePoets;
        }

        // 多选模式下的诗人颜色映射
        const poetColorMap = new Map();
        const isMultiSelectMode = Array.isArray(currentPoetName) && currentPoetName.length > 0;

        // 在多选模式下为每个诗人分配一个固定颜色 (与 timePoints.js 保持一致)
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
                '#F97316', // 橙色
                '#8B5CF6'  // 再次使用紫色
            ];

            // 注意：这里需要使用 selectedPoets 原始列表来确定颜色索引，而不是去重后的 poets 列表
            const originalSelectedPoets = Array.isArray(currentPoetName) ? currentPoetName : [];
            const nameToIndexMap = new Map(originalSelectedPoets.map((name, index) => [name, index]));

            poets.forEach(poet => {
                const index = nameToIndexMap.get(poet.name);
                if (index !== undefined) {
                    const color = poetColors[index % poetColors.length];
                    poetColorMap.set(poet.name, color);
                } else {
                    // 如果在原始选择列表中找不到（理论上不应该发生），分配默认颜色
                    poetColorMap.set(poet.name, '#8B5CF6');
                    console.warn(`无法为诗人 ${poet.name} 找到原始索引，使用默认颜色`);
                }
            });

            console.log('多选模式: 为每个诗人分配了唯一颜色',
                Array.from(poetColorMap.entries()).map(([name, color]) => `${name}: ${color}`));
        }

        // 获取给定年份对应的角度的辅助函数
        const getAngleByYear = (year) => {
            // 年份数据检查，确保是合理的数字
            if (isNaN(year) || year <= 0) {
                console.warn(`无效的年份值: ${year}, 使用默认值替代`);
                // 使用中间年份作为默认值
                year = timePointsData[Math.floor(timePointsData.length / 2)];
            }

            // 检查是否为多选模式
            const isMultiSelectMode = Array.isArray(currentPoetName) && currentPoetName.length > 0;

            if (isMultiSelectMode) {
                // 多选模式：根据所有选中诗人的生命年份计算角度
                // 1. 收集所有选中诗人的年份
                const selectedPoetYears = new Set();
                poets.forEach(poet => {
                    if (poet.birthYear && poet.deathYear && poet.deathYear > poet.birthYear) {
                        for (let y = poet.birthYear; y <= poet.deathYear; y++) {
                            selectedPoetYears.add(y);
                        }
                    }
                });

                // 2. 排序年份
                const sortedYears = Array.from(selectedPoetYears).sort((a, b) => a - b);

                // 3. 找到目标年份在排序后年份中的索引
                const yearIndex = sortedYears.indexOf(year);

                // 如果找不到年份，使用最接近的年份
                if (yearIndex === -1) {
                    const closestYear = sortedYears.reduce((prev, curr) =>
                        Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
                    );
                    const closestIndex = sortedYears.indexOf(closestYear);
                    return (closestIndex / sortedYears.length) * 360;
                }

                // 4. 计算角度 - 与timePoints.js中保持一致
                return (yearIndex / sortedYears.length) * 360;
            } else {
                // 非多选模式：使用原始逻辑
                // 找到时间点中最接近的年份
                const closestYear = timePointsData.reduce((prev, curr) =>
                    Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
                );

                // 找到这个年份在时间点数组中的索引
                const yearIndex = timePointsData.indexOf(closestYear);

                // 确保找到有效的索引
                if (yearIndex === -1) {
                    console.warn(`在时间点数组中找不到年份 ${closestYear}，使用线性映射`);
                    // 使用线性映射作为备选方案
                    const minTimeYear = Math.min(...timePointsData);
                    const maxTimeYear = Math.max(...timePointsData);
                    const yearRange = maxTimeYear - minTimeYear;
                    const yearPosition = Math.max(0, Math.min(1, (year - minTimeYear) / yearRange));
                    return yearPosition * 360;
                }

                // 和timePoints.js中保持完全一致的角度计算
                return (yearIndex / timePointsData.length) * 360;
            }
        };

        // 按出生年份排序
        poets.sort((a, b) => a.birthYear - b.birthYear);

        // 计算每个诗人占据的角度区域，根据出生和死亡年份
        // 存储诗人的角度范围，用于检测重叠
        const poetAngleRanges = [];

        // 记录诗人年份到角度的转换情况
        if (poets.length > 0) {
            console.log(`时间点数组(共${timePointsData.length}个): ${timePointsData.join(', ')}`);
            console.log(`诊断: 第一个诗人 ${poets[0].name} 的出生年 ${poets[0].birthYear} 对应的角度是 ${getAngleByYear(poets[0].birthYear)}`);
            if (poets.length > 1) {
                console.log(`诊断: 最后一个诗人 ${poets[poets.length - 1].name} 的出生年 ${poets[poets.length - 1].birthYear} 对应的角度是 ${getAngleByYear(poets[poets.length - 1].birthYear)}`);
            }
        }

        let invalidAngleCount = 0;

        poets.forEach(poet => {
            // 使用新的角度计算方式，确保与时间轴对应
            const startAngle = getAngleByYear(poet.birthYear);
            let endAngle = getAngleByYear(poet.deathYear);

            // 检查计算出的角度是否有效
            if (isNaN(startAngle) || isNaN(endAngle)) {
                invalidAngleCount++;
                console.error(`诗人 ${poet.name} 的角度计算无效: 出生年=${poet.birthYear}, 死亡年=${poet.deathYear}`);
                return; // 跳过这个诗人
            }

            // 确保至少有一个最小弧度
            if (Math.abs(endAngle - startAngle) < 5) {
                // 如果角度太小，扩展一点
                endAngle = (startAngle + 5) % 360;
            }

            // 处理可能的角度倒置（如当死亡年份对应的角度小于出生年份对应的角度）
            if (endAngle < startAngle) {
                endAngle += 360; // 确保终止角度大于起始角度
            }

            poetAngleRanges.push({
                poet: poet,
                startAngle: startAngle,
                endAngle: endAngle
            });
        });

        // 按照角度范围大小排序，先绘制较大的范围
        poetAngleRanges.sort((a, b) =>
            (b.endAngle - b.startAngle) - (a.endAngle - a.startAngle)
        );

        console.log(`共发现${invalidAngleCount}个角度计算无效的诗人被跳过，成功处理了${poetAngleRanges.length}个诗人`);

        // 为每个诗人分配一个半径，尽量避免角度范围重叠的诗人位于同一半径
        const segmentCount = 20; // 从15增加到20段，进一步增加可用的半径层数
        const segmentSize = lifeLineRadiusRange / segmentCount;

        // 根据角度范围和出生年份排序，用于更合理地分配半径
        poetAngleRanges.sort((a, b) => {
            // 首先按照角度范围大小排序
            const aDiff = a.endAngle - a.startAngle;
            const bDiff = b.endAngle - b.startAngle;
            const diffCompare = bDiff - aDiff;

            // 如果角度范围相近，则按照出生年份排序
            if (Math.abs(diffCompare) < 10) {
                return a.poet.birthYear - b.poet.birthYear;
            }
            return diffCompare;
        });

        // 创建半径分配追踪器 - 跟踪每个角度扇区的占用情况
        // 每个扇区用一个数组表示每个半径段的诗人数量
        const sectorRadiusOccupancy = Array(36).fill().map(() => Array(segmentCount).fill(0));

        poetAngleRanges.forEach((poetRange) => {
            // 确定这个诗人占用的角度区间
            const startAngle = poetRange.startAngle;
            const endAngle = poetRange.endAngle;
            const midAngle = (startAngle + endAngle) / 2;

            // 获取该角度区域偏好的半径层
            const preferredSegments = getPreferredSegmentForAngle(midAngle % 360);

            // 为每个半径段计算与已有诗人的重叠度
            const segmentScores = Array(segmentCount).fill(0);

            // 找出所有可能重叠的诗人
            const potentialOverlaps = poetAngleRanges.filter(pr =>
                pr !== poetRange &&
                pr.segment !== undefined &&
                calculateOverlap(startAngle, endAngle, pr.startAngle, pr.endAngle) > 0
            );

            // 计算每个段的重叠分数
            for (let segment = 0; segment < segmentCount; segment++) {
                // 基础权重 - 偏好特定层
                segmentScores[segment] = 20; // 默认基础分数

                // 如果是偏好的层，给予优惠
                if (preferredSegments.includes(segment)) {
                    segmentScores[segment] -= 15; // 大幅减少分数，增加选择概率
                }

                // 增加与已分配诗人的重叠惩罚
                potentialOverlaps.forEach(pr => {
                    if (pr.segment === segment) {
                        // 角度重叠程度
                        const overlapDegree = calculateOverlap(startAngle, endAngle, pr.startAngle, pr.endAngle);
                        // 重叠越大，惩罚越严重
                        segmentScores[segment] += overlapDegree * 3;
                    }
                });

                // 添加扇区拥挤度权重
                const startSection = Math.floor(startAngle / 10) % 36;
                const endSection = Math.floor(endAngle / 10) % 36;

                // 计算一个连续的扇区范围
                const sectionRange = [];
                if (endSection >= startSection) {
                    for (let i = startSection; i <= endSection; i++) {
                        sectionRange.push(i % 36);
                    }
                } else {
                    // 处理跨0度的情况
                    for (let i = startSection; i < 36; i++) {
                        sectionRange.push(i);
                    }
                    for (let i = 0; i <= endSection; i++) {
                        sectionRange.push(i);
                    }
                }

                // 加上扇区已有诗人的权重
                sectionRange.forEach(section => {
                    segmentScores[segment] += sectorRadiusOccupancy[section][segment] * 5;
                });
            }

            // 找出分数最低的段（最佳选择）
            let bestSegment = 0;
            let minScore = segmentScores[0];

            for (let i = 1; i < segmentCount; i++) {
                if (segmentScores[i] < minScore) {
                    minScore = segmentScores[i];
                    bestSegment = i;
                }
            }

            // 分配最佳段落
            poetRange.segment = bestSegment;

            // 更新扇区占用情况
            const startSection = Math.floor(startAngle / 10) % 36;
            const endSection = Math.floor(endAngle / 10) % 36;

            if (endSection >= startSection) {
                for (let i = startSection; i <= endSection; i++) {
                    sectorRadiusOccupancy[i][bestSegment]++;
                }
            } else {
                // 处理跨0度的情况
                for (let i = startSection; i < 36; i++) {
                    sectorRadiusOccupancy[i][bestSegment]++;
                }
                for (let i = 0; i <= endSection; i++) {
                    sectorRadiusOccupancy[i][bestSegment]++;
                }
            }

            // 计算半径，添加少量随机偏移使分布更自然
            // 使用固定的间隔使曲线整齐可见
            const baseSegmentRadius = lifeLineInnerRadius + bestSegment * segmentSize;
            // 减小随机偏移量，使分布更规则
            const randOffset = (Math.random() * 0.15 + 0.9) * segmentSize; // 减小随机系数
            // 添加小的垂直偏移，使点向上移动一些
            const yOffset = -2 + Math.random() * 5; // 垂直上移10-15个像素，改为负值使其向上移动
            poetRange.radius = baseSegmentRadius + randOffset;
            poetRange.yOffset = yOffset;
        });

        // 绘制诗人生命线 - 按出生年份排序，确保早期诗人在前面绘制
        poetAngleRanges.sort((a, b) => a.poet.birthYear - b.poet.birthYear);

        // 统计实际显示的诗人数量
        console.log(`实际绘制的诗人生命线数量: ${poetAngleRanges.length}`);

        // 所有诗人统一使用的颜色 (非多选模式下)
        const defaultPoetLineColor = 'rgb(243,156,187)';

        // 获取当前选中的诗人名称，用于特殊处理
        console.log(`当前选中的诗人是: ${currentPoetName}`);

        poetAngleRanges.forEach((poetRange) => {
            const poet = poetRange.poet;

            // 检查该诗人是否已经被渲染
            const poetKey = `${poet.id}-${poet.name}`;
            if (!forceRender && renderedPoets.has(poetKey)) {
                console.log(`诗人 ${poet.name} (ID:${poet.id}) 已被渲染，跳过`);
                return;
            }

            // 记录这个诗人已经被渲染
            renderedPoets.add(poetKey);

            const startAngle = poetRange.startAngle;
            const endAngle = poetRange.endAngle;
            const finalRadius = poetRange.radius;

            // 判断是否为当前选中的诗人 (仅在单选模式下有效)
            const isCurrentSinglePoet = !isMultiSelectMode && (poet.name === currentPoetName || poets.length === 1);

            // 生成弧线的点
            const arcPoints = [];
            const angleStep = Math.min(5, (endAngle - startAngle) / 10); // 控制点的密度

            for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
                const rad = radians(angle);
                // 添加Y轴偏移，使曲线整体下移
                arcPoints.push([
                    center[0] + finalRadius * Math.cos(rad),
                    center[1] + finalRadius * Math.sin(rad) + poetRange.yOffset
                ]);
            }

            // 确保弧线的最后一个点是死亡年对应的角度
            const endRad = radians(endAngle);
            arcPoints.push([
                center[0] + finalRadius * Math.cos(endRad),
                center[1] + finalRadius * Math.sin(endRad) + poetRange.yOffset
            ]);

            // 使用分配的诗人颜色（多选模式下）或默认颜色（非多选模式）
            let lineColor = defaultPoetLineColor;
            if (isMultiSelectMode) {
                lineColor = poetColorMap.get(poet.name) || defaultPoetLineColor;
            }

            // 将16进制颜色转换为rgba，用于阴影
            const hexToRgba = (hex, alpha = 1) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : `rgba(128, 128, 128, ${alpha})`; // 默认灰色
            };

            const shadowColorRgba = hexToRgba(lineColor, 0.4);
            const hoverShadowColorRgba = hexToRgba(lineColor, 0.6);
            const singlePoetHighlightColor = 'rgba(255,215,0,0.6)'; // 单独选中时的金色高亮
            const singlePoetHoverHighlightColor = 'rgba(255,215,0,0.8)';

            // 创建诗人生命周期曲线
            const lifeCurve = new echarts.graphic.Polyline({
                shape: {
                    points: arcPoints,
                    smooth: 0.3 // 适度平滑
                },
                style: {
                    stroke: lineColor,
                    lineWidth: isCurrentSinglePoet ? 4 : (isMultiSelectMode ? 3.5 : 2.5), // 多选模式下线条更粗
                    opacity: isCurrentSinglePoet ? 1 : (isMultiSelectMode ? 0.9 : 0.8), // 多选模式下透明度略高
                    lineCap: 'round', // 圆形线帽
                    shadowBlur: isCurrentSinglePoet ? 8 : (isMultiSelectMode ? 6 : 4), // 多选模式下阴影更明显
                    shadowColor: isCurrentSinglePoet ? singlePoetHighlightColor : shadowColorRgba
                },
                zlevel: isCurrentSinglePoet ? 13 : 11, // 当前选中诗人层级更高
                poetName: poet.name, // 标记该曲线属于哪个诗人
                poetColor: lineColor // 存储诗人的颜色
            });

            // 添加出生点标记
            const birthRad = radians(startAngle);

            // 出生点（小圆点）
            const birthPoint = new echarts.graphic.Circle({
                shape: {
                    cx: center[0] + finalRadius * Math.cos(birthRad),
                    cy: center[1] + finalRadius * Math.sin(birthRad) + poetRange.yOffset, // 添加同样的Y轴偏移
                    r: isCurrentSinglePoet ? 5 : (isMultiSelectMode ? 4 : 3.5) // 多选模式下出生点更大
                },
                style: {
                    fill: lineColor, // 使用与生命线相同的颜色
                    opacity: isCurrentSinglePoet ? 1 : (isMultiSelectMode ? 0.95 : 0.9), // 多选模式下透明度略高
                    shadowBlur: isCurrentSinglePoet ? 8 : (isMultiSelectMode ? 6 : 4),
                    shadowColor: isCurrentSinglePoet ? singlePoetHighlightColor : shadowColorRgba
                },
                zlevel: isCurrentSinglePoet ? 13 : 11, // 当前选中诗人层级更高
                poetName: poet.name, // 标记该点属于哪个诗人
                poetColor: lineColor // 存储诗人的颜色
            });

            // 为生命周期曲线和点添加悬停效果
            lifeCurve.on('mouseover', function () {
                // 高亮曲线
                this.attr({
                    style: {
                        lineWidth: isCurrentSinglePoet ? 5 : (isMultiSelectMode ? 4.5 : 3.5), // 多选模式下效果更强
                        opacity: 1,
                        shadowBlur: isCurrentSinglePoet ? 12 : (isMultiSelectMode ? 10 : 8),
                        shadowColor: isCurrentSinglePoet ? singlePoetHoverHighlightColor : hoverShadowColorRgba
                    }
                });

                // 同时高亮出生点
                birthPoint.attr({
                    style: {
                        opacity: 1,
                        shadowBlur: isCurrentSinglePoet ? 12 : (isMultiSelectMode ? 10 : 8),
                        shadowColor: isCurrentSinglePoet ? singlePoetHoverHighlightColor : hoverShadowColorRgba
                    },
                    shape: {
                        r: isCurrentSinglePoet ? 6 : (isMultiSelectMode ? 5 : 4) // 扩大点的大小
                    }
                });

                // 构建悬浮窗文本
                const lifeSpan = poet.deathYear - poet.birthYear;
                const tooltipText = `${poet.name}${isCurrentSinglePoet ? ' (当前选中)' : ''}\n${poet.birthYear}-${poet.deathYear}\n享年: ${lifeSpan}岁\n性别: ${poet.gender}`;

                // 计算提示框位置（在曲线中点）
                const midAngle = (startAngle + endAngle) / 2;
                const midRad = radians(midAngle);
                const tooltipX = center[0] + finalRadius * Math.cos(midRad);
                const tooltipY = center[1] + finalRadius * Math.sin(midRad) + poetRange.yOffset; // 添加Y轴偏移

                showTooltip(tooltipText, tooltipX, tooltipY);
            });

            lifeCurve.on('mouseout', function () {
                // 恢复曲线样式
                this.attr({
                    style: {
                        lineWidth: isCurrentSinglePoet ? 4 : (isMultiSelectMode ? 3.5 : 2.5),
                        opacity: isCurrentSinglePoet ? 1 : (isMultiSelectMode ? 0.9 : 0.8),
                        shadowBlur: isCurrentSinglePoet ? 8 : (isMultiSelectMode ? 6 : 4),
                        shadowColor: isCurrentSinglePoet ? singlePoetHighlightColor : shadowColorRgba
                    }
                });

                // 恢复出生点样式
                birthPoint.attr({
                    style: {
                        opacity: isCurrentSinglePoet ? 1 : (isMultiSelectMode ? 0.95 : 0.9),
                        shadowBlur: isCurrentSinglePoet ? 8 : (isMultiSelectMode ? 6 : 4),
                        shadowColor: isCurrentSinglePoet ? singlePoetHighlightColor : shadowColorRgba
                    },
                    shape: {
                        r: isCurrentSinglePoet ? 5 : (isMultiSelectMode ? 4 : 3.5) // 恢复原始大小
                    }
                });

                hideTooltip();
            });

            // 添加到渲染器
            zr.add(lifeCurve);
            zr.add(birthPoint);
            elements.push(lifeCurve);
            elements.push(birthPoint);
        });
    }
}

// 导出获取诗人颜色的函数，供其他模块使用
export const getPoetLineColor = (poetName, poetColors) => {
    if (!poetColors || !poetColors.has(poetName)) {
        return '#8B5CF6'; // 默认紫色
    }
    return poetColors.get(poetName);
}; 