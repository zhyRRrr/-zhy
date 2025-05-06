import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
import hdbscan
import umap
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

# 情感类别名称
EMOTION_NAMES = {
    0: '思',
    1: '乐',
    2: '哀',
    3: '喜',
    4: '怒/豪'
}

# 情感类别颜色
EMOTION_CLASS_COLORS = [
    EMOTION_COLORS['思'],
    EMOTION_COLORS['乐'],
    EMOTION_COLORS['哀'],
    EMOTION_COLORS['喜'],
    EMOTION_COLORS['怒']
]

def get_data_from_db():
    """从数据库获取情感概率数据"""
    try:
        print("正在连接数据库...")
        print(f"连接配置: {DB_CONFIG}")
        conn = mysql.connector.connect(**DB_CONFIG)
        print("数据库连接成功")
        
        cursor = conn.cursor()
        print("正在执行查询...")
        # 检查表是否存在
        cursor.execute("SHOW TABLES LIKE 'emotion_probabilities'")
        if not cursor.fetchone():
            raise Exception("表emotion_probabilities不存在")
            
        cursor.execute("SELECT COUNT(*) FROM emotion_probabilities")  # 先获取数据总数
        total_count = cursor.fetchone()[0]
        print(f"emotion_probabilities表中共有 {total_count} 条数据")
        
        print("正在获取情感概率数据...")
        cursor.execute("""
            SELECT id, poemId, emotion, le_prob, ai_prob, xi_prob, nu_hao_prob, si_prob 
            FROM emotion_probabilities
        """)
        data = cursor.fetchall()
        print(f"成功获取到 {len(data)} 条数据")
        
        # 转换为DataFrame以方便处理
        df = pd.DataFrame(data, columns=['id', 'poemId', 'emotion', 'le_prob', 'ai_prob', 'xi_prob', 'nu_hao_prob', 'si_prob'])
        return df
        
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

def get_vectors_from_probabilities(df):
    """从概率数据中提取情感向量"""
    # 提取概率列形成向量矩阵
    prob_columns = ['si_prob', 'le_prob', 'ai_prob', 'xi_prob', 'nu_hao_prob']
    vectors = df[prob_columns].values
    
    # 确保数据是浮点型
    vectors = vectors.astype(float)
    
    # 检查是否有缺失值，用0填充
    if np.isnan(vectors).any():
        print("警告：发现缺失值，使用0填充")
        vectors = np.nan_to_num(vectors)
    
    print(f"成功构建{len(vectors)}个情感概率向量")
    return vectors

def classify_by_dominant_emotion(vectors):
    """直接根据主导情感（概率最高的情感）进行分类"""
    # 找出每个向量的主导情感（概率最高的）
    dominant_emotions = np.argmax(vectors, axis=1)
    
    # 统计每种情感的数量
    emotion_counts = {}
    for i in range(5):  # 5种情感
        count = np.sum(dominant_emotions == i)
        emotion_name = EMOTION_NAMES[i]
        emotion_counts[emotion_name] = count
        print(f"情感 '{emotion_name}' 主导的诗歌有 {count} 首")
    
    return dominant_emotions

def reduce_dimensions(vectors, n_components=2, n_neighbors=15, min_dist=0.1, spread=1.0, scale=1.2, random_state=42):
    """使用监督式UMAP进行降维，利用情感标签引导降维过程"""
    # 直接使用原始向量进行处理
    enhanced_vectors = vectors.copy()
    
    # 找出每个向量的主导情感（概率最高的）
    dominant_emotions = np.argmax(vectors, axis=1)
    
    # 应用情感权重增强，让主导情感更显著
    for i in range(len(enhanced_vectors)):
        # 找出每行的最大值（主导情感）
        max_idx = np.argmax(enhanced_vectors[i])
        # 强化主导情感的权重
        enhanced_vectors[i, max_idx] *= 1.5  # 增强主导情感与其他情感的差距
        # 重新归一化
        if np.sum(enhanced_vectors[i]) > 0:
            enhanced_vectors[i] = enhanced_vectors[i] / np.sum(enhanced_vectors[i])
    
    # 使用监督式UMAP降维，利用情感类别标签引导降维
    reducer = umap.UMAP(
        n_components=n_components,
        n_neighbors=n_neighbors,      # 增大邻居数量，更好地捕捉全局结构
        min_dist=min_dist,            # 减小最小距离，使类内点更紧密
        spread=spread,                # 调整为标准值，控制整体分布
        random_state=random_state,
        metric='euclidean',
        low_memory=False,
        repulsion_strength=1.2,       # 增强类间排斥力
        target_weight=0.5,            # 标签信息的权重
        transform_seed=random_state,
        target_metric='categorical',  # 使用类别度量
        target_n_neighbors=5          # 标签相似性考虑的邻居数
    )
    
    # 执行有监督降维，将类别标签作为监督信息
    coords = reducer.fit_transform(enhanced_vectors, y=dominant_emotions)
    
    # 标准化并调整分散程度
    coords = (coords - coords.mean(axis=0)) / coords.std(axis=0)
    coords *= scale  # 缩放因子
    
    return coords

def create_smooth_boundary(points, expand_factor=1.5, padding=1.2, smoothness=0.3):
    """创建平滑的边界曲线，参考topic_clustering.py的实现"""
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

def create_interactive_plot(coords, labels, emotions, vectors, output_file='emotion1/emotion_clusters.png', 
                           point_size=35, point_alpha=0.8, jitter=0.02, boundary_alpha=0.15):
    """创建交互式散点图，直接以情感类别作为标签"""
    fig = plt.figure(figsize=(16, 14))
    ax = plt.gca()
    
    # 设置背景样式
    ax.set_facecolor('#ffffff')
    plt.gcf().patch.set_facecolor('#ffffff')
    
    # 设置网格样式
    ax.grid(True, linestyle='--', alpha=0.2)
    
    # 为每个点计算颜色 - 直接使用情感类别颜色
    point_colors = np.array([EMOTION_CLASS_COLORS[label] for label in labels])
    
    # 创建图例句柄和标签
    legend_handles = []
    legend_labels = []
    
    # 存储原始点颜色
    original_colors = {}
    
    # 创建散点图 - 按情感类别分组
    scatter_plots = []
    for emotion_idx in range(5):  # 5种情感
        mask = labels == emotion_idx
        if np.sum(mask) > 0:
            emotion_points = coords[mask]
            emotion_name = EMOTION_NAMES[emotion_idx]
            emotion_color = EMOTION_CLASS_COLORS[emotion_idx]
            count = np.sum(mask)
            
            # 为每个点添加随机偏移以减少重叠
            jittered_points = emotion_points + np.random.normal(0, jitter, emotion_points.shape)
            
            # 绘制散点
            scatter = ax.scatter(
                jittered_points[:, 0],
                jittered_points[:, 1],
                color=emotion_color,
                marker='o',
                alpha=point_alpha,
                s=point_size,
                edgecolor='white',
                linewidth=0.5,
                zorder=3,
                label=f'情感: {emotion_name}'
            )
            scatter_plots.append(scatter)
            
            # 存储原始颜色
            original_colors[emotion_idx] = emotion_color
            
            # 添加到图例
            legend_handles.append(scatter)
            legend_labels.append(f'情感: {emotion_name} ({count}首)')
    
    # 创建复选框
    checkbox_ax = plt.axes([0.02, 0.02, 0.2, 0.2])
    checkbox_labels = [f'情感: {EMOTION_NAMES[i]}' for i in range(5)]
    checkbox = CheckButtons(checkbox_ax, checkbox_labels, [True] * 5)
    
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
        'vectors': vectors
    }
    
    # 创建选中状态跟踪字典
    checked_states = {i: True for i in range(5)}
    
    def update_visibility(label):
        """更新散点图的可见性和外观"""
        idx = checkbox_labels.index(label)
        emotion_idx = idx  # 情感索引
        
        checked_states[emotion_idx] = not checked_states[emotion_idx]
        
        scatter = scatter_plots[idx]
        if checked_states[emotion_idx]:
            # 如果选中，恢复原始颜色
            scatter.set_visible(True)
        else:
            # 如果未选中，隐藏
            scatter.set_visible(False)
        
        plt.draw()
    
    def on_click(event):
        """处理点击事件"""
        if event.inaxes == ax:
            # 计算点击位置到所有点的距离
            distances = np.sqrt(np.sum((coords - np.array([event.xdata, event.ydata]))**2, axis=1))
            closest_idx = np.argmin(distances)
            min_distance = distances[closest_idx]
            
            # 设置距离阈值
            distance_threshold = point_size / 100 * 5  # 根据点大小动态调整阈值
            
            if min_distance <= distance_threshold:
                # 更新文本框内容
                emotion = emotions[closest_idx]
                vector = vectors[closest_idx]
                label = labels[closest_idx]
                dominant_emotion = EMOTION_NAMES[label]
                
                text = f'情感: {emotion}\n'
                text += f'思: {vector[0]:.2f}, 乐: {vector[1]:.2f}\n'
                text += f'哀: {vector[2]:.2f}, 喜: {vector[3]:.2f}\n'
                text += f'怒/豪: {vector[4]:.2f}\n'
                text += f'主导情感: {dominant_emotion} ({vector[label]:.2f})'
                
                text_box.set_text(text)
            else:
                # 如果点击位置距离最近点太远，则清空文本框
                text_box.set_text('')
            
            plt.draw()
    
    # 绑定事件
    checkbox.on_clicked(update_visibility)
    fig.canvas.mpl_connect('button_press_event', on_click)
    
    plt.title('诗词情感分布图', fontsize=20, pad=20)
    plt.xlabel('UMAP特征1', fontsize=16)
    plt.ylabel('UMAP特征2', fontsize=16)
    
    # 添加图例
    plt.legend(legend_handles, legend_labels, bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=14)
    
    # 调整布局
    plt.tight_layout()
    
    # 设置背景颜色的透明度
    plt.gca().patch.set_alpha(boundary_alpha)
    
    # 保存图片
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"已保存交互式情感分布图到: {output_file}")
    
    # 显示图形
    plt.show()

def save_results_to_db(coords, labels, emotions, vectors, poem_ids=None):
    """保存处理结果到数据库"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # 创建新表来存储降维和聚类结果
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS emotion_probability_visualization (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poem_id INT,
                original_emotion VARCHAR(255),
                si_prob FLOAT,
                le_prob FLOAT,
                ai_prob FLOAT,
                xi_prob FLOAT,
                nu_hao_prob FLOAT,
                umap_x FLOAT,
                umap_y FLOAT,
                cluster_label INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 准备插入数据
        insert_query = """
            INSERT INTO emotion_probability_visualization 
            (poem_id, original_emotion, si_prob, le_prob, ai_prob, xi_prob, nu_hao_prob, 
             umap_x, umap_y, cluster_label)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # 构建数据
        data_to_insert = []
        for i in range(len(emotions)):
            poem_id = poem_ids[i] if poem_ids is not None else None
            data_to_insert.append((
                int(poem_id) if poem_id is not None else None,
                emotions[i],
                float(vectors[i][0]),  # si_prob
                float(vectors[i][1]),  # le_prob
                float(vectors[i][2]),  # ai_prob
                float(vectors[i][3]),  # xi_prob
                float(vectors[i][4]),  # nu_hao_prob
                float(coords[i][0]),   # umap_x
                float(coords[i][1]),   # umap_y
                int(labels[i])         # cluster_label
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

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='诗词情感聚类可视化工具')
    
    # UMAP参数
    parser.add_argument('--n_neighbors', type=int, default=5, help='UMAP的邻居数量，较小的值使聚类更分散')
    parser.add_argument('--min_dist', type=float, default=0.8, help='UMAP的最小距离，较大的值使点之间距离更大')
    parser.add_argument('--spread', type=float, default=3.0, help='UMAP的spread参数，较大的值使分布更分散')
    parser.add_argument('--scale', type=float, default=1.5, help='坐标缩放因子，较大的值使整体分布更大')
    
    # 点的参数
    parser.add_argument('--point_size', type=float, default=35, help='点的大小')
    parser.add_argument('--point_alpha', type=float, default=0.8, help='点的透明度')
    parser.add_argument('--jitter', type=float, default=0.02, help='点的抖动程度，用于减少重叠')
    parser.add_argument('--boundary_alpha', type=float, default=0.15, help='边界透明度')
    
    # 边界参数
    parser.add_argument('--expand_factor', type=float, default=1.5, help='边界扩展因子')
    parser.add_argument('--padding', type=float, default=1.2, help='边界padding大小')
    parser.add_argument('--smoothness', type=float, default=0.3, help='边界平滑度')
    
    # 兼容HDBSCAN的参数，但实际不会使用
    parser.add_argument('--min_cluster_size', type=int, default=15)
    parser.add_argument('--min_samples', type=int, default=5)
    parser.add_argument('--cluster_selection_epsilon', type=float, default=0.5)
    
    # 输出文件
    parser.add_argument('--output', type=str, default='emotion1/emotion_clusters.png', help='输出文件路径')
    
    return parser.parse_args()

def main():
    # 解析命令行参数
    args = parse_args()
    
    print("正在从数据库获取数据...")
    df = get_data_from_db()
    
    print("正在提取情感概率向量...")
    vectors = get_vectors_from_probabilities(df)
    
    print("根据主导情感进行分类...")
    labels = classify_by_dominant_emotion(vectors)
    
    print("正在进行降维...")
    coords = reduce_dimensions(
        vectors, 
        n_neighbors=args.n_neighbors,
        min_dist=args.min_dist,
        spread=args.spread,
        scale=args.scale
    )
    
    # 保存结果到数据库
    print("跳过保存结果到数据库...")
    save_results_to_db(coords, labels, df['emotion'].values, vectors, df['poemId'].values)
    
    print("正在生成交互式可视化...")
    create_interactive_plot(
        coords, 
        labels, 
        df['emotion'].values, 
        vectors,
        output_file=args.output,
        point_size=args.point_size,
        point_alpha=args.point_alpha,
        jitter=args.jitter,
        boundary_alpha=args.boundary_alpha
    )
    
    # 打印各情感类别的统计信息
    for emotion_idx in range(5):
        count = np.sum(labels == emotion_idx)
        print(f"情感 '{EMOTION_NAMES[emotion_idx]}'：包含 {count} 首诗")
    
    print(f"处理完成！共处理了{len(vectors)}首诗的情感分布。")

if __name__ == "__main__":
    main() 