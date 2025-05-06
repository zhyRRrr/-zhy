import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import hdbscan
from scipy.spatial import ConvexHull
import umap
from matplotlib.patches import Polygon, PathPatch
import matplotlib.path as mpath
from matplotlib.collections import PatchCollection
import matplotlib.cm as cm
import matplotlib.colors as mcolors
import seaborn as sns
from scipy.interpolate import splprep, splev
import mysql.connector
import argparse
from matplotlib.widgets import Button, CheckButtons
import json

# 设置中文字体显示
plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号
# python processdata/lda_visualization/topic_clustering.py --input="D:/01/lunwen/processdata/lda02_topics_with_probabilities.csv" --output="lda02_hdbscan.png" --min_cluster_size 80 --min_samples 10 --cluster_selection_epsilon 0.5 --point_size 15 --point_alpha 0.7
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

# 读取topics_probabilities.csv文件
def read_topic_csv(file_path):
    try:
        df = pd.read_csv(file_path)
        print(f"成功读取文件：{file_path}")
        print(f"数据列名：{df.columns.tolist()}")
        print(f"读取到的数据条数：{len(df)}")
        # 检查是否包含所需的列
        required_columns = ['poemId', 'allTopics', 'allProbabilities', 'topics', 'topicWords', 'topicProbabilities']
        for col in required_columns:
            if col not in df.columns:
                print(f"警告：输入文件中缺少必要的列 '{col}'")
        return df
    except Exception as e:
        print(f"读取文件时出错：{str(e)}")
        raise

# 将主题概率转换为向量
def convert_to_vector(all_probabilities_str, num_topics=4):
    if pd.isna(all_probabilities_str):
        return [0] * num_topics
    
    try:
        # 解析概率字符串为数值列表
        # 字符串格式类似 "0.1,0.2,0.05,0.3"（逗号分隔的浮点数）
        probabilities = [float(p) for p in all_probabilities_str.split(',')]
        
        # 确保向量长度为num_topics
        if len(probabilities) < num_topics:
            probabilities.extend([0] * (num_topics - len(probabilities)))
        elif len(probabilities) > num_topics:
            probabilities = probabilities[:num_topics]
            
        return probabilities
    except Exception as e:
        print(f"转换概率向量时出错：{str(e)}，原始字符串：{all_probabilities_str}")
        # 如果解析失败，返回零向量
        return [0] * num_topics

# 使用多种降维方法并结合它们的结果
def reduce_dimensions(vectors, n_components=2, perplexity=30, random_state=42, n_neighbors=20, min_dist=0.5, spread=1.2, scale=1.0):
    # 添加微小的噪声以增加数据的可分性，但减少噪声量
    noise = np.random.normal(0, 0.01, vectors.shape)  # 减少噪声
    vectors_with_noise = vectors + noise
    
    # 应用主题权重增强，让主导主题更显著
    enhanced_vectors = vectors_with_noise.copy()
    for i in range(len(enhanced_vectors)):
        # 找出每行的最大值（主导主题）
        max_idx = np.argmax(enhanced_vectors[i])
        # 增强主导主题的权重
        enhanced_vectors[i, max_idx] *= 1.5
        # 重新归一化
        if np.sum(enhanced_vectors[i]) > 0:
            enhanced_vectors[i] = enhanced_vectors[i] / np.sum(enhanced_vectors[i])
    
    # 首先用PCA进行初始降维，减少噪声影响
    pca = PCA(n_components=min(vectors.shape[1], 4))
    pca_result = pca.fit_transform(enhanced_vectors)
    
    # UMAP降维 - 使用参数使点更加分散均匀
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,  # 使用较大的邻居数，增强全局结构保留
        min_dist=min_dist,        # 适中的最小距离
        spread=spread,            # 适当的spread
        random_state=random_state,
        metric='euclidean',       # 使用欧氏距离作为度量
        low_memory=False,         # 不使用低内存模式以获得更好的结果
        repulsion_strength=2.0    # 增加排斥强度，使点更分散
    )
    umap_result = reducer.fit_transform(pca_result)
    
    # 标准化UMAP结果
    umap_result = (umap_result - umap_result.mean(axis=0)) / umap_result.std(axis=0)
    umap_result *= scale
    
    # 添加更小的随机抖动，保持聚类结构但减少重叠
    final_jitter = np.random.normal(0, 0.02, umap_result.shape)
    umap_result += final_jitter
    
    return umap_result

# 使用HDBSCAN进行聚类，更能发现自然形状的聚类
def cluster_points(points, min_cluster_size=50, min_samples=10, cluster_selection_epsilon=0.5):
    """使用HDBSCAN进行聚类，更好地发现自然结构"""
    print(f"使用HDBSCAN聚类，参数: min_cluster_size={min_cluster_size}, min_samples={min_samples}, epsilon={cluster_selection_epsilon}")
    
    try:
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            cluster_selection_epsilon=cluster_selection_epsilon,
            gen_min_span_tree=True,
            prediction_data=True
        )
        cluster_labels = clusterer.fit_predict(points)
        
        # 获取聚类数量和噪声点数量
        n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
        n_noise = list(cluster_labels).count(-1)
        
        print(f"HDBSCAN聚类结果: 发现 {n_clusters} 个聚类, {n_noise} 个噪声点 ({n_noise/len(points)*100:.2f}%)")
        
        # 如果噪声点太多，尝试调整参数
        if n_noise / len(points) > 0.3:  # 如果噪声点超过30%
            print("警告: 噪声点比例过高，尝试调整HDBSCAN参数")
            
            # 调整参数重新聚类
            new_min_cluster_size = max(20, min_cluster_size // 2)
            new_min_samples = max(5, min_samples // 2)
            new_epsilon = cluster_selection_epsilon * 1.5
            
            print(f"重新聚类，参数: min_cluster_size={new_min_cluster_size}, min_samples={new_min_samples}, epsilon={new_epsilon}")
            
            clusterer = hdbscan.HDBSCAN(
                min_cluster_size=new_min_cluster_size,
                min_samples=new_min_samples,
                cluster_selection_epsilon=new_epsilon,
                gen_min_span_tree=True,
                prediction_data=True
            )
            cluster_labels = clusterer.fit_predict(points)
            
            # 再次检查聚类数量和噪声点数量
            n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
            n_noise = list(cluster_labels).count(-1)
            print(f"调整后聚类结果: 发现 {n_clusters} 个聚类, {n_noise} 个噪声点 ({n_noise/len(points)*100:.2f}%)")
        
        return cluster_labels, clusterer
    
    except Exception as e:
        print(f"HDBSCAN聚类失败: {str(e)}，回退到K-means")
        # 如果HDBSCAN失败，回退到K-means
        kmeans = KMeans(n_clusters=6, random_state=42)
        cluster_labels = kmeans.fit_predict(points)
        return cluster_labels, None

# 创建平滑的边界曲线
def create_smooth_boundary(points, expand_factor=0.4, padding=0.2, smoothness=0.6):
    """创建更平滑的边界曲线"""
    if len(points) < 4:
        return None
    
    # 计算质心
    centroid = np.mean(points, axis=0)
    
    # 计算到质心的最大距离
    max_dist = np.max(np.linalg.norm(points - centroid, axis=1))
    
    # 按照与质心的角度排序点
    angles = np.arctan2(points[:, 1] - centroid[1], points[:, 0] - centroid[0])
    sorted_indices = np.argsort(angles)
    sorted_points = points[sorted_indices]
    
    # 添加首尾点以确保闭合
    sorted_points = np.vstack([sorted_points, sorted_points[0]])
    
    try:
        # 使用样条插值创建平滑曲线，增加平滑度
        tck, u = splprep([sorted_points[:, 0], sorted_points[:, 1]], s=smoothness, per=True)
        # 生成更多的点使曲线更平滑
        u_new = np.linspace(0, 1, 200)
        smooth_boundary = np.column_stack(splev(u_new, tck))
        
        # 为边界添加微小的不规则性
        noise = np.random.normal(0, 0.03, smooth_boundary.shape)
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

# 根据主题概率获取点的颜色
def get_topic_color(probabilities, topic_color_map):
    """基于主题概率获取点的颜色，使用概率加权混合"""
    if np.sum(probabilities) == 0:
        return np.array([0.5, 0.5, 0.5, 1.0])  # 灰色作为默认颜色
    
    # 归一化概率确保总和为1
    normalized_probs = np.array(probabilities) / np.sum(probabilities)
    
    # 使用概率加权混合颜色
    color = np.zeros(4)  # RGBA颜色
    for i, prob in enumerate(normalized_probs):
        if i < len(topic_color_map):
            color += prob * topic_color_map[i]
    
    # 确保颜色有效
    color[:3] = np.clip(color[:3], 0, 1)
    color[3] = 1.0  # 固定不透明度为1
    
    return color

def save_results_to_db(coords, labels, poems_data, vectors):
    """保存处理结果到数据库"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 创建新表来存储降维和聚类结果
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topic_visualization (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poem_id INT,
                original_topics TEXT,
                topic_words TEXT,
                vector_json TEXT,
                umap_x FLOAT,
                umap_y FLOAT,
                cluster_label INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 准备插入数据
        insert_query = """
            INSERT INTO topic_visualization 
            (poem_id, original_topics, topic_words, vector_json, umap_x, umap_y, cluster_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        # 构建数据
        data_to_insert = []
        for i in range(len(poems_data['poemId'])):
            # 将向量转换为JSON字符串
            vector_json = json.dumps(vectors[i].tolist())
            
            poem_id = poems_data['poemId'].iloc[i] if not pd.isna(poems_data['poemId'].iloc[i]) else 0
            original_topics = str(poems_data['allTopics'].iloc[i]) if not pd.isna(poems_data['allTopics'].iloc[i]) else ""
            topic_words = str(poems_data['topicWords'].iloc[i]) if not pd.isna(poems_data['topicWords'].iloc[i]) else ""
            
            data_to_insert.append((
                int(poem_id),
                original_topics,
                topic_words,
                vector_json,
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

def create_interactive_plot(coords, labels, df, vectors, output_file='topic_clusters_interactive.png',
                          point_size=15, point_alpha=0.7, jitter=0.01, boundary_alpha=0.04, 
                          expand_factor=0.4, padding=0.2, smoothness=0.6, color_scheme='Set1',
                          use_topic_colors=True):
    """创建交互式散点图，使用DataFrame中的数据"""
    fig = plt.figure(figsize=(16, 14))
    ax = plt.gca()
    
    # 设置背景样式
    ax.set_facecolor('#ffffff')
    plt.gcf().patch.set_facecolor('#ffffff')
    
    # 设置网格样式
    ax.grid(True, linestyle='--', alpha=0.2)
    
    # 获取唯一的标签
    unique_labels = np.unique(labels)
    if -1 in unique_labels:  # 处理HDBSCAN中的噪声点
        unique_labels = np.array([l for l in unique_labels if l != -1])
    
    # 主题颜色设置 - 修改为4个主题
    num_topics = 4  # 主题数量修改为4
    
    # 选择颜色方案
    if color_scheme == 'Set1':
        color_palette = plt.cm.Set1(np.linspace(0, 1, num_topics))
    elif color_scheme == 'Set2':
        color_palette = plt.cm.Set2(np.linspace(0, 1, num_topics))
    elif color_scheme == 'Paired':
        color_palette = plt.cm.Paired(np.linspace(0, 1, num_topics))
    else:  # 默认tab10
        color_palette = plt.cm.tab10(np.linspace(0, 1, num_topics))
    
    # 自定义主题3的颜色（主题索引为3，对应第4个主题）
    custom_colors = color_palette.copy()
    custom_colors[3] = np.array([0.8, 0.2, 0.6, 1.0])  # 紫红色，RGBA格式
    color_palette = custom_colors
    
    # 为聚类准备颜色
    cluster_colors = plt.cm.nipy_spectral(np.linspace(0, 1, len(unique_labels)+1))
    
    # 创建图例句柄和标签
    legend_handles = []
    legend_labels = []
    
    # 为每个主题准备图例
    for i in range(num_topics):
        legend_handles.append(plt.Line2D([0], [0], marker='o', color='w', 
                                      markerfacecolor=color_palette[i], markersize=10))
        legend_labels.append(f'主题: {i}')
    
    # 创建散点图，使用主题概率来确定点的颜色
    scatter_plots = []
    # 存储原始点颜色
    original_colors = {}
    
    if use_topic_colors:
        # 为不同的主题创建单独的散点图，以便可以独立控制显示/隐藏
        topic_masks = []
        
        # 确定每个点主要属于哪个主题
        dominant_topics = np.argmax(vectors, axis=1)
        
        # 为每个主题创建单独的散点图
        for topic_idx in range(num_topics):
            # 找出主导主题是当前主题的所有点
            mask = dominant_topics == topic_idx
            topic_masks.append(mask)
            
            if np.sum(mask) > 0:  # 如果有点属于该主题
                # 获取该主题的点
                topic_points = coords[mask]
                
                # 应用抖动 - 增加抖动以获得更分散的效果
                jittered_points = topic_points + np.random.normal(0, jitter*2, topic_points.shape)
                
                # 为所有点指定相同的颜色 - 使用对应主题的颜色
                color = color_palette[topic_idx]
                
                # 绘制该主题的散点图
                scatter = ax.scatter(
                    jittered_points[:, 0],
                    jittered_points[:, 1],
                    color=color,
                    marker='o',
                    alpha=point_alpha,
                    s=point_size,
                    edgecolor='none',  # 移除边框
                    linewidth=0,
                    zorder=3,
                    label=f'主题 {topic_idx}'
                )
                scatter_plots.append(scatter)
                # 存储原始颜色
                original_colors[topic_idx] = color
            else:
                # 如果没有点，仍然创建一个空的散点图，以保持索引对应
                scatter = ax.scatter([], [], color=color_palette[topic_idx])
                scatter_plots.append(scatter)
                original_colors[topic_idx] = color_palette[topic_idx]
    else:
        # 使用聚类标签创建散点图
        for i, label in enumerate(unique_labels):
            mask = labels == label
            cluster_points = coords[mask]
            cluster_df = df.iloc[mask]
            
            # 为每个点添加随机偏移以减少重叠
            jittered_points = cluster_points + np.random.normal(0, jitter*2, cluster_points.shape)
            
            # 计算不透明度（基于最主要主题的概率）
            alphas = []
            for j in range(len(cluster_df)):
                try:
                    if pd.isna(cluster_df['allProbabilities'].iloc[j]):
                        alphas.append(point_alpha)  # 默认透明度
                    else:
                        # 解析概率字符串
                        probs = [float(p) for p in cluster_df['allProbabilities'].iloc[j].split(',')]
                        # 使用最大概率值作为透明度，但限制在一定范围内
                        alphas.append(min(0.9, max(point_alpha - 0.2, max(probs))))
                except:
                    alphas.append(point_alpha)  # 解析失败时使用默认透明度
            
            # 绘制散点
            scatter = ax.scatter(
                jittered_points[:, 0],
                jittered_points[:, 1],
                color=cluster_colors[i],
                marker='o',
                alpha=alphas,
                s=point_size,
                edgecolor='none',  # 移除边框
                linewidth=0,
                zorder=3
            )
            scatter_plots.append(scatter)
            # 存储原始颜色
            original_colors[label] = cluster_colors[i]
            
            # 添加到图例
            legend_handles.append(scatter)
            legend_labels.append(f'聚类 {label} ({len(cluster_points)}首)')
    
    # 处理噪声点（如果有）
    if -1 in labels:
        noise_mask = labels == -1
        noise_points = coords[noise_mask]
        
        if len(noise_points) > 0:
            # 添加随机偏移
            jittered_noise = noise_points + np.random.normal(0, jitter*2, noise_points.shape)
            
            # 绘制噪声点
            noise_scatter = ax.scatter(
                jittered_noise[:, 0],
                jittered_noise[:, 1],
                color='grey',
                marker='.',
                alpha=0.3,
                s=point_size/2,
                edgecolor='none',
                zorder=2
            )
            
            # 添加到图例
            legend_handles.append(noise_scatter)
            legend_labels.append(f'未分类点 ({len(noise_points)}首)')
            # 存储噪声点原始颜色
            original_colors[-1] = 'grey'
    
    # 创建复选框
    checkbox_ax = plt.axes([0.02, 0.02, 0.2, 0.2])
    if not use_topic_colors:
        # 使用聚类标签的复选框
        checkbox_labels = [f'聚类 {label}' for label in unique_labels]
        if -1 in labels:
            checkbox_labels.append('未分类点')
        checkbox = CheckButtons(checkbox_ax, checkbox_labels, [True] * len(checkbox_labels))
    else:
        # 使用主题的复选框
        checkbox_labels = [f'主题 {i}' for i in range(num_topics)]
        checkbox = CheckButtons(checkbox_ax, checkbox_labels, [True] * num_topics)
    
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
        'df': df,
        'vectors': vectors
    }
    
    # 创建选中状态跟踪字典
    checked_states = {}
    if use_topic_colors:
        for i in range(num_topics):
            checked_states[i] = True
    else:
        for label in unique_labels:
            checked_states[label] = True
        if -1 in labels:
            checked_states[-1] = True
    
    def update_visibility(label):
        """更新散点图的可见性和外观"""
        if not use_topic_colors:
            # 聚类标签视图
            idx = checkbox_labels.index(label)
            label_value = unique_labels[idx] if idx < len(unique_labels) else -1  # -1 代表噪声点
            
            # 更新选中状态
            checked_states[label_value] = not checked_states[label_value]
            
            if idx < len(scatter_plots):
                scatter = scatter_plots[idx]
                
                if checked_states[label_value]:
                    # 如果选中，恢复原始颜色
                    scatter.set_facecolor(original_colors[label_value])
                    scatter.set_alpha(point_alpha)
                    scatter.set_zorder(3)  # 放到上层
                else:
                    # 如果未选中，添加灰色半透明效果
                    # 获取原始颜色形状
                    original_color = original_colors[label_value]
                    if isinstance(original_color, np.ndarray) and original_color.shape[-1] == 4:
                        grey_colors = np.ones(original_color.shape) * 0.7  # 灰色
                        grey_colors[:, 3] = 0.3  # 透明度设为0.3
                    else:
                        # 单一颜色的情况
                        grey_colors = [0.7, 0.7, 0.7, 0.3]  # 灰色半透明
                    
                    scatter.set_facecolor(grey_colors)
                    scatter.set_zorder(1)  # 放到底层
        else:
            # 主题视图
            topic_idx = int(label.split()[-1])  # 获取主题编号
            
            # 更新选中状态
            checked_states[topic_idx] = not checked_states[topic_idx]
            
            if topic_idx < len(scatter_plots):
                scatter = scatter_plots[topic_idx]
                
                if checked_states[topic_idx]:
                    # 如果选中，恢复原始颜色
                    scatter.set_facecolor(original_colors[topic_idx])
                    scatter.set_alpha(point_alpha)
                    scatter.set_zorder(3)  # 放到上层
                else:
                    # 如果未选中，添加灰色半透明效果
                    # 获取原始颜色形状
                    original_color = original_colors[topic_idx]
                    if isinstance(original_color, np.ndarray) and original_color.size > 0:
                        if len(original_color.shape) > 1:
                            # 多个颜色的情况
                            grey_colors = np.ones_like(original_color) * 0.7  # 灰色
                            grey_colors[:, 3] = 0.3  # 透明度设为0.3
                        else:
                            # 单个RGBA颜色
                            grey_colors = np.array([0.7, 0.7, 0.7, 0.3])  # 灰色半透明
                    else:
                        # 单一颜色的情况
                        grey_colors = [0.7, 0.7, 0.7, 0.3]  # 灰色半透明
                    
                    scatter.set_facecolor(grey_colors)
                    scatter.set_zorder(1)  # 放到底层
        
        plt.draw()
    
    def on_click(event):
        """处理点击事件，显示详细信息"""
        if event.inaxes == ax:
            # 计算点击位置到所有点的距离
            distances = np.sqrt(np.sum((coords - np.array([event.xdata, event.ydata]))**2, axis=1))
            closest_idx = np.argmin(distances)
            min_distance = distances[closest_idx]
            
            # 设置距离阈值，只有当点击位置与最近点的距离小于阈值时才显示信息
            # 阈值可以根据点的大小和散点图的密度进行调整
            distance_threshold = point_size / 100 * 5  # 根据点大小动态调整阈值
            
            if min_distance <= distance_threshold:
                # 获取对应的数据行
                row = df.iloc[closest_idx]
                
                # 获取向量
                vector = vectors[closest_idx]
                
                # 尝试解析概率
                try:
                    probs = [float(p) for p in row['allProbabilities'].split(',')]
                    probs_formatted = ", ".join([f"{p:.3f}" for p in probs])
                    
                    # 找出最显著的主题
                    dominant_topic = np.argmax(probs)
                    dominant_prob = probs[dominant_topic]
                except:
                    probs_formatted = "解析失败"
                    dominant_topic = -1
                    dominant_prob = 0
                
                # 更新文本框内容
                text = f'诗词ID: {row["poemId"]}\n'
                text += f'主题: {row["topics"]}\n'
                text += f'概率: {probs_formatted}\n'
                if dominant_topic >= 0:
                    text += f'主题 {dominant_topic} 最显著: {dominant_prob:.3f}\n'
                text += f'聚类: {labels[closest_idx]}\n'
                text += f'主题词: {str(row["topicWords"])[:50]}...' if len(str(row["topicWords"])) > 50 else str(row["topicWords"])
                
                text_box.set_text(text)
            else:
                # 如果点击位置距离最近点太远，则清空文本框
                text_box.set_text('')
            
            plt.draw()
    
    # 绑定事件
    checkbox.on_clicked(update_visibility)
    fig.canvas.mpl_connect('button_press_event', on_click)
    
    plt.title('诗词主题概率聚类分布图', fontsize=20, pad=20)
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
    
    return fig

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='诗词主题聚类可视化工具')
    
    # UMAP参数 - 修改默认值以获得更分散的分布
    parser.add_argument('--n_neighbors', type=int, default=5, help='UMAP的邻居数量，较小的值使聚类更分散')
    parser.add_argument('--min_dist', type=float, default=0.8, help='UMAP的最小距离，较大的值使点之间距离更大')
    parser.add_argument('--spread', type=float, default=1.5, help='UMAP的spread参数，较大的值使分布更分散')
    parser.add_argument('--scale', type=float, default=1.0, help='坐标缩放因子，较大的值使整体分布更大')
    
    # HDBSCAN参数
    parser.add_argument('--min_cluster_size', type=int, default=15, help='HDBSCAN最小聚类大小')
    parser.add_argument('--min_samples', type=int, default=5, help='HDBSCAN最小样本数')
    parser.add_argument('--cluster_selection_epsilon', type=float, default=0.5, help='HDBSCAN聚类选择epsilon')
    
    # 传统聚类参数
    parser.add_argument('--n_clusters', type=int, default=4, help='聚类数量(当使用K-means时)')
    parser.add_argument('--use_kmeans', action='store_true', help='使用K-means而不是HDBSCAN')
    
    # 点的参数
    parser.add_argument('--point_size', type=float, default=15, help='点的大小') 
    parser.add_argument('--point_alpha', type=float, default=0.7, help='点的透明度')
    parser.add_argument('--jitter', type=float, default=0.01, help='点的抖动程度，用于减少重叠')
    
    # 边界参数
    parser.add_argument('--boundary_alpha', type=float, default=0.04, help='边界透明度')
    parser.add_argument('--expand_factor', type=float, default=0.4, help='边界扩展因子')
    parser.add_argument('--padding', type=float, default=0.2, help='边界padding')
    parser.add_argument('--smoothness', type=float, default=0.6, help='边界平滑度')
    
    # 颜色方案
    parser.add_argument('--color_scheme', type=str, default='Set1', 
                        choices=['tab10', 'Set1', 'Set2', 'Paired'], 
                        help='颜色方案')
    
    # 颜色表示方法 - 默认使用K-means
    parser.add_argument('--use_cluster_colors', action='store_true', help='使用聚类标签而不是主题概率来确定颜色')
    
    # 输入文件
    parser.add_argument('--input', type=str, default='lda02_topics_with_probabilities.csv', help='输入CSV文件路径')
    
    # 输出文件
    parser.add_argument('--output', type=str, default='lda02_topic_scatter.png', help='输出文件路径')
    
    args = parser.parse_args()
    # 默认使用K-means聚类方法
    args.use_kmeans = True
    return args

def main():
    # 解析命令行参数
    args = parse_args()
    
    # 读取主题概率数据
    print(f"正在读取主题概率数据: {args.input}")
    
    try:
        # 尝试读取指定的文件路径
        topic_df = read_topic_csv(args.input)
    except FileNotFoundError:
        # 首先尝试直接读取新的文件路径
        try:
            print("尝试读取指定的新文件路径")
            topic_df = read_topic_csv(r"D:\01\lunwen\processdata\lda02_topics_with_probabilities.csv")
            print("成功从新文件路径读取数据")
        except FileNotFoundError:
            # 尝试其他可能的路径
            try_paths = [
                'processdata/lda02_topics_with_probabilities.csv',
                '../lda02_topics_with_probabilities.csv', 
                './lda02_topics_with_probabilities.csv',
                'lda_visualization/lda02_topics_with_probabilities.csv',
                'processdata/topics_probabilities.csv', 
                '../topics_probabilities.csv', 
                './topics_probabilities.csv', 
                'lda_visualization/topics_probabilities.csv'
            ]
            found = False
            
            for path in try_paths:
                try:
                    print(f"尝试读取: {path}")
                    topic_df = read_topic_csv(path)
                    print(f"成功从 {path} 读取数据")
                    found = True
                    break
                except FileNotFoundError:
                    continue
            
            if not found:
                print("错误: 无法找到主题概率文件。请确保文件存在并提供正确路径。")
                print("可以使用 --input 参数指定文件路径，例如: --input=D:/01/lunwen/processdata/lda02_topics_with_probabilities.csv")
                return
    
    # 将主题概率转换为向量 - 使用4个主题
    print("正在转换主题概率数据为向量...")
    vectors = []
    for prob_str in topic_df['allProbabilities']:
        vector = convert_to_vector(prob_str, num_topics=4)  # 明确指定为4个主题
        vectors.append(vector)
    
    vectors = np.array(vectors)
    
    # 输出向量形状和前几个样本作为参考
    print(f"生成的向量数组形状: {vectors.shape}")
    if len(vectors) > 0:
        print(f"前3个向量示例:")
        for i in range(min(3, len(vectors))):
            print(f"  向量 {i+1}: {vectors[i]}")
    
    # 降维
    print("正在进行降维...")
    umap_result = reduce_dimensions(
        vectors,
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        spread=args.spread,
        scale=args.scale,
        random_state=42  # 固定随机种子以获得稳定结果
    )
    
    # 聚类
    if args.use_kmeans:
        print(f"正在使用K-means进行聚类 (n_clusters={args.n_clusters})...")
        kmeans = KMeans(n_clusters=args.n_clusters, random_state=42, n_init=20)  # 增加初始化次数
        cluster_labels = kmeans.fit_predict(umap_result)
        clusterer = None
    else:
        print("正在使用HDBSCAN进行聚类...")
        cluster_labels, clusterer = cluster_points(
            umap_result,
            min_cluster_size=args.min_cluster_size,
            min_samples=args.min_samples,
            cluster_selection_epsilon=args.cluster_selection_epsilon
        )
    
    # 保存结果到数据库
    print("跳过数据库保存操作...")
    save_results_to_db(umap_result, cluster_labels, topic_df, vectors)
    
    # 创建交互式可视化
    print("正在生成交互式可视化...")
    create_interactive_plot(
        umap_result, 
        cluster_labels, 
        topic_df, 
        vectors,
        output_file=args.output,
        point_size=args.point_size,
        point_alpha=args.point_alpha,
        jitter=args.jitter,
        boundary_alpha=args.boundary_alpha,
        expand_factor=args.expand_factor,
        padding=args.padding,
        smoothness=args.smoothness,
        color_scheme=args.color_scheme,
        use_topic_colors=not args.use_cluster_colors
    )
    
    print(f"处理完成！共处理了{len(vectors)}首诗的主题分布。")
    print(f"生成的图像文件：{args.output}")

if __name__ == "__main__":
    main() 