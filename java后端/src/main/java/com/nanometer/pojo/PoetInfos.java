package com.nanometer.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PoetInfos {
    private Integer poetId;
    private String poetName;
    private Integer birthday;
    private Integer poemNum;
    private String family;
    private String province;
    private String city;
    private List<EmotionInfo> emotionInfos;
}
