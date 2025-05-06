// 根据生命阶段返回对应的颜色
export const getColorByStage = (stage) => {
    const colorMap = {
        stage_child: '#91d5ff', // 少年期 - 浅蓝色
        stage_youth: '#52c41a', // 青年期 - 绿色
        stage_prime: '#fa8c16', // 壮年期 - 橙色
        stage_middle: '#722ed1', // 中年期 - 紫色
        stage_elder: '#f5222d' // 晚年期 - 红色
    }

    return colorMap[stage] || '#1890ff'
}

// 角度转弧度辅助函数
export const radians = (degrees) => {
    return (degrees * Math.PI) / 180
}

// 计算两个角度区间的重叠度
export const calculateOverlap = (a1, a2, b1, b2) => {
    // 确保起始角度小于结束角度
    const start1 = a1 % 360;
    const end1 = a2 % 360;
    const start2 = b1 % 360;
    const end2 = b2 % 360;

    // 计算重叠部分
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    return Math.max(0, overlapEnd - overlapStart);
}

// 特殊处理 - 为不同的角度区间分配不同的首选半径层
export const getPreferredSegmentForAngle = (angle) => {
    // 将圆分为6个扇区，每个扇区有偏好的半径层
    const sector = Math.floor(angle / 60);
    // 按扇区返回偏好层，增加更多的层次选择
    const preferredSegments = [
        [4, 8, 12, 16, 2], // 0-60度扇区偏好的层
        [6, 10, 14, 18, 3], // 60-120度扇区偏好的层
        [5, 9, 13, 17, 1], // 120-180度扇区偏好的层
        [7, 11, 15, 19, 2], // 180-240度扇区偏好的层
        [3, 7, 11, 15, 0], // 240-300度扇区偏好的层
        [5, 9, 13, 17, 1]  // 300-360度扇区偏好的层
    ];
    return preferredSegments[sector];
} 