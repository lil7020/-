-- ============================================================
-- 隐患排查治理表结构诊断脚本 V2
-- 先查实际列名，再查具体内容
-- ============================================================

-- 1. 查看 hazard_data 表的所有列名
SELECT
    column_name AS 字段名,
    data_type AS 数据类型,
    udt_name AS 完整类型,
    is_nullable AS 是否可空
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hazard_data'
ORDER BY ordinal_position;

-- 2. 单独查询记录类相关字段（用模糊匹配）
SELECT
    column_name AS 字段名,
    data_type AS 数据类型,
    udt_name AS 完整类型
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hazard_data'
  AND (column_name LIKE '%completion%'
       OR column_name LIKE '%reject%'
       OR column_name LIKE '%status%'
       OR column_name LIKE '%progress%'
       OR column_name LIKE '%record%'
       OR column_name LIKE '%change%')
ORDER BY column_name;

-- 3. 查看表的总记录数和最新3条记录
SELECT COUNT(*) AS 总记录数 FROM hazard_data;

SELECT id, title, status, updated_at
FROM hazard_data
ORDER BY updated_at DESC
LIMIT 3;

-- 4. 查看一条完整记录的字段（动态获取所有字段名）
-- 这一步会把所有字段和值都列出来
SELECT *
FROM hazard_data
ORDER BY updated_at DESC
LIMIT 1;
