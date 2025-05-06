package com.nanometer.pojo;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FlowersChart {
    private Integer startYear;  // 最早的诗人信息
    private Integer endYear; // 最晚的诗人信息
    private Integer EmotionMinNum;  // 诗人情感最少的诗词量
    private Integer EmotionMaxNum;  // 诗人情感最多的诗词量
    private Integer poemMinNum;   // 诗人最小诗词量
    private Integer poemMaxNum;   // 诗人最大诗词量
    private List<PoetInfos> poetInfos; // 诗人信息
}