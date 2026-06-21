-- ============================================
-- 为 hazard_data 表添加缺失的字段
-- ============================================

-- 添加 completionNote 字段（完成情况说明）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS completion_note TEXT;

-- 添加 completion_user 字段（完成人）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS completion_user TEXT;

-- 添加 rejectRecords 字段（打回记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]'::JSONB;

-- 添加 completionRecords 字段（完成记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]'::JSONB;

-- 添加 progressRecords 字段（整改进展记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS progress_records JSONB DEFAULT '[]'::JSONB;

-- 添加 statusChangeRecords 字段（状态变更记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS status_change_records JSONB DEFAULT '[]'::JSONB;

-- 添加 escalate_records 字段（升级处理记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]'::JSONB;

-- 添加 cannot_complete_records 字段（无法完成整改记录数组）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS cannot_complete_records JSONB DEFAULT '[]'::JSONB;

-- 添加 create_time 字段（创建时间）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 添加 update_time 字段（更新时间）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 添加 created_at 字段
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 添加 updated_at 字段
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 添加 _sync_version 字段（同步版本号）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;

-- ========== 隐患核心字段 ==========
-- 添加 hazard_type 字段（隐患分类）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS hazard_type TEXT;

-- 添加 hazard_level 字段（隐患等级）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS hazard_level TEXT;

-- 添加 report_date 字段（填报日期）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS report_date DATE;

-- 添加 department 字段（部门/单位）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS department TEXT;

-- 添加 category 字段（专业类别）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS category TEXT;

-- 添加 reporter 字段（填报人）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS reporter TEXT;

-- 添加 result 字段（处理结果）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS result TEXT;

-- 添加 creator 字段（创建者）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS creator TEXT;

-- 添加 creator_role 字段（创建者角色）
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS creator_role TEXT;

-- 添加 is_admin_created 字段
ALTER TABLE IF EXISTS hazard_data 
ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT FALSE;

-- 确保 hazard_data 表有正确的策略
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hazard_data') THEN
        CREATE POLICY "Enable read access for hazard_data" ON hazard_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for hazard_data" ON hazard_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for hazard_data" ON hazard_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for hazard_data" ON hazard_data FOR DELETE USING (true);
    END IF;
END $$;

SELECT 'hazard_data fields added successfully!' AS result;