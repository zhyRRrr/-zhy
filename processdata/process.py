import mysql.connector
from mysql.connector import Error

def create_poet_summary_table():
    """创建诗人基本信息汇总表"""
    try:
        # 连接数据库
        db_config = {
            'host': 'localhost',
            'user': 'root',
            'password': '123456',
            'database': 'lunwen'
        }
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        
        # 删除表（如果存在）并重新创建
        drop_table_query = """
        DROP TABLE IF EXISTS poet_summary;
        """
        cursor.execute(drop_table_query)
        print("已删除旧表（如果存在）")
        
        # 创建表结构
        create_table_query = """
        CREATE TABLE poet_summary (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poet_id INT NOT NULL,
            poet_name VARCHAR(50) NOT NULL,
            birth_year INT,
            death_year INT,
            poem_count INT DEFAULT 0,
            FOREIGN KEY (poet_id) REFERENCES poet(poetID)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
        
        cursor.execute(create_table_query)
        conn.commit()
        print("表创建成功！")
        
        # 获取所有poetName列表
        cursor.execute("SELECT DISTINCT poetName FROM poems")
        poet_names = [row[0] for row in cursor.fetchall()]
        print(f"找到{len(poet_names)}个不同的诗人名")
        
        # 获取所有诗人信息
        placeholders = ', '.join(['%s'] * len(poet_names))
        query = f"""SELECT poetID, NameHZ, StartYear, EndYear 
                   FROM poet 
                   WHERE NameHZ IN ({placeholders})"""
        cursor.execute(query, poet_names)
        poets = cursor.fetchall()
        print(f"成功匹配到{len(poets)}位诗人的信息")
        
        # 为每个诗人计算诗词总量并插入数据
        for poet_record in poets:
            poet_id = poet_record[0]
            poet_name = poet_record[1]
            birth_year = poet_record[2]
            death_year = poet_record[3]
            
            # 获取诗人的诗歌总数
            count_query = "SELECT COUNT(*) as poem_count FROM poems WHERE poetName = %s"
            cursor.execute(count_query, (poet_name,))
            result = cursor.fetchone()
            poem_count = result[0] if result else 0
            
            # 插入诗人汇总信息
            insert_query = """
            INSERT INTO poet_summary (poet_id, poet_name, birth_year, death_year, poem_count) 
            VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(insert_query, (poet_id, poet_name, birth_year, death_year, poem_count))
            
            print(f"已插入诗人: {poet_name}, 出生年: {birth_year}, 去世年: {death_year}, 诗词总量: {poem_count}")
        
        conn.commit()
        print(f"成功为{len(poets)}位诗人生成汇总信息")
        
    except Error as e:
        print(f"数据库错误: {e}")
        if conn and conn.is_connected():
            conn.rollback()
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()
            print("数据库连接已关闭")

if __name__ == "__main__":
    create_poet_summary_table()