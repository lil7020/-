-- ============================================================
-- 隐患排查治理表结构诊断脚本
-- 用于检查 Supabase 中 hazard_data 表的字段类型和数据格式
-- ============================================================

-- 1. 查看 hazard_data 表的完整结构
SELECT
    column_name AS 字段名,
    data_type AS 数据类型,
    udt_name AS 完整类型,
    is_nullable AS 是否可空,
    column_default AS 默认值
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hazard_data'
ORDER BY ordinal_position;

-- 2. 查看关键数组字段的具体类型（completion_records 等）
SELECT
    column_name,
    data_type,
    udt_name,
    -- 对于 jsonb 字段，查看里面存储的是什么类型
    pg_typeof(completion_records) AS completion_records_实际类型,
    pg_typeof(reject_records) AS reject_records_实际类型,
    pg_typeof(status_change_records) AS status_change_records_实际类型
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hazard_data'
  AND column_name IN ('completion_records', 'completionRecords',
                      'reject_records', 'rejectRecords',
                      'status_change_records', 'statusChangeRecords',
                      'progress_records', 'cannot_complete_records',
                      'escalate_records');

-- 3. 抽样查看具体某条隐患记录的实际数据格式
SELECT
    id,
    title,
    -- 查看 completion_records 字段的实际存储内容（前200字符）
    SUBSTRING(completion_records::text, 1, 300) AS completion_records内容,
    -- 查看 reject_records 字段的实际存储内容
    SUBSTRING(reject_records::text, 1, 200) AS reject_records内容,
    -- 查看 status_change_records 字段的实际存储内容
    SUBSTRING(status_change_records::text, 1, 200) AS status_change_records内容,
    updated_at
FROM hazard_data
ORDER BY updated_at DESC
LIMIT 3;

-- 4. 检查 completion_records 字段是数组还是字符串
-- 如果返回 'array' 则正确，返回 'string' 则有问题
SELECT
    id,
    title,
    jsonb_typeof(completion_records) AS completion_records_jsonb类型,
    jsonb_typeof(reject_records) AS reject_records_jsonb类型,
    jsonb_typeof(status_change_records) AS status_change_records_jsonb类型
FROM hazard_data
ORDER BY updated_at DESC
LIMIT 5;

-- 5. 统计隐患记录数量
SELECT
    COUNT(*) AS 总记录数,
    COUNT(completion_records) AS 有完成记录的记录数,
    COUNT(reject_records) AS 有打回记录的记录数,
    COUNT(status_change_records) AS 有状态变更的记录数
FROM hazard_data;

-- 6. 查看特定隐患的完整记录（替换 id 为您要查看的隐患ID）
-- SELECT * FROM hazard_data WHERE id = '您的隐患ID';

-- 7. 检查表的索引情况
SELECT
    indexname AS 索引名,
    indexdef AS 索引定义
FROM pg_indexes
WHERE tablename = 'hazard_data';
