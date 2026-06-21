-- ============================================================
-- 隐患排查治理表完整诊断脚本 V3
-- 重点查看最新创建的隐患数据
-- ============================================================

-- 1. 查看最新创建的5条隐患
SELECT
    id,
    title,
    status,
    creator,
    creator_role,
    is_admin_created,
    jsonb_typeof(completion_records) AS completion_records类型,
    jsonb_array_length(COALESCE(completion_records, '[]'::jsonb)) AS completion_records数量,
    jsonb_typeof(status_change_records) AS status_change_records类型,
    jsonb_array_length(COALESCE(status_change_records, '[]'::jsonb)) AS status_change_records数量,
    updated_at
FROM hazard_data
ORDER BY created_at DESC
LIMIT 5;

-- 2. 详细查看最新隐患的完整记录
SELECT
    id,
    title,
    status,
    creator,
    creator_role,
    completion_records,
    status_change_records
FROM hazard_data
ORDER BY created_at DESC
LIMIT 1;

-- 3. 查看 wangxixue 创建的所有隐患
SELECT
    id,
    title,
    status,
    creator,
    jsonb_array_length(COALESCE(completion_records, '[]'::jsonb)) AS completion数量,
    jsonb_array_length(COALESCE(status_change_records, '[]'::jsonb)) AS status_change数量,
    updated_at
FROM hazard_data
WHERE creator = 'wangxixue' OR creator = '王希学'
ORDER BY updated_at DESC
LIMIT 10;
