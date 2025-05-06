#!/usr/bin/env python
# -*- coding: utf-8 -*-

import pandas as pd
import pymysql
import os
import re

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '123456',
    'charset': 'utf8mb4'
}

# 定义数据库名称
DB_NAME = 'poet_timeline_db'

# Excel文件路径
EXCEL_FILES = [
    'D:/01/lunwen/processdata/诗人数据/曾懿详细信息.xlsx',
    'D:/01/lunwen/processdata/诗人数据/宗婉详细信息.xlsx',
    'D:/01/lunwen/processdata/诗人数据/左锡嘉详细信息.xlsx'
]

# 对应的诗人ID和名称
POET_INFO = {
    '曾懿详细信息.xlsx': {'id': 1, 'name': '曾懿', 'birth_year': 1853, 'death_year': 1927},
    '宗婉详细信息.xlsx': {'id': 2, 'name': '宗婉', 'birth_year': 1810, 'death_year': 1900},
    '左錫嘉详细信息.xlsx': {'id': 3, 'name': '左錫嘉', 'birth_year': 1831, 'death_year': 1894}
}

def create_database_and_tables():
    """创建数据库和表"""
    # 连接MySQL服务器（不指定数据库）
    conn = pymysql.connect(
        host=DB_CONFIG['host'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        charset=DB_CONFIG['charset']
    )
    
    try:
        with conn.cursor() as cursor:
            # 创建数据库
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"数据库 {DB_NAME} 已创建或已存在")
            
            # 使用创建的数据库
            cursor.execute(f"USE {DB_NAME}")
            
            # 创建诗人表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS poets (
                id INT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                birth_year INT,
                death_year INT,
                description TEXT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("诗人表已创建")
            
            # 创建时间线表
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS poet_timelines (
                id INT AUTO_INCREMENT PRIMARY KEY,
                poet_id INT NOT NULL,
                time_period VARCHAR(100),
                start_year INT,
                end_year INT,
                location TEXT,
                poem_id_range VARCHAR(100),
                event TEXT,
                notes TEXT,
                FOREIGN KEY (poet_id) REFERENCES poets(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("时间线表已创建")
            
        conn.commit()
        print("数据库和表创建成功")
        
    except Exception as e:
        print(f"创建数据库和表时出错: {e}")
        
    finally:
        conn.close()

def parse_time_period(time_period):
    """解析时间段字符串，返回开始和结束年份"""
    if not time_period or pd.isna(time_period):
        return None, None
    
    # 处理单一年份
    if re.match(r'^\d{4}$', str(time_period)):
        year = int(time_period)
        return year, year
    
    # 处理年份范围 (如 "1853-1863")
    match = re.match(r'^(\d{4})-(\d{4})$', str(time_period))
    if match:
        start_year = int(match.group(1))
        end_year = int(match.group(2))
        return start_year, end_year
    
    return None, None

def parse_poem_id_range(poem_id_range):
    """解析诗歌ID范围字符串"""
    if not poem_id_range or pd.isna(poem_id_range):
        return None
    
    return str(poem_id_range)

def insert_poet_data():
    """插入诗人数据"""
    conn = pymysql.connect(
        host=DB_CONFIG['host'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        db=DB_NAME,
        charset=DB_CONFIG['charset']
    )
    
    try:
        with conn.cursor() as cursor:
            # 插入诗人数据
            for filename, info in POET_INFO.items():
                cursor.execute("""
                INSERT INTO poets (id, name, birth_year, death_year, description)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    birth_year = VALUES(birth_year),
                    death_year = VALUES(death_year),
                    description = VALUES(description)
                """, (
                    info['id'],
                    info['name'],
                    info['birth_year'],
                    info['death_year'],
                    f"{info['name']}，生于{info['birth_year']}年，卒于{info['death_year']}年，清代女诗人。"
                ))
                print(f"诗人 {info['name']} 数据已插入")
                
        conn.commit()
        print("诗人数据插入成功")
        
    except Exception as e:
        print(f"插入诗人数据时出错: {e}")
        
    finally:
        conn.close()

def insert_timeline_data():
    """从Excel文件读取并插入时间线数据"""
    conn = pymysql.connect(
        host=DB_CONFIG['host'],
        user=DB_CONFIG['user'],
        password=DB_CONFIG['password'],
        db=DB_NAME,
        charset=DB_CONFIG['charset']
    )
    
    try:
        # 清空现有的时间线数据
        with conn.cursor() as cursor:
            cursor.execute("TRUNCATE TABLE poet_timelines")
            print("已清空时间线表数据")
        
        # 读取并插入每个Excel文件的数据
        for excel_file in EXCEL_FILES:
            filename = os.path.basename(excel_file)
            if filename not in POET_INFO:
                print(f"警告：未找到 {filename} 的诗人信息配置，跳过")
                continue
                
            poet_id = POET_INFO[filename]['id']
            print(f"正在处理 {filename}，诗人ID: {poet_id}")
            
            # 读取Excel文件
            df = pd.read_excel(excel_file)
            print(f"从 {filename} 读取了 {len(df)} 行数据")
            
            # 插入数据
            with conn.cursor() as cursor:
                for idx, row in df.iterrows():
                    time_period = row.get('Time', None)
                    location = row.get('Location', None)
                    poem_id_range = row.get('poemId', None)
                    event = row.get('Event', None)
                    notes = row.get('Unnamed: 4', None) if 'Unnamed: 4' in df.columns else None
                    
                    # 解析时间段
                    start_year, end_year = parse_time_period(time_period)
                    
                    # 解析诗歌ID范围
                    poem_id_str = parse_poem_id_range(poem_id_range)
                    
                    # 插入数据
                    cursor.execute("""
                    INSERT INTO poet_timelines 
                    (poet_id, time_period, start_year, end_year, location, poem_id_range, event, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        poet_id,
                        str(time_period) if time_period and not pd.isna(time_period) else None,
                        start_year,
                        end_year,
                        str(location) if location and not pd.isna(location) else None,
                        poem_id_str,
                        str(event) if event and not pd.isna(event) else None,
                        str(notes) if notes and not pd.isna(notes) else None
                    ))
                    
            conn.commit()
            print(f"{filename} 的时间线数据已插入")
            
        print("所有时间线数据已插入")
        
    except Exception as e:
        print(f"插入时间线数据时出错: {e}")
        conn.rollback()
        
    finally:
        conn.close()

def main():
    """主函数"""
    print("开始创建诗人时间线数据库...")
    
    # 创建数据库和表
    create_database_and_tables()
    
    # 插入诗人数据
    insert_poet_data()
    
    # 插入时间线数据
    insert_timeline_data()
    
    print("数据库创建和数据导入完成！")

if __name__ == "__main__":
    main()