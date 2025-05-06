package com.nanometer.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.nanometer.pojo.CycleInfo;
import com.nanometer.pojo.EmotionInfo;
import com.nanometer.pojo.EmotionWithPoemId;
import com.nanometer.pojo.NavigateInfo;
import com.nanometer.pojo.NormalDistribution;
import com.nanometer.pojo.PoetInfos;
import com.nanometer.pojo.RiverData;
import com.nanometer.pojo.PlacePoetPair;

@Mapper
public interface PoetMapper {

        /**
         * 查询诗人的最早出生年份和最晚出生年份之间的差
         * 
         * @return
         */
        @Select("select max(StartYear) - min(StartYear) from poet")
        // @Select("SELECT MAX(CAST(StartYear AS UNSIGNED)) - MIN(CAST(StartYear AS
        // UNSIGNED)) FROM poet")
        Integer getTotalYears();

        /**
         * 查找非空的家族名
         * 
         * @return
         */
        @Select("select DISTINCT family from poet where family is not null")
        List<String> getFamilyName();

        /**
         * 查找当前家族有哪些不同地名的分支
         * 
         * @param familyName
         * @return
         */
        @Select("select DISTINCT province from poet where family like #{familyName}")
        List<String> getPlaceNameByFamilyName(String familyName);

        /**
         * 查找同一家族统一地点的诗人ID
         * 
         * @param familyName
         * @param placeName
         * @return
         */
        @Select("select poetID from poet where family like #{familyName} and province like #{placeName}")
        List<Integer> getPoetIDList(String familyName, String placeName);

        /**
         * 根据poetID查询诗人的情感信息
         * 
         * @param poetID
         * @return
         */
        @Select("select emotion from emotion where poemId = #{poetID}")
        String getEmotion(Integer poetID);

        /**
         * 通过诗人ID获取诗人出生日期
         * 
         * @param poetID
         * @return
         */
        @Select("select StartYear from poet where poetID = #{poetID}")
        Integer getBirthday(Integer poetID);

        /**
         * 查询没有家族的诗人地点
         * 
         * @return
         */
        @Select("select DISTINCT province from poet where family is null")
        List<String> getPlaceNameNoFamily();

        /**
         * 根据地点查询没有家族诗人的ID
         * 
         * @param placeName
         * @return
         */
        @Select("select poetID from poet where family is null and province like #{placeName}")
        List<Integer> getNofamilyPoetIDList(String placeName);

        /**
         * 查询最早的诗人信息
         * 
         * @return
         */
        @Select("select min(StartYear) from poet")
        Integer getStartYear();

        /**
         * 查询最晚的诗人信息
         * 
         * @return
         */
        @Select("select max(StartYear) from poet")
        Integer getEndYear();

        /**
         * 根据诗人ID查询诗人对应emotion
         * 
         * @param poetID
         * @return
         */
        @Select("SELECT emotion,COUNT(emotion) AS poetryQuantity FROM emotion WHERE poemId IN (SELECT poemId FROM poems WHERE poetName = (SELECT NameHZ FROM poet WHERE poetID = ${poetID})) group by emotion")
        List<EmotionInfo> getEmotionInfoByPoetID(Integer poetID);

        /**
         * 获取河流图数据
         * 
         * @return
         */
        @Select("SELECT poet.StartYear AS year, poet.poetID AS poetId, poet.NameHZ as poetName, topic.topics AS topic, emotion.emotion AS emotion\n"
                        +
                        "FROM poet, poems, topic, emotion\n" +
                        "WHERE poet.NameHZ = poems.poetName and poems.poemId = topic.poemId and poems.poemId = emotion.poemId")
        List<RiverData> getRiverData();

        @Select("SELECT YearXF as Year, REPLACE(Year, '元年', '') as cycle FROM cycle WHERE YearXF >= #{startYear} and YearXF <= #{endYear} and Year like '%元年'")
        List<CycleInfo> getCycleInfos(Integer startYear, Integer endYear);

        @Select("SELECT COUNT(*) FROM poems where poems.poetName = #{poetName} group by poems.poetName")
        Integer getPoemNum(String poetName);

        @Select("SELECT poetID as poetId, province from poet")
        List<NavigateInfo> getNavigate();

        @Select("SELECT poems.poemName, poems.content FROM poems JOIN poet ON poems.poetName = poet.NameHZ WHERE poet.poetId IN (#{poetIds})")
        List<Map<String, String>> getPoems(List<Integer> poetIds);

        @Select("SELECT poetID as poetId, NameHZ as poetName, StartYear as birthday, " +
                        "family, province, city FROM poet")
        List<PoetInfos> getPoetInfos();

        @Select("SELECT poemId from poems where poetName=#{poetName}")
        List<Integer> getPoemsIdByPoetName(String poetName);

        @Select("SELECT emotion from emotion where poemId=#{poemId}")
        String getEmotionInfoByPoemId(Integer poemId);

        /**
         * 获取所有情感信息及其对应的诗词ID
         */
        @Select("SELECT poemId, emotion FROM emotion")
        List<EmotionWithPoemId> getAllEmotions();

        /**
         * 获取所有现代地名 (PresentdayEquivalent) 及其对应的诗人名称 (NameHZ)，包括重复项
         *
         * @return 包含地点和诗人名称对的列表
         */
        @Select("SELECT PresentdayEquivalent as place, NameHZ as poetName FROM poet WHERE PresentdayEquivalent IS NOT NULL AND PresentdayEquivalent != ''")
        List<PlacePoetPair> getAllPlacePoetPairs();

        // @Select("SELECT * from poet where poetID In (1,2,3)")
        // List<WordCloud> findWordCloudByPoetIds(List<Integer> poetIds);

}
