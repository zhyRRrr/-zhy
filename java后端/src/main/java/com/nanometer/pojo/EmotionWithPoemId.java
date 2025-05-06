package com.nanometer.pojo;

import lombok.Data;

@Data
public class EmotionWithPoemId {
    // 定义一个poemId属性，类型为Integer
    private Integer poemId;
    // 定义一个emotion属性，类型为String
    private String emotion;

    // 构造方法，用于初始化poemId和emotion属性
    public EmotionWithPoemId(Integer poemId, String emotion) {
        this.poemId = poemId;
        this.emotion = emotion;
    }

}