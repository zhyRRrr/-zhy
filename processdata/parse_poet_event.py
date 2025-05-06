import os
import re
import sys
import pymysql
import pymysql.cursors

# 数据库配置
TIMELINE_DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'database': 'poet_timeline_db',
    'charset': 'utf8mb4'
}

def connect_to_db():
    """连接到数据库"""
    try:
        print("正在连接到数据库...")
        connection = pymysql.connect(**TIMELINE_DB_CONFIG)
        print("数据库连接成功")
        return connection
    except pymysql.Error as e:
        print(f"数据库连接失败: {e}")
        sys.exit(1)

def create_event_table(connection):
    """创建诗人事件表"""
    try:
        with connection.cursor() as cursor:
            # 创建新表，用于存储处理后的事件数据
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS poet_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poet_id INT NOT NULL,
                event_year INT,
                event_content TEXT,
                original_event TEXT,
                start_year INT,
                end_year INT,
                FOREIGN KEY (poet_id) REFERENCES poets(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """)
        
        connection.commit()
        print("诗人事件表创建成功")
    except pymysql.Error as e:
        print(f"创建表失败: {e}")
        connection.rollback()
        sys.exit(1)

def split_multiple_events(event_text):
    """
    将包含多个事件的文本拆分为单独的事件列表
    例如："1875，与丈夫参学自成系；1876，正月生长子袄阴轲，十二月生次子袄阴焘"
    拆分为：["1875，与丈夫参学自成系", "1876，正月生长子袄阴轲，十二月生次子袄阴焘"]
    """
    if not event_text or not isinstance(event_text, str):
        return []
    
    # 使用分号和句号来分割事件
    events = re.split(r'[;；。]', event_text)
    
    # 过滤掉空字符串
    events = [event.strip() for event in events if event.strip()]
    
    # 检查分割后的事件是否有年份，如果没有，可能需要从前面的事件继承年份
    result_events = []
    current_year = None
    
    for event in events:
        # 检查事件是否以年份开头
        year_match = re.match(r'^(\d{4})[,.，、]?\s*(.+)$', event)
        
        if year_match:
            # 如果事件以年份开头，更新当前年份并添加到结果列表
            current_year = year_match.group(1)
            result_events.append(event)
        else:
            # 如果事件没有以年份开头且有可继承的年份，添加年份前缀
            if current_year:
                result_events.append(f"{current_year}，{event}")
            else:
                # 没有可继承的年份，直接添加
                result_events.append(event)
    
    return result_events

def extract_event_year_content(event_text):
    """
    从事件文本中提取年份和事件内容
    例如：从"1862, 父曾味求任安徽女戏协理军务"提取出年份1862和内容"父曾味求任安徽女戏协理军务"
    """
    if not event_text or not isinstance(event_text, str):
        return None, None
    
    # 尝试匹配开头的年份
    year_match = re.match(r'^(\d{4})[,.，、]?\s*(.+)$', event_text.strip())
    if year_match:
        return int(year_match.group(1)), year_match.group(2).strip()
    
    # 如果没有匹配到开头的年份，检查整个字符串是否包含年份
    year_in_text = re.search(r'(\d{4})[,.，、]?\s*', event_text)
    if year_in_text:
        # 提取年份后的内容作为事件内容
        year = int(year_in_text.group(1))
        content = event_text[:year_in_text.start()] + event_text[year_in_text.end():]
        return year, content.strip()
    
    # 如果没有找到年份，返回None和原始内容
    return None, event_text.strip()

def process_timeline_events(connection):
    """处理时间线事件并填充新表"""
    try:
        # 首先清空目标表
        with connection.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE poet_events")
            connection.commit()
            print("目标表已清空，准备导入新数据")
        
        # 查询所有时间线事件
        with connection.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
            SELECT id, poet_id, start_year, end_year, event
            FROM poet_timelines
            WHERE event IS NOT NULL AND event != ''
            """)
            
            timelines = cursor.fetchall()
            print(f"找到 {len(timelines)} 条事件记录需要处理")
            
            # 准备插入语句
            insert_sql = """
            INSERT INTO poet_events 
            (poet_id, event_year, event_content, original_event, start_year, end_year)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            # 逐条处理事件数据
            processed_count = 0
            total_events_count = 0
            
            for timeline in timelines:
                poet_id = timeline['poet_id']
                start_year = timeline['start_year']
                end_year = timeline['end_year']
                original_event_text = timeline['event']
                
                # 先将可能包含多个事件的文本拆分为单独的事件
                event_texts = split_multiple_events(original_event_text)
                
                # 处理每一个单独的事件
                for event_text in event_texts:
                    # 提取事件年份和内容
                    event_year, event_content = extract_event_year_content(event_text)
                    
                    # 如果未能从事件文本中提取年份，使用start_year和end_year的平均值
                    if event_year is None and (start_year is not None or end_year is not None):
                        if start_year is not None and end_year is not None:
                            event_year = (start_year + end_year) // 2
                        elif start_year is not None:
                            event_year = start_year
                        else:
                            event_year = end_year
                    
                    # 插入处理后的数据
                    cursor.execute(insert_sql, (
                        poet_id,
                        event_year,
                        event_content,
                        event_text,
                        start_year,
                        end_year
                    ))
                    
                    total_events_count += 1
                
                processed_count += 1
                if processed_count % 10 == 0:
                    print(f"已处理 {processed_count} 条记录，提取了 {total_events_count} 个事件")
            
            # 提交事务
            connection.commit()
            print(f"共处理了 {processed_count} 条记录，提取了 {total_events_count} 个事件并成功保存")
    
    except pymysql.Error as e:
        print(f"处理事件数据时出错: {e}")
        connection.rollback()
        sys.exit(1)

def main():
    """主函数"""
    print("开始处理诗人时间线事件数据")
    
    # 连接到数据库
    connection = connect_to_db()
    
    try:
        # 创建新的事件表
        create_event_table(connection)
        
        # 处理事件数据
        process_timeline_events(connection)
        
        print("数据处理完成")
    
    finally:
        # 关闭数据库连接
        if connection:
            connection.close()
            print("数据库连接已关闭")

if __name__ == "__main__":
    main() 