import csv
import pymysql
import os
import pandas as pd
import argparse
from pymysql.cursors import DictCursor

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'database': 'lunwen',
    'charset': 'utf8mb4'
}

# 文件路径
EVENTS_FILE = r"D:\01\lunwen\processdata\events\重要事件.xlsx"
EMOTIONS_FILE = r"D:\01\lunwen\processdata\events\emotion-Prob-fixed-int.csv"

def connect_to_db():
    """连接到数据库"""
    try:
        connection = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            charset=DB_CONFIG['charset'],
            cursorclass=DictCursor
        )
        print("数据库连接成功")
        return connection
    except Exception as e:
        print(f"数据库连接失败: {e}")
        return None

def create_tables(connection):
    """创建必要的表（如果不存在）"""
    try:
        with connection.cursor() as cursor:
            # 先删除现有的emotion_probabilities表
            cursor.execute("DROP TABLE IF EXISTS emotion_probabilities")
            print("已删除旧的emotion_probabilities表")
            
            # 创建重要事件表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS important_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_time VARCHAR(50),
                event_content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            # 创建情感概率表 - 使用poemId代替poem_id匹配poems表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS emotion_probabilities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poemId VARCHAR(255),
                emotion VARCHAR(255),
                le_prob FLOAT,
                ai_prob FLOAT,
                xi_prob FLOAT,
                nu_hao_prob FLOAT,
                si_prob FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_poem_id (poemId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            # 检查poems表是否存在
            cursor.execute("SHOW TABLES LIKE 'poems'")
            if cursor.fetchone():
                # 尝试为emotion_probabilities表添加外键约束
                try:
                    cursor.execute("""
                    ALTER TABLE emotion_probabilities
                    ADD CONSTRAINT fk_poem_id
                    FOREIGN KEY (poemId) REFERENCES poems(poemId);
                    """)
                    print("成功添加外键约束")
                except Exception as e:
                    print(f"添加外键约束失败: {e}")
                    print("将继续使用没有外键约束的表")
            else:
                print("poems表不存在，无法添加外键约束")
            
            connection.commit()
            print("表创建成功")
    except Exception as e:
        print(f"表创建失败: {e}")

def get_valid_poem_ids(connection):
    """获取poems表中的所有有效poemId"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT poemId FROM poems")
            result = cursor.fetchall()
            # 将结果转换为整数集合，以便快速查找
            return {int(row['poemId']) for row in result}
    except Exception as e:
        print(f"获取有效poemId失败: {e}")
        return set()

def import_important_events_xlsx(connection, excel_file):
    """导入重要事件数据（Excel格式）"""
    try:
        print(f"尝试读取Excel文件: {excel_file}")
        # 使用pandas读取Excel文件
        df = pd.read_excel(excel_file)
        
        # 显示前几行数据和列名，帮助确认格式
        print(f"Excel文件列名: {df.columns.tolist()}")
        print(f"前5行数据:\n{df.head()}")
        
        # 检查列数
        if len(df.columns) < 2:
            print(f"警告: Excel文件列数不足，需要至少2列（时间和事件内容）。实际列数: {len(df.columns)}")
            return
            
        # 尝试确定哪些列包含时间和事件内容
        time_col = None
        event_col = None
        
        # 如果列名包含明确的提示词，自动识别列
        for col in df.columns:
            col_lower = str(col).lower()
            if '时间' in col_lower or 'time' in col_lower or 'date' in col_lower:
                time_col = col
            elif '事件' in col_lower or '内容' in col_lower or 'event' in col_lower or 'content' in col_lower:
                event_col = col
        
        # 如果无法自动识别，则使用前两列
        if time_col is None or event_col is None:
            print("无法自动识别时间和事件列，默认使用前两列")
            time_col = df.columns[0]
            event_col = df.columns[1]
            
        print(f"使用列 '{time_col}' 作为时间，列 '{event_col}' 作为事件内容")
        
        # 插入数据
        with connection.cursor() as cursor:
            inserted_count = 0
            for _, row in df.iterrows():
                # 获取并转换数据
                event_time = str(row[time_col])
                event_content = str(row[event_col])
                
                # 过滤掉可能的NaN或空值
                if event_time.lower() == 'nan' or event_content.lower() == 'nan':
                    continue
                    
                # 插入数据
                cursor.execute(
                    "INSERT INTO important_events (event_time, event_content) VALUES (%s, %s)",
                    (event_time, event_content)
                )
                inserted_count += 1
            
            connection.commit()
            print(f"成功导入 {inserted_count} 条重要事件数据")
    except Exception as e:
        print(f"导入Excel文件失败: {e}")

def import_emotion_probabilities(connection, csv_file, force_import=False):
    """导入情感概率数据
    
    Args:
        connection: 数据库连接
        csv_file: CSV文件路径
        force_import: 是否强制导入，即使poemId在poems表中不存在
    """
    try:
        # 先检查表是否为空，如果不为空则清空
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM emotion_probabilities")
            result = cursor.fetchone()
            if result['count'] > 0:
                print("情感概率表已有数据，将先清空")
                cursor.execute("TRUNCATE TABLE emotion_probabilities")
                connection.commit()
        
        # 获取有效的poemId列表
        valid_poem_ids = set()
        if not force_import:
            valid_poem_ids = get_valid_poem_ids(connection)
            if valid_poem_ids:
                print(f"从poems表中获取了 {len(valid_poem_ids)} 个有效的poemId")
            else:
                print("警告: 未能从poems表中获取有效的poemId，将不进行验证")
                if not force_import:
                    print("如需强制导入，请使用--force参数")
        else:
            print("强制导入模式：将导入所有数据，不验证poemId是否存在")
        
        # 使用已知可以工作的编码
        with open(csv_file, 'r', encoding='utf-8-sig') as file:
            print("使用utf-8-sig编码读取情感概率文件")
            csv_reader = csv.reader(file)
            # 跳过标题行
            header = next(csv_reader, None)
            print(f"标题行: {header}")
            
            with connection.cursor() as cursor:
                inserted_count = 0
                skipped_count = 0
                invalid_poem_id_count = 0
                
                for row in csv_reader:
                    if len(row) >= 7:  # 确保行有足够的数据
                        try:
                            # 将poemId转换为整数
                            poem_id = int(row[0].strip())
                            
                            # 验证poem_id是否存在于poems表中
                            if not force_import and valid_poem_ids and poem_id not in valid_poem_ids:
                                print(f"警告: poemId {poem_id} 在poems表中不存在")
                                invalid_poem_id_count += 1
                                continue
                            
                            emotion = row[1].strip()
                            
                            # 处理空值或非数值字段
                            try:
                                le_prob = float(row[2]) if row[2].strip() else 0.0
                            except ValueError:
                                le_prob = 0.0
                                
                            try:
                                ai_prob = float(row[3]) if row[3].strip() else 0.0
                            except ValueError:
                                ai_prob = 0.0
                                
                            try:
                                xi_prob = float(row[4]) if row[4].strip() else 0.0
                            except ValueError:
                                xi_prob = 0.0
                                
                            try:
                                nu_hao_prob = float(row[5]) if row[5].strip() else 0.0
                            except ValueError:
                                nu_hao_prob = 0.0
                                
                            try:
                                si_prob = float(row[6]) if row[6].strip() else 0.0
                            except ValueError:
                                si_prob = 0.0
                            
                            # 插入数据 - 使用poemId作为字段名，确保是整数
                            cursor.execute(
                                "INSERT INTO emotion_probabilities (poemId, emotion, le_prob, ai_prob, xi_prob, nu_hao_prob, si_prob) "
                                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                                (str(poem_id), emotion, le_prob, ai_prob, xi_prob, nu_hao_prob, si_prob)
                            )
                            inserted_count += 1
                        except ValueError as ve:
                            print(f"警告: poemId格式错误 {row[0]}: {ve}")
                            skipped_count += 1
                    else:
                        print(f"警告: 行数据不完整 {row}")
                        skipped_count += 1
                
                connection.commit()
                print(f"成功导入 {inserted_count} 条情感概率数据，跳过 {skipped_count} 条无效数据")
                if invalid_poem_id_count > 0:
                    print(f"有 {invalid_poem_id_count} 条数据的poemId在poems表中不存在")
    except Exception as e:
        print(f"导入情感概率数据失败: {e}")

def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='导入重要事件和情感概率数据到数据库')
    parser.add_argument('--force', action='store_true', help='强制导入情感数据，即使poemId不存在于poems表')
    return parser.parse_args()

def main():
    # 解析命令行参数
    args = parse_arguments()
    force_import = args.force
    
    connection = connect_to_db()
    if not connection:
        return
    
    try:
        # 创建表
        create_tables(connection)
        
        # 导入重要事件数据（Excel格式）
        if os.path.exists(EVENTS_FILE):
            import_important_events_xlsx(connection, EVENTS_FILE)
        else:
            print(f"找不到文件: {EVENTS_FILE}")
        
        # 导入情感概率数据
        if os.path.exists(EMOTIONS_FILE):
            import_emotion_probabilities(connection, EMOTIONS_FILE, force_import)
        else:
            print(f"找不到文件: {EMOTIONS_FILE}")
            
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        connection.close()
        print("数据库连接已关闭")

if __name__ == "__main__":
    main()