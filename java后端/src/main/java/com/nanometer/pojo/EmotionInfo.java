package com.nanometer.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmotionInfo {
    public String emotion;
    public Integer poetryQuantity;
}