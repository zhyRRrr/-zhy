package com.nanometer.service.impl;

// 导入相关类和包
import java.text.DecimalFormat;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import com.nanometer.pojo.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.nanometer.mapper.PoetMapper;
import com.nanometer.service.PoetService;
import com.nanometer.utils.MinMaxScaler;
import com.nanometer.utils.PCA;
import com.nanometer.utils.StandardScaler;

// 标记该类为Spring的服务组件
@Service
public class PoetServiceImpl implements PoetService {
    // 自动注入PoetMapper，用于数据库操作
    @Autowired
    private PoetMapper poetMapper;

    // 获取花朵图表数据
    @Override
    public FlowersChart getFlowersChart() {
        // 获取所有诗人信息
        List<PoetInfos> poetInfos = poetMapper.getPoetInfos();
        // 初始化情感和诗歌数量的最小值和最大值
        AtomicReference<Integer> EmotionMinNum = new AtomicReference<>(10000);
        AtomicReference<Integer> EmotionMaxNum = new AtomicReference<>(0);
        AtomicReference<Integer> poemMinNum = new AtomicReference<>(10000);
        AtomicReference<Integer> poemMaxNum = new AtomicReference<>(0);

        // 遍历每个诗人信息
        poetInfos.forEach(poetInfo -> {
            // 获取该诗人有哪些诗集
            List<Integer> poemsId = poetMapper.getPoemsIdByPoetName(poetInfo.getPoetName());
            // 用于存储未处理的情感计数
            Map<String, Integer> noProcessEmotionsCount = new HashMap<>();
            // 遍历每个诗集ID
            poemsId.forEach(poemId -> {
                // 获取诗集的情感信息
                String strEmotions = poetMapper.getEmotionInfoByPoemId(poemId);
                System.out.println(strEmotions);
                // 分割情感字符串
                String[] emotions = strEmotions.split(",");
                // 统计每个情感的出现次数
                for (String emotion : emotions) {
                    noProcessEmotionsCount.put(emotion.trim(),
                            noProcessEmotionsCount.getOrDefault(emotion.trim(), 0) + 1);
                }
            });
            // 将未处理的情感计数转换为EmotionInfo列表
            List<EmotionInfo> emotionsCount = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : noProcessEmotionsCount.entrySet()) {
                emotionsCount.add(new EmotionInfo(entry.getKey(), entry.getValue()));
                // 更新情感数量的最小值和最大值
                EmotionMinNum.set(Math.min(EmotionMinNum.get(), entry.getValue()));
                EmotionMaxNum.set(Math.max(EmotionMaxNum.get(), entry.getValue()));
            }
            // 设置诗人的诗歌数量和情感信息
            poetInfo.setPoemNum(poemsId.size());
            poetInfo.setEmotionInfos(emotionsCount);
            // 更新诗歌数量的最小值和最大值
            poemMinNum.set(Math.min(poemMinNum.get(), poetInfo.getPoemNum()));
            poemMaxNum.set(Math.max(poemMaxNum.get(), poetInfo.getPoemNum()));
        });
        // 返回花朵图表数据
        return new FlowersChart(poetMapper.getStartYear(), poetMapper.getEndYear(), EmotionMinNum.get(),
                EmotionMaxNum.get(), poemMinNum.get(), poemMaxNum.get(), poetInfos);
    }

    // 获取主信息
    @Override
    public MainInfo getMainInfo() {
        // 返回起止年份的主信息
        return new MainInfo(poetMapper.getStartYear(), poetMapper.getEndYear());
    }

    // 根据诗人ID获取情感信息
    @Override
    public List<EmotionInfo> getEmotionInfosByPoetID(Integer poetID) {
        // 统计当前诗人的情感和主题信息
        List<EmotionInfo> emotionInfos = poetMapper.getEmotionInfoByPoetID(poetID);

        // 用于存储当前诗人每个情感单词及其数量的映射表
        Map<String, Integer> emotionWordCountMap = new HashMap<>();

        for (EmotionInfo info : emotionInfos) {
            String[] emotions = info.getEmotion().split(", ");
            for (String emotion : emotions) {
                if (emotionWordCountMap.containsKey(emotion)) {
                    // 如果情感单词已存在于映射表中，累加对应的数量
                    emotionWordCountMap.put(emotion, emotionWordCountMap.get(emotion) + info.getPoetryQuantity());
                } else {
                    // 如果情感单词不存在于映射表中，添加新的键值对
                    emotionWordCountMap.put(emotion, info.getPoetryQuantity());
                }
            }
        }

        // 将处理后的情感信息重新组织成新的EmotionInfo列表
        List<EmotionInfo> processedEmotionInfos = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : emotionWordCountMap.entrySet()) {
            processedEmotionInfos.add(new EmotionInfo(entry.getKey(), entry.getValue()));
        }
        return processedEmotionInfos;
    }

    @Override
    public List<RiverData> getRiverData() {
        List<RiverData> noProcessData = poetMapper.getRiverData();
        // System.out.println(noProcessData);
        // System.out.println("数组大小" + noProcessData.size());

        Map<RiverDataKey, Integer> topicWordCountMap = new HashMap<>();
        // 用于存储每个主题和情感的出现次数的映射表
        AtomicReference<Integer> cnt = new AtomicReference<>(0);

        noProcessData.forEach(riverData -> {
            // System.out.println(riverData.toString());
            String[] topics = riverData.getTopic().split(","); // 每一首诗的主题
            String[] emotions = riverData.getEmotion().split(", "); // 每一首诗的情感，只选取第一个
            // for (String topic : topics) {
            // cnt.updateAndGet(v -> v + 1);
            // RiverDataKey key = new RiverDataKey(riverData.getYear(),
            // riverData.getPoetName(), topic, emotions[0]);
            // if (!topicWordCountMap.containsKey(key)) {
            // topicWordCountMap.put(key, 0);
            // }
            // topicWordCountMap.put(key, topicWordCountMap.get(key) + 1 / topics.length);
            // // 对于同一个诗人的同一个主题的同一个情感，加 1/一首诗的主题数
            // }
            cnt.updateAndGet(v -> v + 1);
            RiverDataKey key = new RiverDataKey(riverData.getYear(), riverData.getPoetId(), riverData.getPoetName(),
                    topics[0], emotions[0]);
            if (!topicWordCountMap.containsKey(key)) {
                topicWordCountMap.put(key, 0);
            }
            topicWordCountMap.put(key, topicWordCountMap.get(key) + 1);
        });
        // System.out.println(cnt);
        List<RiverData> processedData = new ArrayList<>();
        for (RiverDataKey key : topicWordCountMap.keySet()) {
            Integer count = topicWordCountMap.get(key);
            processedData.add(new RiverData(key.getYear(), key.getPoetId(), key.getPoetName(), key.getTopic(),
                    key.getEmotion(), count));
        }
        processedData.sort((p1, p2) -> {
            // if (Objects.equals(p1.getTopic(), p2.getTopic())) {
            // return p1.getEmotion().compareTo(p2.getEmotion());
            // }
            if (Objects.equals(p1.getYear(), p2.getYear())) {
                return p1.getTopic().compareTo(p2.getTopic());
            }
            return p1.getYear().compareTo(p2.getYear());
        });

        System.out.println("处理后数组大小" + processedData.size());
        return processedData;
        // return List.of();
    }

    @Override
    public List<CycleInfo> getCycle(Integer startYear, Integer endYear) {
        return poetMapper.getCycleInfos(startYear, endYear);
    }

    @Override
    public List<NavigateInfo> getNavigate() {
        return poetMapper.getNavigate();
    }

    // @Override
    // public List<String> getPoems(List<Integer> poetIds) {
    // List<String> poems = poetMapper.getPoems(poetIds);
    // return List.of();
    // }

    // @Override
    // public List<WordCloud> getWordCloud(@RequestBody List<Integer> poetIds) {
    // return findWordCloudByPoetIds(poetIds);

    // return List.of();
    // }

    public List<double[]> getEmotionCoordinates() {
        // 获取所有情感信息及其对应的诗词ID
        List<EmotionWithPoemId> emotions = poetMapper.getAllEmotions();

        // 增强的情感向量编码（加入语义相似度权重）
        Map<String, double[]> emotionVectors = createEnhancedEmotionVectors();

        // 创建数据矩阵并应用加权组合
        double[][] data = new double[emotions.size()][6];
        for (int i = 0; i < emotions.size(); i++) {
            EmotionWithPoemId emotionWithPoemId = emotions.get(i);
            String[] emotionLabels = emotionWithPoemId.getEmotion().split("[, /]+");

            // 应用动态权重：主情感权重0.7，次要情感权重0.3
            data[i] = combineEmotionsWithWeight(emotionLabels, emotionVectors);
        }

        // 使用PCA进行降维（保留95%方差）
        PCA pca = new PCA(data, 2);
        pca.setVarianceThreshold(0.95);
        double[][] reducedData = pca.reduceDimension();

        // 后处理：标准化和范围缩放
        return processCoordinates(reducedData);
    }

    // 创建增强型情感向量（加入语义相似度）
    private Map<String, double[]> createEnhancedEmotionVectors() {
        Map<String, double[]> vectors = new HashMap<>();
        // 主维度保持独热编码，次维度加入语义权重
        vectors.put("乐", new double[] { 1.0, 0.2, 0.1, 0.0, 0.0, 0.0 }); // 与喜、思有弱关联
        vectors.put("思", new double[] { 0.2, 1.0, 0.3, 0.1, 0.0, 0.0 }); // 与喜、哀关联
        vectors.put("喜", new double[] { 0.3, 0.2, 1.0, 0.0, 0.0, 0.1 }); // 与乐、豪关联
        vectors.put("哀", new double[] { 0.0, 0.1, 0.0, 1.0, 0.3, 0.0 }); // 与怒、思关联
        vectors.put("怒", new double[] { 0.0, 0.0, 0.0, 0.2, 1.0, 0.0 }); // 与哀关联
        vectors.put("豪", new double[] { 0.1, 0.0, 0.2, 0.0, 0.0, 1.0 }); // 与喜、乐关联
        return vectors;
    }

    // 带权重的情感组合方法
    private double[] combineEmotionsWithWeight(String[] emotions, Map<String, double[]> vectors) {
        double[] result = new double[6];
        if (emotions.length == 0)
            return result;

        // 主情感（第一个标签）获得更高权重
        double[] primary = vectors.getOrDefault(emotions[0].trim(), new double[6]);
        for (int i = 0; i < 6; i++) {
            result[i] = primary[i] * 0.7;
        }

        // 次要情感加权平均
        if (emotions.length > 1) {
            double secondaryWeight = 0.3 / (emotions.length - 1);
            for (int i = 1; i < emotions.length; i++) {
                double[] vec = vectors.getOrDefault(emotions[i].trim(), new double[6]);
                for (int j = 0; j < 6; j++) {
                    result[j] += vec[j] * secondaryWeight;
                }
            }
        }
        return result;
    }

    // 坐标后处理方法
    private List<double[]> processCoordinates(double[][] data) {
        // 1. 标准化
        StandardScaler scaler = new StandardScaler();
        double[][] normalized = scaler.fitTransform(data);

        // 2. 范围缩放 (-1, 1)
        MinMaxScaler minMax = new MinMaxScaler(-1, 1);
        double[][] scaled = minMax.fitTransform(normalized);

        // 3. 保留四位小数
        List<double[]> coordinates = new ArrayList<>();
        DecimalFormat df = new DecimalFormat("#.0000");
        for (double[] row : scaled) {
            double[] formatted = new double[row.length];
            for (int i = 0; i < row.length; i++) {
                formatted[i] = Double.parseDouble(df.format(row[i]));
            }
            coordinates.add(formatted);
        }
        return coordinates;
    }

    @Override
    public List<NormalDistribution> calculatePoetDistribution(Integer startYear, Integer endYear, Integer count) {
        if (startYear == null || endYear == null || count == null || startYear >= endYear || count <= 0) {
            return Collections.emptyList();
        }

        Integer realStartYear = startYear + 5;

        // 如果 lifespan 太短（比如活不到5岁），也返回全0
        if (realStartYear > endYear) {
            return java.util.stream.IntStream.rangeClosed(startYear, endYear)
                    .mapToObj(year -> new NormalDistribution(year, 0))
                    .collect(Collectors.toList());
        }

        int yearRange = endYear - realStartYear + 1;
        double mean = (realStartYear + endYear) / 2.0;
        double stdDev = yearRange / 6.0;

        Map<Integer, Double> yearWeightMap = new HashMap<>();
        double totalWeight = 0.0;

        for (int year = realStartYear; year <= endYear; year++) {
            double exponent = -Math.pow(year - mean, 2) / (2 * stdDev * stdDev);
            double weight = Math.exp(exponent);
            yearWeightMap.put(year, weight);
            totalWeight += weight;
        }

        Map<Integer, Integer> yearCounts = new HashMap<>();
        int assigned = 0;

        for (int year = realStartYear; year <= endYear; year++) {
            double weight = yearWeightMap.get(year);
            int value = (int) Math.floor(weight / totalWeight * count);
            yearCounts.put(year, value);
            assigned += value;
        }

        int remainder = count - assigned;
        List<Integer> sortedYears = yearWeightMap.entrySet().stream()
                .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        for (int i = 0; i < remainder; i++) {
            Integer year = sortedYears.get(i % sortedYears.size());
            yearCounts.put(year, yearCounts.get(year) + 1);
        }

        // 构建完整的列表（包含前五年全为 0 的数据）
        List<NormalDistribution> result = new ArrayList<>();
        for (int year = startYear; year <= endYear; year++) {
            Integer value = yearCounts.getOrDefault(year, 0);
            result.add(new NormalDistribution(year, value));
        }

        return result;
    }

    /**
     * 获取所有现代地名 (PresentdayEquivalent) 及其对应的诗人名称 (NameHZ)，包括重复项
     *
     * @return 包含地点和诗人名称对的列表
     */
    @Override
    public List<PlacePoetPair> getAllPlacePoetPairs() {
        return poetMapper.getAllPlacePoetPairs();
    }
}
