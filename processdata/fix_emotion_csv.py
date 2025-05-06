import re
import os

# 输入和输出文件路径
INPUT_FILE = r"D:\01\lunwen\processdata\events\emotion-Prob.csv"
OUTPUT_FILE = r"D:\01\lunwen\processdata\events\emotion-Prob-fixed.csv"

def fix_emotion_csv():
    """修复CSV文件，确保所有情感放在一个emotion列中，每列只有一个概率值"""
    try:
        if not os.path.exists(INPUT_FILE):
            print(f"错误: 找不到输入文件 {INPUT_FILE}")
            return False
        
        # 读取原始文件
        with open(INPUT_FILE, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        # 将制表符替换为逗号
        content = content.replace('\t', ',')
        
        # 按行分割
        lines = content.strip().split('\n')
        fixed_lines = []
        
        # 添加标题行
        fixed_lines.append("poemId,emotion,le_prob,ai_prob,xi_prob,nu/hao_prob,si_prob")
        
        # 处理每一行数据
        for line_num, line in enumerate(lines[1:], 1):  # 跳过标题行
            if not line.strip():
                continue
                
            try:
                # 分离poemId
                parts = line.split(',', 1)
                poem_id = parts[0].strip().replace('"', '')  # 移除poemId中可能的引号
                rest_of_line = parts[1] if len(parts) > 1 else ""
                
                # 提取情感部分和概率部分
                emotions = []
                probabilities = []
                
                # 寻找所有可能的概率值
                prob_matches = list(re.finditer(r'(\d+\.\d+)', rest_of_line))
                
                if not prob_matches:
                    print(f"跳过第{line_num}行: 没有找到概率值")
                    continue
                
                # 找到第一个概率的位置
                first_prob_start = prob_matches[0].start()
                
                # 提取情感部分（在第一个概率之前的所有内容）
                emotion_part = rest_of_line[:first_prob_start].strip()
                
                # 清理情感部分中的引号
                emotion_part = emotion_part.replace('"', '')
                
                # 分割情感值（可能是以逗号、空格或制表符分隔的）
                emotion_items = re.split(r'[,\s\t]+', emotion_part)
                emotions = [e.strip() for e in emotion_items if e.strip()]
                
                # 提取概率
                for match in prob_matches[:5]:  # 最多只取前5个概率
                    probabilities.append(match.group(1))
                
                # 确保有5个概率值
                while len(probabilities) < 5:
                    probabilities.append("0.0")
                
                # 只使用前5个概率
                probabilities = probabilities[:5]
                
                # 构建修复后的行，使用逗号加空格分隔情感
                emotion_str = ", ".join(emotions)
                # 确保poemId没有引号，但emotion有引号
                new_line = f'{poem_id},"{emotion_str}",{",".join(probabilities)}'
                fixed_lines.append(new_line)
                
                print(f"已修复第{line_num}行: {poem_id} -> {emotion_str}")
            except Exception as e:
                print(f"处理第{line_num}行时出错: {e}, 行内容: {line}")
                
        # 写入输出文件
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write('\n'.join(fixed_lines))
        
        print(f"\n成功修复CSV文件，已保存到 {OUTPUT_FILE}")
        return True
    
    except Exception as e:
        print(f"处理CSV文件时出错: {str(e)}")
        return False

if __name__ == "__main__":
    # 执行修复
    fix_emotion_csv()
    
    # 显示修复后的结果
    try:
        print("\n修复后的前16行内容：")
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as file:
            for i, line in enumerate(file):
                if i < 16:  # 显示前16行
                    print(f"第{i}行: {line.strip()}")
                else:
                    break
                    
        # 特别显示第12行（之前有问题的行）
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            if len(lines) >= 13:  # 算上标题行，第12行是索引12
                print(f"\n特别检查第12行: {lines[12].strip()}")
    except Exception as e:
        print(f"读取修复后文件时出错: {e}") 