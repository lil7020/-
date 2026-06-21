-- ============================================================
-- 修复检查问题台账同步错误：record "new" has no field "lastmodified"
-- 问题根源：触发器 update_modified_column() 尝试设置 NEW.lastModified，
-- 但是 inspection_center_records 和 inspection_workshop_records 表
-- 没有 lastModified 列，导致所有 UPDATE/PATCH 请求失败。
-- 运行方式：在 Supabase SQL Editor 中打开此文件，点击 "Run"
-- ============================================================

-- 方案A（推荐）：给检查问题表添加 lastModified 列
-- 这样触发器 update_modified_column() 就能正常工作
ALTER TABLE inspection_center_records
ADD COLUMN IF NOT EXISTS "lastModified" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE inspection_workshop_records
ADD COLUMN IF NOT EXISTS "lastModified" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================
-- 方案B（备选）：如果不想添加 lastModified 列，可以直接删除触发器
-- （注意：client 端代码已经在设置 updated_at，不影响同步）
-- ============================================================
-- DROP TRIGGER IF EXISTS update_inspection_center_records_modtime ON inspection_center_records;
-- DROP TRIGGER IF EXISTS update_inspection_workshop_records_modtime ON inspection_workshop_records;

-- ============================================================
-- 验证：运行后确认列已添加
-- ============================================================
SELECT 'inspection_center_records' AS table_name,
       EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'inspection_center_records'
             AND column_name = 'lastModified'
       ) AS has_lastmodified_column;

SELECT 'inspection_workshop_records' AS table_name,
       EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'inspection_workshop_records'
             AND column_name = 'lastModified'
       ) AS has_lastmodified_column;

-- 也可以用这个来查看当前表的所有列
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'inspection_center_rec