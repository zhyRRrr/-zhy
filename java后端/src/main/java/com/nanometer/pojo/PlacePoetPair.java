package com.nanometer.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PlacePoetPair {
    private String place; // 地点名称 (PresentdayEquivalent)
    private String poetName; // 诗人名称 (NameHZ)
}