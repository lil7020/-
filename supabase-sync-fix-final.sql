-- ========================================================
-- 最终修复脚本 - 确保所有同步问题一次性解决
-- ========================================================

-- 1. 创建/更新触发器函数
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.lastModified = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 修复 hazard_data 表
-- ========================================================
ALTER TABLE hazard_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS assignee VARCHAR(100);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'draft';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS completionNote TEXT;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS completion_user VARCHAR(100);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS progress_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS cannot_complete_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS status_change_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]';
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS creator VARCHAR(100);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS creator_role VARCHAR(50);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT FALSE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS isConfirmedByLeader BOOLEAN DEFAULT FALSE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS isConfirmedByAdmin BOOLEAN DEFAULT FALSE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS leaderCannotRectify BOOLEAN DEFAULT FALSE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS isAdminCreated BOOLEAN DEFAULT FALSE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS reportDate DATE;
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS reporter VARCHAR(100);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS hazardType VARCHAR(100);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS hazardLevel VARCHAR(50);
ALTER TABLE hazard_data ADD COLUMN IF NOT EXISTS result TEXT;
DROP TRIGGER IF EXISTS update_hazard_data_modtime ON hazard_data;
CREATE TRIGGER update_hazard_data_modtime BEFORE UPDATE ON hazard_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 task_data 表
-- ========================================================
ALTER TABLE task_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS assignee VARCHAR(100);
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal';
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS creator VARCHAR(100);
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE task_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
DROP TRIGGER IF EXISTS update_task_data_modtime ON task_data;
CREATE TRIGGER update_task_data_modtime BEFORE UPDATE ON task_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 sampling_anomaly_data 表（采样点异常排查）
-- ========================================================
ALTER TABLE sampling_anomaly_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS device VARCHAR(255);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS tag VARCHAR(100);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS sample_name VARCHAR(255);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS problem_desc TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS report_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS reporter VARCHAR(100);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS rectifier VARCHAR(100);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_status VARCHAR(50) DEFAULT 'progress';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS completionNote TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS confirmer VARCHAR(100);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS _user_id VARCHAR(100);
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS protected BOOLEAN DEFAULT FALSE;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS processing_report TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS confirmed_by_leader VARCHAR(100);
DROP TRIGGER IF EXISTS update_sampling_anomaly_data_modtime ON sampling_anomaly_data;
CREATE TRIGGER update_sampling_anomaly_data_modtime BEFORE UPDATE ON sampling_anomaly_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 instrument_data 表
-- ========================================================
ALTER TABLE instrument_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS faultDate DATE;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS instrumentNo VARCHAR(100);
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS instrumentName VARCHAR(255);
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS faultDescription TEXT;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS repairContent TEXT;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS repairDate DATE;
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS repairPerson VARCHAR(100);
ALTER TABLE instrument_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
DROP TRIGGER IF EXISTS update_instrument_data_modtime ON instrument_data;
CREATE TRIGGER update_instrument_data_modtime BEFORE UPDATE ON instrument_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 sampling_car_data 表
-- ========================================================
ALTER TABLE sampling_car_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS faultDate DATE;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS repairFactory VARCHAR(255);
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS faultDescription TEXT;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS repairItem VARCHAR(500);
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS repairDate DATE;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS repairPerson VARCHAR(100);
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE sampling_car_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
DROP TRIGGER IF EXISTS update_sampling_car_data_modtime ON sampling_car_data;
CREATE TRIGGER update_sampling_car_data_modtime BEFORE UPDATE ON sampling_car_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 inspection_center_records 表
-- ========================================================
ALTER TABLE inspection_center_records ALTER COLUMN id TYPE TEXT;
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE inspection_center_records ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
DROP TRIGGER IF EXISTS update_inspection_center_records_modtime ON inspection_center_records;
CREATE TRIGGER update_inspection_center_records_modtime BEFORE UPDATE ON inspection_center_records FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 inspection_workshop_records 表
-- ========================================================
ALTER TABLE inspection_workshop_records ALTER COLUMN id TYPE TEXT;
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE inspection_workshop_records ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
DROP TRIGGER IF EXISTS update_inspection_workshop_records_modtime ON inspection_workshop_records;
CREATE TRIGGER update_inspection_workshop_records_modtime BEFORE UPDATE ON inspection_workshop_records FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 设置权限（先删除已存在的策略）
-- ========================================================
ALTER TABLE hazard_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_anomaly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_car_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_center_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_workshop_records ENABLE ROW LEVEL SECURITY;

-- 先删除已存在的策略
DROP POLICY IF EXISTS "allow_all_access_hazard" ON hazard_data;
DROP POLICY IF EXISTS "allow_all_access_task" ON task_data;
DROP POLICY IF EXISTS "allow_all_access_sampling_anomaly" ON sampling_anomaly_data;
DROP POLICY IF EXISTS "allow_all_access_instrument" ON instrument_data;
DROP POLICY IF EXISTS "allow_all_access_sampling_car" ON sampling_car_data;
DROP POLICY IF EXISTS "allow_all_access_inspection_center" ON inspection_center_records;
DROP POLICY IF EXISTS "allow_all_access_inspection_workshop" ON inspection_workshop_records;

-- 重新创建策略
CREATE POLICY "allow_all_access_hazard" ON hazard_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_task" ON task_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_sampling_anomaly" ON sampling_anomaly_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_instrument" ON instrument_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_sampling_car" ON sampling_car_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_inspection_center" ON inspection_center_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_inspection_workshop" ON inspection_workshop_records FOR ALL USING (true) WITH CHECK (true);

-- 完成
SELECT '✅ 所有表结构修复完成！' AS result;