import os
import pymysql
import numpy as np
import pandas as pd
from wordcloud import WordCloud, ImageColorGenerator
from matplotlib import pyplot as plt
from PIL import Image
import collections
import re
import cv2
import traceback
import hashlib

# 连接MySQL数据库
def connect_to_mysql():
    connection = pymysql.connect(
        host='localhost',
        user='root',
        password='123456',  # 请替换为您的数据库密码
        database='lunwen',
        charset='utf8mb4'
    )
    return connection

# 从数据库获取topicWords数据
def get_topic_words():
    connection = connect_to_mysql()
    try:
        with connection.cursor() as cursor:
            # 从topic表中获取topicWords列的数据
            sql = "SELECT topicWords FROM topic"
            cursor.execute(sql)
            results = cursor.fetchall()
            return results
    finally:
        connection.close()

# 处理topicWords数据，统计词频
def process_topic_words(topic_words_data):
    all_words = []
    
    print(f"处理 {len(topic_words_data)} 条topicWords数据")
    
    sample_count = min(5, len(topic_words_data))
    print(f"数据样例（前{sample_count}条）：")
    for i in range(sample_count):
        print(f"  {i+1}. {topic_words_data[i][0]}")
    
    for row in topic_words_data:
        if row[0] is None or len(row[0].strip()) == 0:
            continue
            
        topic_words = row[0]
        # 先尝试使用正则表达式匹配双引号内的内容
        matches = re.findall(r'"([^"]*)"', topic_words)
        
        if matches:
            # 如果找到匹配项，使用它们
            for match in matches:
                # 对于每个匹配项，按照逗号（中文或英文）分割单个词
                words = re.split(r'[,，]', match)
                for word in words:
                    word = word.strip()  # 去除空格
                    if word:  # 确保单词不为空
                        all_words.append(word)
        else:
            # 如果没有匹配项，按照旧的方式处理
            # 尝试按照中文逗号分割
            topics = topic_words.replace('"', '').split('，')
            
            # 对于每个主题，按照英文逗号分割单个词
            for topic in topics:
                words = topic.split(',')
                for word in words:
                    word = word.strip()  # 去除空格
                    if word:  # 确保单词不为空
                        all_words.append(word)
    
    # 统计词频
    word_counts = collections.Counter(all_words)
    
    print(f"总共提取到 {len(all_words)} 个词，有 {len(word_counts)} 个不同的词")
    
    # 限制词数，避免词云过于拥挤
    # if len(word_counts) > 100:
    #     word_counts = collections.Counter(dict(word_counts.most_common(100)))
    
    return word_counts

# 生成词云图
def generate_wordcloud(word_counts, max_words=200):
    # 加载mask图片
    mask_path = os.path.join('..', 'ciyuntu', 'ciyun1.png')
    
    try:
        mask_img = Image.open(mask_path).convert('RGBA')
    except FileNotFoundError:
        mask_path = os.path.join('ciyuntu', 'ciyun1.png')
        mask_img = Image.open(mask_path).convert('RGBA')
    
    print(f"成功加载蒙版图片: {mask_path}")
    print(f"原始蒙版图片尺寸(PIL格式): {mask_img.size}")
    mask_data = np.array(mask_img)
    
    # 创建一个只在轮廓内部有值的mask
    mask = np.zeros(mask_data.shape[:2], np.uint8)
    mask[mask_data[:, :, 3] <= 50] = 255  # 不透明区域（轮廓内部）
    mask[mask_data[:, :, 3] > 50] = 0     # 透明区域（轮廓外部）
    
    # 清理mask噪点
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    # 创建缩小的内部mask，避免文字太靠近边缘
    erosion_kernel = np.ones((5, 5), np.uint8)
    inner_mask = cv2.erode(mask, erosion_kernel, iterations=1)
    
    print(f"蒙版numpy数组尺寸: {mask.shape}")
    print(f"蒙版中非零像素数量: {np.count_nonzero(mask)}")
    print(f"内部蒙版中非零像素数量: {np.count_nonzero(inner_mask)}")
    
    # 设置词云参数
    font_path = 'C:\\Windows\\Fonts\\simhei.ttf'
    
    # 创建图像颜色生成器
    image_colors = ImageColorGenerator(mask_data)
    
    try:
        wordcloud = WordCloud(
            background_color=None,  # 透明背景
            mask=inner_mask,
            max_words=max_words,
            max_font_size=35,       # 增大最大字体大小
            min_font_size=6,        # 减小最小字体大小
            prefer_horizontal=0.7,
            relative_scaling=0.3,   # 增加词频对字体大小的影响
            margin=3,               # 减小词间距，让更多词显示
            font_path=font_path,
            width=mask.shape[1],
            height=mask.shape[0],
            mode='RGBA',
            contour_width=0,
            include_numbers=False,
            min_word_length=1,
            random_state=42,
            scale=2,
            normalize_plurals=False,
            collocations=False
        ).generate_from_frequencies(word_counts)
        
        if wordcloud is None or len(wordcloud.words_) == 0:
            print("警告：词云生成失败或为空！")
            return

        print(f"词云中的词语数量: {len(wordcloud.words_)}")
        print(f"前10个词和它们的相对大小:")
        for word, size in list(wordcloud.words_.items())[:10]:
            print(f"  {word}: {size:.2f}")
        
        # 使用图像颜色为词云着色
        colored_wordcloud = wordcloud.recolor(color_func=image_colors)
        
        # 获取词云图像
        wordcloud_img = colored_wordcloud.to_array()
        
        # 创建一个全透明的背景图像
        result = np.zeros(shape=wordcloud_img.shape, dtype=np.uint8)
        
        # 调整mask的大小以匹配wordcloud_img的大小
        img_height, img_width = wordcloud_img.shape[:2]
        resized_mask = cv2.resize(mask, (img_width, img_height), interpolation=cv2.INTER_NEAREST)
        
        # 设置轮廓外部为黑色（轮廓外部是mask值为0的区域）
        for i in range(3):  # RGB通道
            result[:, :, i][resized_mask == 0] = 0  # 黑色
        result[:, :, 3][resized_mask == 0] = 255  # 轮廓外部不透明
        
        # 将词云内容复制到结果图像中（只在有文字的地方）
        word_mask = wordcloud_img[:, :, 3] > 0
        for i in range(4):  # RGBA所有通道
            result[:, :, i][word_mask] = wordcloud_img[:, :, i][word_mask]
        
        # 保存结果
        output_path = os.path.abspath('wordcloud_output.png')
        Image.fromarray(result).save(output_path)
        print(f"词云图已保存到: {output_path}")
        
        # 显示带颜色的词云图
        plt.figure(figsize=(12, 10), dpi=300)
        plt.imshow(result)
        plt.axis('off')
        plt.tight_layout(pad=0)
        preview_path = os.path.abspath('wordcloud_preview.png')
        plt.savefig(preview_path, format='PNG', dpi=300, bbox_inches='tight', transparent=True)
        print(f"预览图已保存到: {preview_path}")
        
    except Exception as e:
        print(f"生成词云图像时出错: {str(e)}")
        traceback.print_exc()

def main():
    print("开始生成词云图...")
    
    # 获取topicWords数据
    topic_words_data = get_topic_words()
    
    if not topic_words_data:
        print("错误：没有从数据库获取到任何数据！")
        return
        
    # 处理数据，统计词频
    word_counts = process_topic_words(topic_words_data)
    
    if not word_counts:
        print("错误：没有提取到任何词！")
        return
    
    # 不限制词数，显示更多词
    # 将注释掉原有的限制代码
    # if len(word_counts) > 100:
    #     word_counts = collections.Counter(dict(word_counts.most_common(100)))
    
    # 将所有词频统计结果保存到CSV文件
    print("保存所有词频统计结果到CSV文件...")
    word_freq_df = pd.DataFrame(list(word_counts.items()), columns=['词语', '频率'])
    word_freq_df = word_freq_df.sort_values(by='频率', ascending=False)
    csv_path = os.path.join('all_word_frequencies.csv')
    word_freq_df.to_csv(csv_path, index=False, encoding='utf-8-sig')  # 使用utf-8-sig编码确保Excel正确显示中文
    print(f"所有词频统计结果已保存到: {os.path.abspath(csv_path)}")
    
    # 打印词频统计摘要信息
    print(f"\n词频统计摘要：")
    print(f"总词数：{len(word_counts)}个不同的词")
    print(f"最高词频：{max(word_counts.values())}")
    print(f"最低词频：{min(word_counts.values())}")
    
    # 打印前20个最常见的词
    print("\n出现频率最高的20个词：")
    for word, count in word_counts.most_common(20):
        print(f"{word}: {count}")
    
    # 统计词频最大的五个词
    print("\n词频最大的五个词：")
    top_words = word_counts.most_common(5)
    for word, count in top_words:
        print(f"{word}: {count}")
    
    # 统计词频中间的五个词
    all_words_sorted = list(word_counts.items())
    all_words_sorted.sort(key=lambda x: x[1], reverse=True)
    total_words = len(all_words_sorted)
    mid_index = total_words // 2 - 2
    print(f"\n词频中间的五个词（总词数：{total_words}）：")
    for i in range(mid_index, mid_index + 5):
        if 0 <= i < total_words:
            word, count = all_words_sorted[i]
            print(f"{word}: {count}")
    
    # 统计词频较小的五个词
    print("\n词频较小的五个词：")
    min_words = []
    for word, count in reversed(all_words_sorted):
        if count > 1:
            min_words.append((word, count))
        if len(min_words) >= 5:
            break
    if len(min_words) < 5:
        for word, count in reversed(all_words_sorted):
            if count == 1 and (word, count) not in min_words:
                min_words.append((word, count))
            if len(min_words) >= 5:
                break
    for word, count in min_words:
        print(f"{word}: {count}")
    
    # 生成词云图
    generate_wordcloud(word_counts)
    
    print("\n词云图生成完成！")
    print("输出文件：")
    print(f"  - {os.path.abspath('wordcloud_output.png')}")
    print(f"  - {os.path.abspath('wordcloud_preview.png')}")
    print(f"  - {os.path.abspath(csv_path)}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"错误：{str(e)}")
        traceback.print_exc()