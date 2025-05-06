import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from scipy.spatial import ConvexHull
import umap
from matplotlib.patches import Polygon
import mysql.connector
from scipy.interpolate import splprep, splev
import seaborn as sns
import argparse
from matplotlib.widgets import Button, CheckButtons
import matplotlib.patches as patches

# 设置中文字体显示
plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'database': 'lunwen',
    'charset': 'utf8mb4',
    'connect_timeout': 600,  # 连接超时时间设为10分钟
    'raise_on_warnings': True,  # 显示警告信息
    'use_pure': True  # 使用纯Python实现，避免C扩展可能的问题
}

# 情感映射字典
EMOTION_MAP = {
    '思': [1, 0, 0, 0, 0],
    '乐': [0, 1, 0, 0, 0],
    '哀': [0, 0, 1, 0, 0],
    '喜': [0, 0, 0, 1, 0],
    '怒': [0, 0, 0, 0, 1],
    '豪': [0, 0, 0, 0, 1],  # 怒/豪是同一个情感
    '怒/豪': [0, 0, 0, 0, 1]  # 直接添加怒/豪的映射
}

# 情感对应颜色字典
EMOTION_COLORS = {
    '思': [0.11, 0.65, 0.52, 1.0],  # 竹绿 #1ba784
    '乐': [0.95, 0.46, 0.21, 1.0],  # 蟹壳红 #f27635
    '哀': [0.08, 0.29, 0.45, 1.0],  # 鷃蓝 #144a74
    '喜': [0.93, 0.17, 0.39, 1.0],  # 喜蛋红 #ec2c64
    '怒': [0.51, 0.07, 0.12, 1.0],  # 殷红 #82111f
    '豪': [0.51, 0.07, 0.12, 1.0],  # 殷红 #82111f
    '怒/豪': [0.51, 0.07, 0.12, 1.0]  # 殷红 #82111f
}

def get_data_from_db():
    """从数据库获取情感数据"""
    try:
        print("正在连接数据库...")
        print(f"连接配置: {DB_CONFIG}")
        conn = mysql.connector.connect(**DB_CONFIG)
        print("数据库连接成功")
        
        cursor = conn.cursor()
        print("正在执行查询...")
        cursor.execute("SELECT COUNT(*) FROM emotion")  # 先获取数据总数
        total_count = cursor.fetchone()[0]
        print(f"emotion表中共有 {total_count} 条数据")
        
        print("正在获取情感数据...")
        cursor.execute("SELECT emotion FROM emotion")
        data = cursor.fetchall()
        print(f"成功获取到 {len(data)} 条数据")
        
        return [row[0] for row in data]
    except mysql.connector.Error as err:
        print(f"数据库错误: {err}")
        if err.errno == 2003:  # Can't connect to MySQL server
            print("无法连接到MySQL服务器，请检查：")
            print("1. MySQL服务是否正在运行")
            print("2. 主机名和端口是否正确")
            print("3. 防火墙设置是否允许连接")
        elif err.errno == 1045:  # Access denied
            print("访问被拒绝，请检查：")
            print("1. 用户名是否正确")
            print("2. 密码是否正确")
        elif err.errno == 1049:  # Unknown database
            print("数据库不存在，请检查：")
            print("1. 数据库名称是否正确")
            print("2. 数据库是否已创建")
        raise
    except Exception as e:
        print(f"发生未知错误: {e}")
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()
            print("数据库连接已关闭")

def convert_to_vector(emotion_str):
    """将情感字符串转换为5维向量，多情感时第一个情感权重更大"""
    if not emotion_str or pd.isna(emotion_str):
        return np.zeros(5)
    
    vector = np.zeros(5)
    # 同时支持中文逗号和英文逗号分割，并去除可能的空格
    emotions = [e.strip() for e in emotion_str.replace('，', ',').split(',')]
    
    # 打印调试信息
    print(f"处理情感字符串: {emotion_str}")
    print(f"分割后的情感列表: {emotions}")
    
    # 计算权重
    total_emotions = len(emotions)
    if total_emotions > 0:
        # 第一个情感权重为0.6，其余情感平均分配剩余权重
        first_weight = 0.6
        remaining_weight = (1 - first_weight) / (total_emotions - 1) if total_emotions > 1 else 1
        
        for i, emotion in enumerate(emotions):
            if emotion in EMOTION_MAP:
                # 第一个情感使用较大权重，其他情感使用剩余权重
                weight = first_weight if i == 0 else remaining_weight
                vector += np.array(EMOTION_MAP[emotion]) * weight
                print(f"情感 {emotion} 权重 {weight}: {np.array(EMOTION_MAP[emotion]) * weight}")
            else:
                # 尝试处理可能的"怒/豪"格式
                if '/' in emotion:
                    parts = emotion.split('/')
                    for part in parts:
                        if part in EMOTION_MAP:
                            weight = first_weight if i == 0 else remaining_weight
                            vector += np.array(EMOTION_MAP[part]) * weight
                            print(f"拆分情感 {part} 权重 {weight}: {np.array(EMOTION_MAP[part]) * weight}")
                else:
                    print(f"警告：未知情感 '{emotion}'")
    
    # 归一化向量
    vector_sum = np.sum(vector)
    if vector_sum > 0:
        vector = vector / vector_sum
        print(f"最终归一化向量: {vector}")
    else:
        print("警告：向量和为0")
    
    return vector

def reduce_dimensions(vectors, n_neighbors=5, min_dist=0.8, spread=3.0, scale=1.5, random_state=42):
    """使用UMAP进行降维，参数参考topic_clustering.py"""
    # 添加噪声以增加数据的可分性
    noise = np.random.normal(0, 0.01, vectors.shape)
    vectors_with_noise = vectors + noise
    
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,  # 较小的邻居数量使点更分散
        min_dist=min_dist,        # 较大的最小距离使点更分散
        spread=spread,            # 较大的spread参数使分布更均匀
        random_state=random_state
    )
    coords = reducer.fit_transform(vectors_with_noise)
    
    # 标准化并调整分散程度
    coords = (coords - coords.mean(axis=0)) / coords.std(axis=0)
    coords *= scale  # 缩放因子
    
    return coords

def create_smooth_boundary(points, expand_factor=1.5, padding=1.2, smoothness=0.3):
    """创建平滑的边界"""
    if len(points) < 4:
        return None
    
    # 计算质心
    centroid = np.mean(points, axis=0)
    
    # 计算到质心的最大距离
    max_dist = np.max(np.linalg.norm(points - centroid, axis=1))
    
    # 按角度排序点
    angles = np.arctan2(points[:, 1] - centroid[1], points[:, 0] - centroid[0])
    sorted_indices = np.argsort(angles)
    sorted_points = points[sorted_indices]
    sorted_points = np.vstack([sorted_points, sorted_points[0]])
    
    try:
        # 创建平滑曲线
        tck, u = splprep([sorted_points[:, 0], sorted_points[:, 1]], s=smoothness, per=True)
        u_new = np.linspace(0, 1, 200)  # 增加点数使边界更平滑
        smooth_boundary = np.column_stack(splev(u_new, tck))
        
        # 为边界添加不规则性
        noise = np.random.normal(0, 0.05, smooth_boundary.shape)
        smooth_boundary += noise
        
        # 扩大边界并添加padding
        normalized_vectors = smooth_boundary - centroid
        distances = np.linalg.norm(normalized_vectors, axis=1)
        normalized_vectors = normalized_vectors / distances[:, np.newaxis]
        boundary_distance = expand_factor * max_dist + padding
        smooth_boundary = centroid + boundary_distance * normalized_vectors
        
        return smooth_boundary
    except:
        return None

def plot_clusters(coords, labels, kmeans_centers, output_file='emotion1/emotion_clusters.png', 
                  boundary_alpha=0.15, point_size=35, point_alpha=0.8, 
                  jitter=0.02, color_scheme='Set2', expand_factor=1.5, padding=1.2, smoothness=0.3):
    """绘制聚类结果"""
    plt.figure(figsize=(16, 14))
    ax = plt.gca()
    
    # 设置背景样式
    ax.set_facecolor('#ffffff')
    plt.gcf().patch.set_facecolor('#ffffff')
    
    # 设置网格样式
    ax.grid(True, linestyle='--', alpha=0.2)
    
    # 选择颜色方案
    if color_scheme == 'Set2':
        colors = plt.cm.Set2(np.linspace(0, 1, len(np.unique(labels))))
    elif color_scheme == 'Set1':
        colors = plt.cm.Set1(np.linspace(0, 1, len(np.unique(labels))))
    elif color_scheme == 'Paired':
        colors = plt.cm.Paired(np.linspace(0, 1, len(np.unique(labels))))
    else:
        colors = plt.cm.tab10(np.linspace(0, 1, len(np.unique(labels))))
    
    # 获取唯一的标签
    unique_labels = np.unique(labels)
    
    # 计算每个聚类的大小并按大小排序
    cluster_sizes = [np.sum(labels == label) for label in unique_labels]
    size_order = np.argsort(cluster_sizes)[::-1]
    
    # 创建图例句柄和标签
    legend_handles = []
    legend_labels = []
    
    # 创建网格以计算背景色
    x_min, x_max = coords[:, 0].min() - 1, coords[:, 0].max() + 1
    y_min, y_max = coords[:, 1].min() - 1, coords[:, 1].max() + 1
    xx, yy = np.meshgrid(np.linspace(x_min, x_max, 300),
                        np.linspace(y_min, y_max, 300))
    grid_points = np.c_[xx.ravel(), yy.ravel()]
    
    # 计算每个网格点到各个聚类中心的距离
    background_colors = np.zeros((len(grid_points), 4))
    
    for idx in size_order:
        label = unique_labels[idx]
        mask = labels == label
        cluster_points = coords[mask]
        color = colors[idx]
        
        # 计算网格点到当前聚类点的最小距离
        distances = np.min(np.linalg.norm(grid_points[:, np.newaxis] - cluster_points, axis=2), axis=1)
        
        # 使用高斯核计算权重
        sigma = 0.8
        weights = np.exp(-distances**2 / (2 * sigma**2))
        weights = weights.reshape(-1, 1)
        
        # 累积颜色
        background_colors += weights * color
    
    # 归一化背景色
    background_colors = background_colors / np.maximum(background_colors.sum(axis=1)[:, np.newaxis], 1)
    background_colors[:, 3] = boundary_alpha  # 设置透明度
    
    # 绘制背景
    background = ax.imshow(
        background_colors.reshape(xx.shape[0], xx.shape[1], 4),
        extent=[x_min, x_max, y_min, y_max],
        origin='lower',
        aspect='auto',
        interpolation='gaussian',
        zorder=1
    )
    
    # 绘制点
    for idx in size_order:
        label = unique_labels[idx]
        mask = labels == label
        cluster_points = coords[mask]
        color = colors[idx]
        
        # 为每个点添加随机偏移以减少重叠
        jittered_points = cluster_points + np.random.normal(0, jitter, cluster_points.shape)
        
        # 绘制散点
        scatter = ax.scatter(
            jittered_points[:, 0],
            jittered_points[:, 1],
            color=color,
            marker='o',
            alpha=point_alpha,
            s=point_size,
            edgecolor='white',
            linewidth=0.5,
            zorder=3
        )
        
        # 添加到图例
        legend_handles.append(scatter)
        legend_labels.append(f'情感聚类 {label} ({len(cluster_points)}首)')
    
    plt.title('诗词情感聚类分布图', fontsize=20, pad=20)
    plt.xlabel('UMAP特征1', fontsize=16)
    plt.ylabel('UMAP特征2', fontsize=16)
    
    # 添加图例
    plt.legend(legend_handles, legend_labels, bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=14)
    
    # 调整布局
    plt.tight_layout()
    
    # 保存图片
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"已保存聚类图到: {output_file}")

def get_emotion_color(emotion_str):
    """获取情感对应的颜色，多情感时混合颜色"""
    if not emotion_str or pd.isna(emotion_str):
        return [0.5, 0.5, 0.5, 1.0]  # 灰色作为默认颜色
    
    # 同时支持中文逗号和英文逗号分割
    emotions = [e.strip() for e in emotion_str.replace('，', ',').split(',')]
    
    color = np.zeros(4)
    total_weight = 0
    
    # 第一个情感权重为0.6，其余情感平均分配剩余权重
    if len(emotions) > 0:
        first_weight = 0.6
        remaining_weight = (1 - first_weight) / (len(emotions) - 1) if len(emotions) > 1 else 1
        
        for i, emotion in enumerate(emotions):
            weight = first_weight if i == 0 else remaining_weight
            
            if emotion in EMOTION_COLORS:
                color += np.array(EMOTION_COLORS[emotion]) * weight
                total_weight += weight
            elif '/' in emotion:
                parts = emotion.split('/')
                for part in parts:
                    if part in EMOTION_COLORS:
                        # 对于"怒/豪"这种情况，只添加一次颜色
                        color += np.array(EMOTION_COLORS[part]) * weight
                        total_weight += weight
                        break
    
    # 确保颜色有效
    if total_weight > 0:
        color = color / total_weight
    else:
        color = np.array([0.5, 0.5, 0.5, 1.0])  # 默认灰色
    
    return color

def create_interactive_plot(coords, labels, emotions, vectors, output_file='emotion1/emotion_clusters.png', emotion_label_map=None):
    """创建交互式散点图"""
    fig = plt.figure(figsize=(16, 14))
    ax = plt.gca()
    
    # 设置背景样式
    ax.set_facecolor('#ffffff')
    plt.gcf().patch.set_facecolor('#ffffff')
    
    # 设置网格样式
    ax.grid(True, linestyle='--', alpha=0.2)
    
    # 为每个点计算颜色
    point_colors = np.array([get_emotion_color(emotion) for emotion in emotions])
    
    # 获取唯一的标签
    unique_labels = np.unique(labels)
    
    # 创建情感标签的反向映射
    if emotion_label_map is None:
        reverse_map = {i: f"类别{i}" for i in unique_labels}
    else:
        reverse_map = {v: k for k, v in emotion_label_map.items()}
    
    # 计算每个聚类的大小并按大小排序
    cluster_sizes = [np.sum(labels == label) for label in unique_labels]
    size_order = np.argsort(cluster_sizes)[::-1]
    
    # 创建图例句柄和标签
    legend_handles = []
    legend_labels = []
    
    # 添加基本情感的图例
    for emotion, color in EMOTION_COLORS.items():
        if emotion not in ['豪', '怒/豪']:  # 避免重复添加
            legend_handles.append(plt.Line2D([0], [0], marker='o', color='w', 
                                            markerfacecolor=color, markersize=10))
            legend_labels.append(f'情感: {emotion}')
    
    # 创建散点图
    scatter_plots = []
    for idx, label in enumerate(unique_labels):
        mask = labels == label
        cluster_points = coords[mask]
        cluster_colors = point_colors[mask]
        
        # 为每个点添加随机偏移以减少重叠
        jittered_points = cluster_points + np.random.normal(0, 0.02, cluster_points.shape)
        
        # 绘制散点
        scatter = ax.scatter(
            jittered_points[:, 0],
            jittered_points[:, 1],
            color=cluster_colors,
            marker='o',
            alpha=0.8,
            s=35,
            edgecolor='white',
            linewidth=0.5,
            zorder=3
        )
        scatter_plots.append(scatter)
        
        # 添加到聚类图例
        avg_color = np.mean(cluster_colors, axis=0)
        emotion_name = reverse_map.get(label, f"类别{label}")
        legend_handles.append(plt.Line2D([0], [0], marker='o', color='w', 
                                     markerfacecolor=avg_color, markersize=10, alpha=0.8))
        legend_labels.append(f'情感 {emotion_name} ({len(cluster_points)}首)')
    
    # 创建复选框
    checkbox_ax = plt.axes([0.02, 0.02, 0.2, 0.2])
    checkbox_labels = [reverse_map.get(label, f"类别{label}") for label in unique_labels]
    checkbox = CheckButtons(checkbox_ax, checkbox_labels, [True] * len(unique_labels))
    
    # 创建数据查看文本框
    text_ax = plt.axes([0.8, 0.02, 0.18, 0.2])
    text_ax.set_facecolor('white')
    text_ax.set_xticks([])
    text_ax.set_yticks([])
    text_box = text_ax.text(0.5, 0.5, '', ha='center', va='center', wrap=True)
    
    # 存储原始数据
    scatter_data = {
        'coords': coords,
        'labels': labels,
        'emotions': emotions,
        'vectors': vectors,
        'reverse_map': reverse_map
    }
    
    def update_visibility(label):
        """更新散点图的可见性"""
        idx = checkbox_labels.index(label)
        label_value = unique_labels[idx]
        for i, l in enumerate(unique_labels):
            if l == label_value:
                scatter_plots[i].set_visible(not scatter_plots[i].get_visible())
                break
        plt.draw()
    
    def on_click(event):
        """处理点击事件"""
        if event.inaxes == ax:
            # 计算点击位置到所有点的距离
            distances = np.sqrt(np.sum((coords - np.array([event.xdata, event.ydata]))**2, axis=1))
            closest_idx = np.argmin(distances)
            
            # 更新文本框内容
            emotion = emotions[closest_idx]
            vector = vectors[closest_idx]
            label = labels[closest_idx]
            emotion_name = reverse_map.get(label, f"类别{label}")
            
            text = f'情感: {emotion}\n'
            text += f'向量: [{", ".join([f"{v:.2f}" for v in vector])}]\n'
            text += f'类别: {emotion_name}'
            text_box.set_text(text)
            plt.draw()
    
    # 绑定事件
    checkbox.on_clicked(update_visibility)
    fig.canvas.mpl_connect('button_press_event', on_click)
    
    plt.title('诗词情感聚类分布图', fontsize=20, pad=20)
    plt.xlabel('UMAP特征1', fontsize=16)
    plt.ylabel('UMAP特征2', fontsize=16)
    
    # 添加图例
    plt.legend(legend_handles, legend_labels, bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=14)
    
    # 调整布局
    plt.tight_layout()
    
    # 保存图片
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"已保存交互式聚类图到: {output_file}")
    
    # 显示图形
    plt.show()

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='诗词情感聚类可视化工具')
    
    # UMAP参数
    parser.add_argument('--n_neighbors', type=int, default=5, help='UMAP的邻居数量，较小的值使聚类更分散')
    parser.add_argument('--min_dist', type=float, default=0.8, help='UMAP的最小距离，较大的值使点之间距离更大')
    parser.add_argument('--spread', type=float, default=3.0, help='UMAP的spread参数，较大的值使分布更分散')
    parser.add_argument('--scale', type=float, default=1.5, help='坐标缩放因子，较大的值使整体分布更大')
    
    # 聚类参数
    parser.add_argument('--n_clusters', type=int, default=5, help='聚类数量')
    
    # 点的参数
    parser.add_argument('--point_size', type=float, default=35, help='点的大小')
    parser.add_argument('--point_alpha', type=float, default=0.8, help='点的透明度')
    parser.add_argument('--jitter', type=float, default=0.02, help='点的抖动程度，用于减少重叠')
    parser.add_argument('--boundary_alpha', type=float, default=0.15, help='边界透明度')
    
    # 边界参数
    parser.add_argument('--expand_factor', type=float, default=1.5, help='边界扩展因子')
    parser.add_argument('--padding', type=float, default=1.2, help='边界padding大小')
    parser.add_argument('--smoothness', type=float, default=0.3, help='边界平滑度')
    
    # 颜色方案
    parser.add_argument('--color_scheme', type=str, default='Set2', 
                        choices=['tab10', 'Set1', 'Set2', 'Paired'], 
                        help='颜色方案')
    
    # 输出文件
    parser.add_argument('--output', type=str, default='emotion1/emotion_clusters.png', help='输出文件路径')
    
    return parser.parse_args()

def save_results_to_db(coords, labels, emotions, vectors):
    """保存处理结果到数据库"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 创建新表来存储降维和聚类结果
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emotion_visualization (
                id INT AUTO_INCREMENT PRIMARY KEY,
                original_emotion VARCHAR(255),
                vector_dim1 FLOAT,
                vector_dim2 FLOAT,
                vector_dim3 FLOAT,
                vector_dim4 FLOAT,
                vector_dim5 FLOAT,
                umap_x FLOAT,
                umap_y FLOAT,
                cluster_label INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 准备插入数据
        insert_query = """
            INSERT INTO emotion_visualization 
            (original_emotion, vector_dim1, vector_dim2, vector_dim3, vector_dim4, vector_dim5, 
             umap_x, umap_y, cluster_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # 构建数据
        data_to_insert = []
        for i in range(len(emotions)):
            data_to_insert.append((
                emotions[i],
                float(vectors[i][0]),
                float(vectors[i][1]),
                float(vectors[i][2]),
                float(vectors[i][3]),
                float(vectors[i][4]),
                float(coords[i][0]),
                float(coords[i][1]),
                int(labels[i])
            ))
        
        # 分批插入数据，每批1000条
        batch_size = 1000
        total_batches = (len(data_to_insert) + batch_size - 1) // batch_size
        
        for i in range(0, len(data_to_insert), batch_size):
            batch = data_to_insert[i:i + batch_size]
            try:
                cursor.executemany(insert_query, batch)
                conn.commit()
                print(f"已插入第 {i//batch_size + 1}/{total_batches} 批数据，共 {len(batch)} 条")
            except Exception as e:
                print(f"插入第 {i//batch_size + 1} 批数据时出错: {str(e)}")
                conn.rollback()
                raise e
        
        print(f"成功将{len(data_to_insert)}条处理结果保存到数据库。")
        
    except Exception as e:
        print(f"数据库操作出错: {str(e)}")
        raise e
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def classify_by_emotion(emotions):
    """根据主要情感为每个样本分配标签"""
    labels = []
    main_emotions = set()
    
    for emotion_str in emotions:
        if not emotion_str or pd.isna(emotion_str):
            main_emotion = "未知"
        else:
            # 获取第一个情感作为主要情感
            main_emotion = emotion_str.replace('，', ',').split(',')[0].strip()
            
            # 处理特殊情况
            if '/' in main_emotion:
                # 处理"怒/豪"类情况
                main_emotion = "怒/豪"
            
        main_emotions.add(main_emotion)
        labels.append(main_emotion)
    
    # 将字符串标签转换为数字标签
    emotion_to_label = {emotion: i for i, emotion in enumerate(sorted(main_emotions))}
    numeric_labels = [emotion_to_label[emotion] for emotion in labels]
    
    print(f"情感分类映射: {emotion_to_label}")
    print(f"共识别出 {len(main_emotions)} 种主要情感类别")
    
    return np.array(numeric_labels), emotion_to_label

def main():
    # 解析命令行参数
    args = parse_args()
    
    print("正在从数据库获取数据...")
    emotions = get_data_from_db()
    
    print("正在转换情感数据为向量...")
    vectors = np.array([convert_to_vector(e) for e in emotions])
    
    print("正在进行降维...")
    coords = reduce_dimensions(
        vectors, 
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        spread=args.spread,
        scale=args.scale
    )
    
    print("正在根据情感内容进行分类...")
    labels, emotion_label_map = classify_by_emotion(emotions)
    
    # 不再使用KMeans聚类
    # print("正在进行聚类...")
    # kmeans = KMeans(
    #     n_clusters=args.n_clusters, 
    #     random_state=42,
    #     n_init=50,
    #     max_iter=1000
    # )
    # labels = kmeans.fit_predict(coords)
    
    # 保存结果到数据库
    print("正在保存结果到数据库...")
    save_results_to_db(coords, labels, emotions, vectors)
    
    # 计算每个情感类别的中心点
    centers = []
    for label in np.unique(labels):
        mask = labels == label
        if np.sum(mask) > 0:
            centers.append(np.mean(coords[mask], axis=0))
    centers = np.array(centers)
    
    # 后处理：增加聚类中心之间的距离
    center_distances = []
    for i in range(len(centers)):
        for j in range(i+1, len(centers)):
            center_distances.append(np.linalg.norm(centers[i] - centers[j]))
    
    avg_distance = np.mean(center_distances) if center_distances else 0
    
    # 如果中心点距离太近，增加它们之间的距离
    if avg_distance > 0:
        for i in range(len(centers)):
            direction = np.zeros(2)
            for j in range(len(centers)):
                if i != j:
                    vec = centers[i] - centers[j]
                    dist = np.linalg.norm(vec)
                    if dist > 0:
                        direction += vec / dist * (1.0 / dist)
            
            if np.linalg.norm(direction) > 0:
                centers[i] += direction * 0.8
    
    print("正在生成交互式可视化...")
    create_interactive_plot(
        coords, 
        labels, 
        emotions, 
        vectors,
        output_file=args.output,
        emotion_label_map=emotion_label_map
    )
    
    # 打印各类别的情感信息
    reverse_map = {v: k for k, v in emotion_label_map.items()}
    for label in np.unique(labels):
        count = np.sum(labels == label)
        emotion_name = reverse_map.get(label, f"类别{label}")
        print(f"情感类别 {emotion_name}：包含 {count} 首诗")
    
    print(f"处理完成！共处理了{len(vectors)}首诗的情感分布。")

if __name__ == "__main__":
    main() 