package com.nanometer.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiverDataKey {
    private int year;
    private String poetId;
    private String poetName;
    private String topic;
    private String emotion;

    // 需要重写equals和hashCode方法，以确保根据属性值正确判断相等性和计算哈希值
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass()!= o.getClass()) return false;
        RiverDataKey that = (RiverDataKey) o;
        return year == that.year &&
                poetId.equals(that.poetId) &&
                poetName.equals(that.poetName) &&
                topic.equals(that.topic) &&
                emotion.equals(that.emotion);
    }

    @Override
    public int hashCode() {
        int result = year;
        result = 31 * result + poetId.hashCode();
        result = 31 * result + poetName.hashCode();
        result = 31 * result + topic.hashCode();
        result = 31 * result + emotion.hashCode();
        return result;
    }
}
