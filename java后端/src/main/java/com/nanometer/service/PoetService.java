package com.nanometer.service;

import java.util.List;

import com.nanometer.pojo.CycleInfo;
import com.nanometer.pojo.EmotionInfo;
import com.nanometer.pojo.FlowersChart;
import com.nanometer.pojo.MainInfo;
import com.nanometer.pojo.NavigateInfo;
import com.nanometer.pojo.NormalDistribution;
import com.nanometer.pojo.RiverData;
import com.nanometer.pojo.PlacePoetPair;

public interface PoetService {
    /**
     * 查询梅花图的信息
     * 
     * @return
     */
    FlowersChart getFlowersChart();

    /**
     * 查询基本信息
     * 
     * @return
     */
    MainInfo getMainInfo();

    /**
     * 查询有家族诗人的信息
     * 
     * @return
     */
    // FamilyPoet getFamilyPoets();

    /**
     * 查询没有家族的诗人的信息 * @return
     */
    // NoFamilyInfo getNoFamilyPoets();

    /**
     * 根据诗人ID查询其情感量
     */
    List<EmotionInfo> getEmotionInfosByPoetID(Integer poetID);

    /**
     * 查询河流图数据
     * 
     * @return
     */
    List<RiverData> getRiverData();

    /**
     *
     * @return
     */
    List<CycleInfo> getCycle(Integer startYear, Integer endYear);

    List<NavigateInfo> getNavigate();

    List<double[]> getEmotionCoordinates();

    // List<String> getPoems(List<Integer> poetIds);

    /**
     * 根据poetIds查询词云图数据
     * 
     * @return
     */
    // List<WordCloud> getWordCloud(@RequestBody List<Integer> poetIds);

    List<NormalDistribution> calculatePoetDistribution(Integer startYear, Integer endYear, Integer count);

    /**
     * 获取所有现代地名 (PresentdayEquivalent) 及其对应的诗人名称 (NameHZ)，包括重复项
     *
     * @return 包含地点和诗人名称对的列表
     */
    List<PlacePoetPair> getAllPlacePoetPairs();
}
