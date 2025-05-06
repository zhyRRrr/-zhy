package com.nanometer.utils;

import org.apache.commons.math3.linear.MatrixUtils;
import org.apache.commons.math3.linear.RealMatrix;
import org.apache.commons.math3.linear.SingularValueDecomposition;

public class PCA {
    private final RealMatrix data;
    private final int targetDimension;
    private double varianceThreshold = 0.95;

    public PCA(double[][] data, int targetDimension) {
        this.data = MatrixUtils.createRealMatrix(data);
        this.targetDimension = targetDimension;
    }

    public void setVarianceThreshold(double threshold) {
        this.varianceThreshold = threshold;
    }

    public double[][] reduceDimension() {
        // 数据标准化
        RealMatrix centeredData = centerData();
        
        // 计算协方差矩阵
        RealMatrix covarianceMatrix = centeredData.transpose().multiply(centeredData)
                .scalarMultiply(1.0 / (centeredData.getRowDimension() - 1));
        
        // 执行SVD
        SingularValueDecomposition svd = new SingularValueDecomposition(covarianceMatrix);
        
        // 计算累计方差贡献率
        double[] singularValues = svd.getSingularValues();
        double totalVariance = 0.0;
        for (double s : singularValues) {
            totalVariance += s;
        }
        
        // 确定保留的主成分数量
        int components = 1;
        double currentVariance = singularValues[0] / totalVariance;
        while (currentVariance < varianceThreshold && components < singularValues.length) {
            currentVariance += singularValues[components] / totalVariance;
            components++;
        }
        components = Math.min(components, targetDimension);
        
        // 提取主成分
        RealMatrix componentsMatrix = svd.getV().getSubMatrix(0, singularValues.length-1, 0, components-1);
        
        // 投影到新空间
        return centeredData.multiply(componentsMatrix).getData();
    }

    private RealMatrix centerData() {
        // 计算每列的均值
        double[] means = new double[data.getColumnDimension()];
        for (int i = 0; i < data.getColumnDimension(); i++) {
            means[i] = data.getColumnVector(i).getL1Norm() / data.getRowDimension();
        }
        
        // 中心化数据
        RealMatrix centered = data.copy();
        for (int i = 0; i < data.getRowDimension(); i++) {
            for (int j = 0; j < data.getColumnDimension(); j++) {
                centered.setEntry(i, j, data.getEntry(i, j) - means[j]);
            }
        }
        return centered;
    }
}