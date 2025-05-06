import os
import pymysql
import numpy as np
import pandas as pd
from wordcloud import WordCloud, ImageColorGenerator, STOPWORDS
from matplotlib import pyplot as plt
from PIL import Image
import collections
import re
import cv2
import traceback
import hashlib
import matplotlib
import tkinter as tk
from tkinter import ttk
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import argparse

# 设置matplotlib支持中文显示
matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'SimSun', 'Arial Unicode MS']  # 优先使用的字体系列
matplotlib.rcParams['axes.unicode_minus'] = False  # 解决负号'-'显示为方块的问题
matplotlib.rcParams['font.family'] = 'sans-serif'

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

# 获取所有诗人列表
def get_poets():
    connection = connect_to_mysql()
    try:
        with connection.cursor() as cursor:
            # 从poems表中获取所有诗人名称
            sql = "SELECT DISTINCT poetName FROM poems ORDER BY poetName"
            cursor.execute(sql)
            results = cursor.fetchall()
            poets = [result[0] for result in results if result[0]]
            return poets
    finally:
        connection.close()

# 根据诗人获取topicWords数据
def get_topic_words_by_poet(poet_name=None):
    connection = connect_to_mysql()
    try:
        with connection.cursor() as cursor:
            if poet_name and poet_name != "全部诗人":
                # 根据诗人名筛选topicWords
                sql = """
                SELECT t.topicWords 
                FROM topic t
                JOIN poems p ON t.poemId = p.poemId
                WHERE p.poetName = %s
                """
                cursor.execute(sql, (poet_name,))
            else:
                # 获取所有topicWords
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
    
    return word_counts

# 加载停用词列表
def load_stopwords():
    stopwords = set(STOPWORDS)
    # 在这里添加基本中文停用词
    chinese_stopwords = {'的', '了', '和', '是', '在', '我', '有', '与', '这', '那', '你', '他', '她', '它'}
    stopwords.update(chinese_stopwords)
    
    # 尝试从stopwords2.txt文件加载停用词
    stopwords_paths = [
        os.path.join('processdata', 'ciyuntu', 'stopwords2.txt'),
        os.path.join('..', 'ciyuntu', 'stopwords2.txt'),
        os.path.join('ciyuntu', 'stopwords2.txt'),
        os.path.abspath(os.path.join('D:', '01', 'lunwen', 'processdata', 'ciyuntu', 'stopwords2.txt'))
    ]
    
    loaded = False
    for path in stopwords_paths:
        try:
            print(f"尝试从 {path} 加载停用词列表")
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    word = line.strip()
                    if word:  # 确保单词不为空
                        stopwords.add(word)
            print(f"成功从 {path} 加载停用词")
            loaded = True
            break
        except FileNotFoundError:
            continue
    
    if not loaded:
        print("警告: 无法加载stopwords2.txt文件，将只使用基本停用词")
    else:
        print(f"总共加载了 {len(stopwords)} 个停用词")
    
    return stopwords

# 检查并确保字体文件存在
def ensure_font_exists():
    # 常见的中文字体路径
    font_paths = [
        'C:\\Windows\\Fonts\\simhei.ttf',  # Windows黑体
        'C:\\Windows\\Fonts\\simkai.ttf',  # Windows楷体
        'C:\\Windows\\Fonts\\simsun.ttc',  # Windows宋体
        'C:\\Windows\\Fonts\\msyh.ttc',    # Windows微软雅黑
        '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',  # Linux文泉驿微米黑
        '/System/Library/Fonts/PingFang.ttc'  # macOS苹方
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            print(f"使用字体: {font_path}")
            return font_path
    
    # 如果找不到任何字体，给出警告并使用默认路径
    print("警告: 找不到任何中文字体文件，将使用默认字体路径，可能导致中文显示为方块")
    return 'C:\\Windows\\Fonts\\simhei.ttf'

# 生成词云图
def generate_wordcloud(word_counts, max_words=2000):
    if not word_counts:
        return None, None
        
    # 加载mask图片
    mask_paths = [
        os.path.join('..', 'ciyuntu', 'ciyun1.png'),
        os.path.join('ciyuntu', 'ciyun1.png'),
        os.path.join('processdata', 'ciyuntu', 'ciyun1.png'),
        os.path.join('..', '..', 'processdata', 'ciyuntu', 'ciyun1.png'),
        os.path.abspath(os.path.join('D:', '01', 'lunwen', 'processdata', 'ciyuntu', 'ciyun1.png'))
    ]
    
    mask_img = None
    for mask_path in mask_paths:
        try:
            print(f"尝试加载蒙版图片: {mask_path}")
            mask_img = Image.open(mask_path).convert('RGBA')
            print(f"成功加载蒙版图片: {mask_path}")
            break
        except FileNotFoundError:
            continue
    
    if mask_img is None:
        print("错误：无法找到蒙版图片。请确保文件存在并提供正确的路径。")
        print("请将蒙版图片放在以下路径之一：")
        for path in mask_paths:
            print(f"  - {os.path.abspath(path)}")
        return None, None
    
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
    font_path = ensure_font_exists()
    
    # 加载停用词
    stopwords = load_stopwords()
    
    # 创建图像颜色生成器
    image_colors = ImageColorGenerator(mask_data)
    
    try:
        wordcloud = WordCloud(
            background_color="white",  # 改为白色背景
            mask=inner_mask,
            max_words=max_words,
            max_font_size=45,       # 降低最大字体大小（原为60）
            min_font_size=8,        # 添加最小字体大小
            stopwords=stopwords,    # 添加停用词
            prefer_horizontal=0.9,
            relative_scaling=0.5,   # 降低词频对字体大小的影响
            font_path=font_path,    # 使用已确认存在的字体
            width=mask.shape[1],
            height=mask.shape[0],
            random_state=42,
            # 添加额外参数以支持中文
            collocations=False,     # 避免词组重复
            regexp=r"[\w\u4e00-\u9fa5]+"  # 增加对中文字符的支持
        ).generate_from_frequencies(word_counts)
        
        if wordcloud is None or len(wordcloud.words_) == 0:
            print("警告：词云生成失败或为空！")
            return None, None

        print(f"词云中的词语数量: {len(wordcloud.words_)}")
        print(f"前10个词和它们的相对大小:")
        for word, size in list(wordcloud.words_.items())[:10]:
            print(f"  {word}: {size:.2f}")
        
        # 使用图像颜色为词云着色
        colored_wordcloud = wordcloud.recolor(color_func=image_colors)
        
        return wordcloud, colored_wordcloud
        
    except Exception as e:
        print(f"生成词云图像时出错: {str(e)}")
        traceback.print_exc()
        return None, None

# 创建交互式GUI应用
class WordCloudApp:
    def __init__(self, root):
        self.root = root
        self.root.title("诗人词云图生成器")
        self.root.geometry("1200x800")
        
        # 设置窗口关闭事件处理
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # 创建顶部框架，用于放置下拉菜单
        self.top_frame = ttk.Frame(root, padding="10")
        self.top_frame.pack(fill=tk.X)
        
        # 创建诗人选择标签和下拉框
        ttk.Label(self.top_frame, text="选择诗人:").pack(side=tk.LEFT, padx=5)
        
        # 获取所有诗人列表
        self.poets = ["全部诗人"] + get_poets()
        
        # 创建诗人选择的下拉框
        self.poet_var = tk.StringVar()
        self.poet_combobox = ttk.Combobox(self.top_frame, textvariable=self.poet_var, values=self.poets, state="readonly", width=30)
        self.poet_combobox.current(0)  # 默认选择第一个选项
        self.poet_combobox.pack(side=tk.LEFT, padx=5)
        
        # 创建生成按钮
        self.generate_button = ttk.Button(self.top_frame, text="生成词云图", command=self.generate_wordcloud)
        self.generate_button.pack(side=tk.LEFT, padx=20)
        
        # 创建保存按钮
        self.save_button = ttk.Button(self.top_frame, text="保存词云图", command=self.save_wordcloud)
        self.save_button.pack(side=tk.LEFT, padx=5)
        
        # 创建状态标签
        self.status_var = tk.StringVar()
        self.status_var.set("就绪")
        self.status_label = ttk.Label(self.top_frame, textvariable=self.status_var)
        self.status_label.pack(side=tk.RIGHT, padx=10)
        
        # 创建主要显示区域框架
        self.main_frame = ttk.Frame(root)
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 初始化matplotlib图形
        self.fig, self.axes = plt.subplots(1, 3, figsize=(12, 6))
        
        # 创建canvas用于显示matplotlib图形
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.main_frame)
        self.canvas_widget = self.canvas.get_tk_widget()
        self.canvas_widget.pack(fill=tk.BOTH, expand=True)
        
        # 初始化词云图
        self.wordcloud = None
        self.colored_wordcloud = None
        self.mask_img = None
        
        # 首次加载词云图
        self.generate_wordcloud()
    
    def on_closing(self):
        """处理窗口关闭事件"""
        print("关闭应用程序...")
        # 关闭所有matplotlib图形
        plt.close('all')
        # 销毁根窗口
        self.root.destroy()
        # 确保程序完全退出
        import sys
        sys.exit(0)
        
    def generate_wordcloud(self):
        """根据选定的诗人生成词云图"""
        selected_poet = self.poet_var.get()
        self.status_var.set(f"正在生成 {selected_poet} 的词云图...")
        self.root.update()
        
        # 获取选定诗人的主题词
        topic_words_data = get_topic_words_by_poet(selected_poet)
        
        if not topic_words_data:
            self.status_var.set(f"错误：没有获取到 {selected_poet} 的数据！")
            return
            
        # 处理数据，统计词频
        word_counts = process_topic_words(topic_words_data)
        
        if not word_counts:
            self.status_var.set(f"错误：没有从 {selected_poet} 提取到任何词！")
            return
        
        # 保存所有词频统计结果到CSV文件
        print("保存所有词频统计结果到CSV文件...")
        word_freq_df = pd.DataFrame(list(word_counts.items()), columns=['词语', '频率'])
        word_freq_df = word_freq_df.sort_values(by='频率', ascending=False)
        
        poet_name = selected_poet.replace(" ", "_")
        if poet_name == "全部诗人":
            csv_path = os.path.join('all_poets_word_frequencies.csv')
        else:
            csv_path = os.path.join(f'{poet_name}_word_frequencies.csv')
            
        word_freq_df.to_csv(csv_path, index=False, encoding='utf-8-sig')
        print(f"词频统计结果已保存到: {os.path.abspath(csv_path)}")
        
        # 生成词云图
        self.wordcloud, self.colored_wordcloud = generate_wordcloud(word_counts, max_words=2000)
        
        if self.wordcloud is None:
            self.status_var.set("词云生成失败！")
            return
            
        # 清除之前的图形
        for ax in self.axes:
            ax.clear()
            
        # 加载mask图片 - 使用相同的路径列表
        mask_paths = [
            os.path.join('..', 'ciyuntu', 'ciyun1.png'),
            os.path.join('ciyuntu', 'ciyun1.png'),
            os.path.join('processdata', 'ciyuntu', 'ciyun1.png'),
            os.path.join('..', '..', 'processdata', 'ciyuntu', 'ciyun1.png'),
            os.path.abspath(os.path.join('D:', '01', 'lunwen', 'processdata', 'ciyuntu', 'ciyun1.png'))
        ]
        
        self.mask_img = None
        for mask_path in mask_paths:
            try:
                self.mask_img = Image.open(mask_path).convert('RGBA')
                break
            except FileNotFoundError:
                continue
                
        if self.mask_img is None:
            # 如果无法加载图片，使用一个空白图像代替
            self.mask_img = Image.new('RGBA', (100, 100), 'white')
        
        # 显示原始词云
        self.axes[0].imshow(self.wordcloud, interpolation="bilinear")
        self.axes[0].set_title("原始词云", fontproperties='SimHei')
        self.axes[0].axis("off")
        
        # 显示使用图像颜色的词云
        self.axes[1].imshow(self.colored_wordcloud, interpolation="bilinear")
        self.axes[1].set_title(f"{selected_poet}的词云", fontproperties='SimHei')
        self.axes[1].axis("off")
        
        # 显示原始彩色图像
        self.axes[2].imshow(self.mask_img, interpolation="bilinear")
        self.axes[2].set_title("原始蒙版图像", fontproperties='SimHei')
        self.axes[2].axis("off")
        
        plt.tight_layout()
        self.canvas.draw()
        
        self.status_var.set(f"{selected_poet}的词云图已生成")
    
    def save_wordcloud(self):
        """保存当前词云图"""
        if self.colored_wordcloud is None:
            self.status_var.set("没有词云图可保存！")
            return
            
        selected_poet = self.poet_var.get()
        poet_name = selected_poet.replace(" ", "_")
        
        # 保存三图对比
        preview_path = os.path.abspath(f'{poet_name}_wordcloud_preview.png')
        self.fig.savefig(preview_path, format='PNG', dpi=300, bbox_inches='tight')
        
        # 单独保存彩色词云
        plt.figure(figsize=(12, 10), dpi=300)
        plt.imshow(self.colored_wordcloud, interpolation="bilinear")
        plt.axis('off')
        plt.tight_layout(pad=0)
        output_path = os.path.abspath(f'{poet_name}_wordcloud_output.png')
        plt.savefig(output_path, format='PNG', dpi=300, bbox_inches='tight')
        plt.close()
        
        self.status_var.set(f"词云图已保存到 {output_path}")
        print(f"三图对比已保存到: {preview_path}")
        print(f"彩色词云已保存到: {output_path}")

def main():
    print("启动诗人词云图生成器...")
    
    # 设置终端输出编码
    import sys
    import argparse
    
    # 解析命令行参数，但我们默认都启动GUI
    parser = argparse.ArgumentParser(description='诗人词云图生成器')
    parser.add_argument('--poet', type=str, default="全部诗人", help='指定要预先选择的诗人名称')
    args = parser.parse_args()
    
    if sys.stdout.encoding != 'utf-8':
        try:
            # 尝试设置控制台编码为UTF-8
            if sys.platform.startswith('win'):
                import subprocess
                subprocess.run(['chcp', '65001'], shell=True, check=False)
                print("已将控制台编码设置为UTF-8")
        except Exception as e:
            print(f"设置控制台编码失败: {str(e)}")
    
    print("启动GUI模式...")
    # 创建Tkinter根窗口
    root = tk.Tk()
    app = WordCloudApp(root)
    
    # 如果指定了诗人，预先选择该诗人
    if args.poet != "全部诗人":
        if args.poet in app.poets:
            index = app.poets.index(args.poet)
            app.poet_combobox.current(index)
            # 生成指定诗人的词云
            app.generate_wordcloud()
            
    # 运行主循环，当窗口关闭时，程序会自动退出
    root.mainloop()
    print("GUI应用已关闭，程序结束")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"错误：{str(e)}")
        traceback.print_exc()