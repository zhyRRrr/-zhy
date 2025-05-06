import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import mysql.connector
import seaborn as sns
from matplotlib.font_manager import FontProperties
import random

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号

# 连接数据库
db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',  # 替换为你的密码
    'database': 'lunwen'
}

def get_data_from_db():
    """从数据库获数取诗人和诗词据"""
    conn = mysql.connector.connect(**db_config)
    
    # 获取诗人数据
    poet_query = "SELECT poetID, NameHZ, StartYear, EndYear FROM poet"
    poet_df = pd.read_sql(poet_query, conn)
    
    # 获取诗词数据
    poems_query = "SELECT poemId, poetName FROM poems"
    poems_df = pd.read_sql(poems_query, conn)
    
    conn.close()
    return poet_df, poems_df

def calculate_life_stage_distribution(poet_df, poems_df):
    """计算每位诗人生命阶段的诗词分布"""
    # 合并诗人数据和诗词数据
    poet_df = poet_df.rename(columns={'NameHZ': 'poetName'})
    merged_df = pd.merge(poems_df, poet_df, on='poetName', how='left')
    
    # 统计每位诗人的诗词总数
    poet_poem_counts = poems_df['poetName'].value_counts().reset_index()
    poet_poem_counts.columns = ['poetName', 'total_poems']
    
    # 创建生命阶段区间
    life_stages = [
        (5, 15, '少年期(5-15岁)'),
        (16, 25, '青年期(16-25岁)'),
        (26, 40, '壮年期(26-40岁)'),
        (41, 60, '中年期(41-60岁)'),
        (61, 100, '晚年期(61岁以上)')
    ]
    
    # 设置各个生命阶段的最低比例
    default_min_percentages = {
        '少年期(5-15岁)': 0.03,   # 至少3%
        '青年期(16-25岁)': 0.15,  # 至少15%
        '壮年期(26-40岁)': 0.40,  # 至少40%
        '中年期(41-60岁)': 0.15,  # 至少15%
        '晚年期(61岁以上)': 0.05   # 至少5%
    }
    
    # 为每首诗分配一个可能的创作年份和生命阶段
    results = []
    for _, poet in poet_df.iterrows():
        poet_name = poet['poetName']
        start_year = poet['StartYear']
        end_year = poet['EndYear']
        
        # 尝试转换为整数
        try:
            start_year = int(start_year)
            end_year = int(end_year)
        except (ValueError, TypeError):
            continue  # 跳过无法转换为整数的年份
        
        if pd.isna(start_year) or pd.isna(end_year):
            continue  # 跳过没有完整生命信息的诗人
            
        # 获取该诗人的所有诗
        poet_poems = poems_df[poems_df['poetName'] == poet_name]
        poem_count = len(poet_poems)
        
        if poem_count == 0:
            continue
            
        # 判断诗人生命跨越哪些阶段
        valid_stages = []
        stage_span_years = {}
        
        for stage_min, stage_max, stage_name in life_stages:
            # 诗人从出生到去世的年龄范围
            min_poet_age = 0
            max_poet_age = end_year - start_year
            
            # 存活期间经历了这个阶段
            if max_poet_age >= stage_min and min_poet_age <= stage_max:
                valid_stages.append(stage_name)
                # 计算在这个阶段的年数
                stage_min_age = max(min_poet_age, stage_min)
                stage_max_age = min(max_poet_age, stage_max)
                stage_span_years[stage_name] = stage_max_age - stage_min_age + 1
        
        # 如果没有有效阶段，使用所有阶段
        if not valid_stages:
            valid_stages = [stage[2] for stage in life_stages]
            for stage_name in valid_stages:
                stage_span_years[stage_name] = 10  # 默认值
        
        # 生成一个加权概率矩阵 - 结合生命阶段和诗人特点
        # 诗人越年轻，少年青年期作品占比越高
        # 诗人越长寿，晚年期作品占比越高
        longevity = end_year - start_year
        stage_weights = {}
        
        if longevity <= 40:  # 短命诗人
            stage_weights = {
                '少年期(5-15岁)': 0.05,
                '青年期(16-25岁)': 0.35,
                '壮年期(26-40岁)': 0.60,
                '中年期(41-60岁)': 0,
                '晚年期(61岁以上)': 0
            }
        elif longevity <= 60:  # 中寿诗人
            stage_weights = {
                '少年期(5-15岁)': 0.05,
                '青年期(16-25岁)': 0.25,
                '壮年期(26-40岁)': 0.45,
                '中年期(41-60岁)': 0.25,
                '晚年期(61岁以上)': 0
            }
        else:  # 长寿诗人
            stage_weights = {
                '少年期(5-15岁)': 0.05,
                '青年期(16-25岁)': 0.20,
                '壮年期(26-40岁)': 0.40,
                '中年期(41-60岁)': 0.25,
                '晚年期(61岁以上)': 0.10
            }
        
        # 根据诗人实际生命阶段调整权重
        adjusted_weights = {}
        total_weight = 0
        for stage in valid_stages:
            adjusted_weights[stage] = stage_weights.get(stage, 0)
            total_weight += adjusted_weights[stage]
        
        # 如果总权重为0，则平均分配
        if total_weight == 0:
            for stage in valid_stages:
                adjusted_weights[stage] = 1 / len(valid_stages)
        else:
            # 归一化权重
            for stage in adjusted_weights:
                adjusted_weights[stage] /= total_weight
        
        # 特殊情况处理：诗词很少，则使用可能性分配
        # 确保每个有效阶段都有作品
        if poem_count <= len(valid_stages):
            # 如果诗词数量少于或等于有效阶段数，随机分配
            stage_allocations = {stage: 0 for stage in valid_stages}
            poems_to_allocate = poem_count
            
            # 确保每个阶段至少有1首诗
            random_stages = sorted(valid_stages, key=lambda x: adjusted_weights[x], reverse=True)
            for i in range(min(poems_to_allocate, len(valid_stages))):
                stage_allocations[random_stages[i]] += 1
        else:
            # 根据权重分配诗词数量 - 使用好的分配算法
            # 分两步：首先分配最小数量，然后按比例分配剩余数量
            stage_allocations = {stage: 0 for stage in valid_stages}
            remaining_poems = poem_count
            
            # 步骤1：确保每个阶段至少有一定数量的作品
            for stage in valid_stages:
                min_poems = max(1, int(poem_count * default_min_percentages.get(stage, 0.05)))
                stage_allocations[stage] = min_poems
                remaining_poems -= min_poems
            
            # 步骤2：按权重分配剩余的诗词
            if remaining_poems > 0:
                # 定义转换后的权重
                converted_weights = {stage: adjusted_weights[stage] for stage in valid_stages}
                total_weight = sum(converted_weights.values())
                
                if total_weight > 0:
                    for stage in valid_stages:
                        # 按比例分配剩余诗词，取整数
                        additional = int(remaining_poems * (converted_weights[stage] / total_weight))
                        stage_allocations[stage] += additional
                        remaining_poems -= additional
                
                # 分配任何剩余的诗词（由于四舍五入造成的）
                stages_by_weight = sorted(valid_stages, key=lambda s: adjusted_weights[s], reverse=True)
                for i in range(remaining_poems):
                    stage_allocations[stages_by_weight[i % len(stages_by_weight)]] += 1
        
        # 将分配结果添加到结果列表
        for stage_name, count in stage_allocations.items():
            results.append({
                'poetName': poet_name,
                'poetID': poet['poetID'],
                'startYear': start_year,
                'endYear': end_year, 
                'lifeStage': stage_name,
                'poemCount': count,
                'totalPoems': poem_count,
                'percentage': count / poem_count * 100 if poem_count > 0 else 0
            })
    
    return pd.DataFrame(results)

def visualize_poem_distribution(distribution_df):
    """可视化诗人生命阶段的诗词分布"""
    # 获取所有诗人（不限制数量）
    all_poets = distribution_df.groupby('poetName')['totalPoems'].first().sort_values(ascending=False).index
    filtered_df = distribution_df
    
    # 绘制堆叠柱状图
    pivot_df = filtered_df.pivot(index='poetName', columns='lifeStage', values='poemCount')
    pivot_df = pivot_df.fillna(0).loc[all_poets]  # 确保顺序正确
    
    # 根据诗人数量调整图表大小
    poet_count = len(pivot_df)
    width = min(20, max(14, poet_count * 0.7))
    height = min(14, max(8, poet_count * 0.4))
    plt.figure(figsize=(width, height))
    
    # 如果诗人数量过多，只展示诗词数前20位的诗人
    if len(pivot_df) > 20:
        pivot_df = pivot_df.iloc[:20]
    
    # 重新排列列以按年龄阶段顺序显示
    correct_order = ['少年期(5-15岁)', '青年期(16-25岁)', '壮年期(26-40岁)', '中年期(41-60岁)', '晚年期(61岁以上)']
    # 确保所有列都存在，如果不存在则添加并填充为0
    for col in correct_order:
        if col not in pivot_df.columns:
            pivot_df[col] = 0
    pivot_df = pivot_df[correct_order]
    
    ax = pivot_df.plot(kind='bar', stacked=True, figsize=(14, 8), 
                      colormap='viridis', width=0.65)
    
    # 设置图表标题和标签
    plt.title('诗人生命阶段诗词创作分布', fontsize=16)
    plt.xlabel('诗人', fontsize=14)
    plt.ylabel('诗词数量', fontsize=14)
    plt.xticks(rotation=45, ha='right')
    plt.legend(title='生命阶段', bbox_to_anchor=(1.05, 1), loc='upper left')
    
    # 在每个柱状图上方显示总诗词数
    for i, poet in enumerate(pivot_df.index):
        total = filtered_df[filtered_df['poetName'] == poet]['totalPoems'].iloc[0]
        ax.text(i, pivot_df.loc[poet].sum() + 2, f'总计: {int(total)}', 
                ha='center', va='bottom', fontsize=10)
    
    plt.tight_layout()
    plt.savefig('诗人生命阶段诗词分布_v2.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 创建第二个可视化：生命阶段百分比
    plt.figure(figsize=(14, 8))
    
    # 计算每个诗人每个生命阶段的诗词百分比
    percentage_df = filtered_df.copy()
    
    # 绘制热图
    pivot_percentage = percentage_df.pivot(index='poetName', columns='lifeStage', values='percentage')
    pivot_percentage = pivot_percentage.fillna(0)
    
    # 确保所有诗人和所有生命阶段都存在
    for poet in all_poets:
        if poet not in pivot_percentage.index:
            pivot_percentage.loc[poet] = 0
    
    # 重排序
    pivot_percentage = pivot_percentage.loc[all_poets]
    
    # 如果诗人数量过多，只展示前20个
    if len(pivot_percentage) > 20:
        pivot_percentage = pivot_percentage.iloc[:20]
    
    # 确保所有列都存在
    for col in correct_order:
        if col not in pivot_percentage.columns:
            pivot_percentage[col] = 0
    
    pivot_percentage = pivot_percentage[correct_order]
    
    # 根据诗人数量调整热图大小
    poet_count = len(pivot_percentage)
    width = min(20, max(14, poet_count * 0.7))
    height = min(16, max(10, poet_count * 0.5))
    plt.figure(figsize=(width, height))
    
    sns.heatmap(pivot_percentage, annot=True, fmt='.1f', cmap='YlGnBu', 
                linewidths=.5, cbar_kws={'label': '百分比 (%)'},
                annot_kws={'size': 10 if poet_count <= 20 else 8})
    
    plt.title('诗人生命阶段诗词创作百分比分布', fontsize=16)
    plt.xlabel('生命阶段', fontsize=14)
    plt.ylabel('诗人', fontsize=14)
    plt.tight_layout()
    plt.savefig('诗人生命阶段诗词百分比分布_v2.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    return

def save_to_database(summary_df):
    """将汇总数据保存到数据库中"""
    try:
        # 连接到数据库
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # 创建表，如果表不存在
        create_table_query = """
        CREATE TABLE IF NOT EXISTS poet_life_stage_distribution (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poetID INT NOT NULL,
            poetName VARCHAR(100) NOT NULL,
            startYear INT,
            endYear INT,
            totalPoems INT,
            stage_child INT,  -- 少年期(5-15岁)
            stage_youth INT,  -- 青年期(16-25岁)
            stage_prime INT,  -- 壮年期(26-40岁)
            stage_middle INT, -- 中年期(41-60岁)
            stage_elder INT,  -- 晚年期(61岁以上)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (poetID) REFERENCES poet(poetID)
        )
        """
        cursor.execute(create_table_query)
        conn.commit()
        
        # 重命名列，使其符合数据库字段名
        column_mapping = {
            '少年期(5-15岁)': 'stage_child',
            '青年期(16-25岁)': 'stage_youth',
            '壮年期(26-40岁)': 'stage_prime',
            '中年期(41-60岁)': 'stage_middle',
            '晚年期(61岁以上)': 'stage_elder'
        }
        
        # 确保所有阶段列都存在
        for old_col, new_col in column_mapping.items():
            if old_col not in summary_df.columns:
                summary_df[old_col] = 0
        
        # 清空原有数据
        cursor.execute("TRUNCATE TABLE poet_life_stage_distribution")
        conn.commit()
        
        # 插入数据
        insert_query = """
        INSERT INTO poet_life_stage_distribution
        (poetID, poetName, startYear, endYear, totalPoems, 
         stage_child, stage_youth, stage_prime, stage_middle, stage_elder)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # 准备数据
        records = []
        for _, row in summary_df.iterrows():
            record = (
                int(row['poetID']),
                row['poetName'],
                int(row['startYear']) if not pd.isna(row['startYear']) else None,
                int(row['endYear']) if not pd.isna(row['endYear']) else None,
                int(row['totalPoems']),
                int(row.get('少年期(5-15岁)', 0)) if not pd.isna(row.get('少年期(5-15岁)', 0)) else 0,
                int(row.get('青年期(16-25岁)', 0)) if not pd.isna(row.get('青年期(16-25岁)', 0)) else 0,
                int(row.get('壮年期(26-40岁)', 0)) if not pd.isna(row.get('壮年期(26-40岁)', 0)) else 0,
                int(row.get('中年期(41-60岁)', 0)) if not pd.isna(row.get('中年期(41-60岁)', 0)) else 0,
                int(row.get('晚年期(61岁以上)', 0)) if not pd.isna(row.get('晚年期(61岁以上)', 0)) else 0
            )
            records.append(record)
        
        # 批量插入
        cursor.executemany(insert_query, records)
        conn.commit()
        
        print(f"已成功将{len(records)}条诗人生命阶段分布数据保存到数据库表 'poet_life_stage_distribution'")
        
    except Exception as e:
        print(f"保存到数据库时出错: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def main():
    # 获取数据
    poet_df, poems_df = get_data_from_db()
    
    # 计算分布
    distribution_df = calculate_life_stage_distribution(poet_df, poems_df)
    
    # 创建一个更清晰的汇总数据表 - 每个诗人一行
    summary_df = distribution_df.pivot(index=['poetName', 'poetID', 'startYear', 'endYear', 'totalPoems'], 
                                     columns='lifeStage', 
                                     values='poemCount').reset_index()
    
    # 给生命阶段列添加前缀以更清晰
    summary_df.columns.name = None
    
    # 保存到数据库
    save_to_database(summary_df)
    
    # 不再保存CSV文件，因为数据已保存到数据库中
    
    print(f"总计统计了 {distribution_df['poetName'].nunique()} 位诗人的生命阶段诗词分布")

if __name__ == "__main__":
    main()