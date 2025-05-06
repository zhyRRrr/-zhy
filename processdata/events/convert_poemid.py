import csv
import os

# 源文件和目标文件路径
SOURCE_FILE = r"D:\01\lunwen\processdata\events\emotion-Prob-fixed.csv"
TARGET_FILE = r"D:\01\lunwen\processdata\events\emotion-Prob-fixed-int.csv"

def convert_poemid_to_int():
    """将CSV文件中的poemId转换为整数格式"""
    try:
        # 确保源文件存在
        if not os.path.exists(SOURCE_FILE):
            print(f"错误: 源文件不存在: {SOURCE_FILE}")
            return
        
        # 读取源文件
        rows = []
        with open(SOURCE_FILE, 'r', encoding='utf-8-sig') as file:
            csv_reader = csv.reader(file)
            header = next(csv_reader, None)  # 获取标题行
            rows.append(header)  # 添加标题行
            
            line_number = 1
            for row in csv_reader:
                line_number += 1
                if len(row) >= 7:
                    try:
                        # 尝试将poemId转换为整数
                        poem_id = int(float(row[0].strip()))
                        # 创建新行，将poemId替换为整数格式
                        new_row = [str(poem_id)] + row[1:]
                        rows.append(new_row)
                    except ValueError:
                        print(f"警告: 第{line_number}行poemId '{row[0]}' 无法转换为整数")
                else:
                    print(f"警告: 第{line_number}行数据不完整，跳过")
        
        # 写入目标文件
        with open(TARGET_FILE, 'w', newline='', encoding='utf-8-sig') as file:
            csv_writer = csv.writer(file)
            csv_writer.writerows(rows)
            
        print(f"转换完成! 共处理 {len(rows)-1} 行数据")
        print(f"新文件已保存至: {TARGET_FILE}")
        
    except Exception as e:
        print(f"转换过程中发生错误: {e}")

if __name__ == "__main__":
    convert_poemid_to_int() 