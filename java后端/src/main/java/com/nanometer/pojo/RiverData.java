

package com.nanometer.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiverData {
    private Integer year;
    private String poetId;
    private String poetName;
    private String topic;
    private String emotion;
    private Integer value;
}