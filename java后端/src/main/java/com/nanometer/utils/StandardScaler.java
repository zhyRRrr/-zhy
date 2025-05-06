package com.nanometer.utils;

import org.apache.commons.math3.linear.MatrixUtils;
import org.apache.commons.math3.linear.RealMatrix;
import org.apache.commons.math3.stat.descriptive.moment.Variance;

public class StandardScaler {
    private double[] means;
    private double[] stds;

    public double[][] fitTransform(double[][] data) {
        RealMatrix matrix = MatrixUtils.createRealMatrix(data);
        means = new double[matrix.getColumnDimension()];
        stds = new double[matrix.getColumnDimension()];
        Variance variance = new Variance();
        
        // 手动计算均值和方差
        for (int i = 0; i < matrix.getColumnDimension(); i++) {
            double[] column = matrix.getColumn(i);
            means[i] = calculateMean(column);
            stds[i] = Math.sqrt(variance.evaluate(column, means[i]));
        }
        
        return transform(matrix).getData();
    }

    private double calculateMean(double[] data) {
        double sum = 0.0;
        for (double d : data) {
            sum += d;
        }
        return sum / data.length;
    }

    private RealMatrix transform(RealMatrix matrix) {
        RealMatrix transformed = matrix.copy();
        for (int i = 0; i < matrix.getRowDimension(); i++) {
            for (int j = 0; j < matrix.getColumnDimension(); j++) {
                if (stds[j] != 0) {
                    transformed.setEntry(i, j, (matrix.getEntry(i, j) - means[j]) / stds[j]);
                }
            }
        }
        return transformed;
    }
}