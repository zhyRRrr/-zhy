package com.nanometer.utils;

import org.apache.commons.math3.linear.MatrixUtils;
import org.apache.commons.math3.linear.RealMatrix;

public class MinMaxScaler {
    private double[] mins;
    private double[] maxs;
    private final double targetMin;
    private final double targetMax;

    public MinMaxScaler(double targetMin, double targetMax) {
        this.targetMin = targetMin;
        this.targetMax = targetMax;
    }

    public double[][] fitTransform(double[][] data) {
        RealMatrix matrix = MatrixUtils.createRealMatrix(data);
        mins = new double[matrix.getColumnDimension()];
        maxs = new double[matrix.getColumnDimension()];
        
        // 计算每列的最小最大值
        for (int i = 0; i < matrix.getColumnDimension(); i++) {
            mins[i] = matrix.getColumnVector(i).getMinValue();
            maxs[i] = matrix.getColumnVector(i).getMaxValue();
        }
        
        return transform(matrix).getData();
    }

    private RealMatrix transform(RealMatrix matrix) {
        RealMatrix transformed = matrix.copy();
        for (int i = 0; i < matrix.getRowDimension(); i++) {
            for (int j = 0; j < matrix.getColumnDimension(); j++) {
                if (maxs[j] != mins[j]) {
                    double normalized = (matrix.getEntry(i, j) - mins[j]) / (maxs[j] - mins[j]);
                    transformed.setEntry(i, j, normalized * (targetMax - targetMin) + targetMin);
                }
            }
        }
        return transformed;
    }
}