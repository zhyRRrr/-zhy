# 诗人时间线数据库使用说明

本数据库记录了清代女诗人（曾懿、宗婉、左锡嘉）的生平时间线、足迹、创作事件等相关信息。

## 数据库结构

### 数据库名称: `poet_timeline_db`

### 表结构:

1. **poets 表** - 记录诗人基本信息
   - `id` - 诗人ID（主键）
   - `name` - 诗人姓名
   - `birth_year` - 出生年份
   - `death_year` - 卒年
   - `description` - 诗人简要描述

2. **poet_timelines 表** - 记录诗人生平时间线事件
   - `id` - 时间线事件ID（主键，自增）
   - `poet_id` - 诗人ID（外键，关联poets表）
   - `time_period` - 时间段字符串表示（如"1853-1863"）
   - `start_year` - 开始年份（解析自time_period）
   - `end_year` - 结束年份（解析自time_period）
   - `location` - 地点信息
   - `poem_id_range` - 该时期创作的诗作ID范围
   - `event` - 事件描述
   - `notes` - 额外注释信息

## 导入的数据来源

数据从以下Excel文件导入：
- D:/01/lunwen/processdata/诗人数据/曾懿详细信息.xlsx
- D:/01/lunwen/processdata/诗人数据/宗婉详细信息.xlsx
- D:/01/lunwen/processdata/诗人数据/左锡嘉详细信息.xlsx

## 诗人信息

1. **曾懿**
   - ID: 1
   - 生于1853年，卒于1927年
   - 清代著名女诗人

2. **宗婉**
   - ID: 2
   - 生于1810年，卒于1863年
   - 清代著名女诗人

3. **左锡嘉**
   - ID: 3
   - 生于1831年，卒于1894年
   - 清代著名女诗人

## 如何使用数据库

### 示例查询：

1. 查询所有诗人基本信息:
```sql
SELECT * FROM poets;
```

2. 查询特定诗人的时间线事件:
```sql
SELECT * FROM poet_timelines WHERE poet_id = 1 ORDER BY start_year, end_year;
```

3. 查询特定年份范围内的事件:
```sql
SELECT p.name, t.* 
FROM poet_timelines t
JOIN poets p ON t.poet_id = p.id
WHERE t.start_year >= 1860 AND t.end_year <= 1870
ORDER BY t.start_year, p.name;
```

4. 查询特定地点的事件:
```sql
SELECT p.name, t.* 
FROM poet_timelines t
JOIN poets p ON t.poet_id = p.id
WHERE t.location LIKE '%成都%'
ORDER BY t.start_year;
```

## 数据库连接信息

- 主机: localhost
- 用户名: root
- 密码: 123456
- 数据库名: poet_timeline_db
- 字符集: utf8mb4

## 数据更新方法

如需更新数据，请运行`create_poet_timeline_db.py`脚本。该脚本会：
1. 创建数据库和表（如果不存在）
2. 更新诗人基本信息
3. 重新导入所有时间线数据

注意：运行更新脚本会先清空`poet_timelines`表中的现有数据，再重新导入。