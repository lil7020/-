-- ========================================================
-- 甲醇作业区人员信息管理系统 - 云端表结构修复脚本
-- 一次性解决所有同步问题
-- ========================================================

-- 先创建更新函数
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.lastModified = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 1. 隐患排查治理 hazard_data (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS hazard_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hazard_data ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS assignee VARCHAR(100);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'draft';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS completionNote TEXT;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS completion_user VARCHAR(100);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS progress_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS cannot_complete_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS status_change_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS creator VARCHAR(100);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS creator_role VARCHAR(50);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS isConfirmedByLeader BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS isConfirmedByAdmin BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS leaderCannotRectify BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS isAdminCreated BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS reportDate DATE;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS reporter VARCHAR(100);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS category VARCHAR(255);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS hazardType VARCHAR(100);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS hazardLevel VARCHAR(50);
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS result TEXT;
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS hazard_data ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_hazard_data_modtime ON hazard_data;
CREATE TRIGGER update_hazard_data_modtime BEFORE UPDATE ON hazard_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 2. 任务管理 task_data (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS task_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS task_data ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS assignee VARCHAR(100);
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal';
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS creator VARCHAR(100);
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS task_data ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_task_data_modtime ON task_data;
CREATE TRIGGER update_task_data_modtime BEFORE UPDATE ON task_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 3. 采样点异常排查 sampling_anomaly_data (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS sampling_anomaly_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sampling_anomaly_data ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS device VARCHAR(255);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS tag VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS sample_name VARCHAR(255);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS problem_desc TEXT;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS report_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS reporter VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS rectifier VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_status VARCHAR(50) DEFAULT 'progress';
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS confirmer VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS create_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS update_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS _user_id VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS protected BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS processing_report TEXT;
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS confirmed_by_leader VARCHAR(100);
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS sampling_anomaly_data ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_sampling_anomaly_data_modtime ON sampling_anomaly_data;
CREATE TRIGGER update_sampling_anomaly_data_modtime BEFORE UPDATE ON sampling_anomaly_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 4. 仪器维修台账 instrument_data (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS instrument_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instrument_data ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS faultDate DATE;
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS instrumentNo VARCHAR(100);
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS instrumentName VARCHAR(255);
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS faultDescription TEXT;
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS repairContent TEXT;
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS repairDate DATE;
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS repairPerson VARCHAR(100);
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS instrument_data ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_instrument_data_modtime ON instrument_data;
CREATE TRIGGER update_instrument_data_modtime BEFORE UPDATE ON instrument_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 5. 采样车维修台账 sampling_car_data (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS sampling_car_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sampling_car_data ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS faultDate DATE;
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS repairFactory VARCHAR(255);
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS faultDescription TEXT;
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS repairItem VARCHAR(500);
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS repairDate DATE;
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS repairPerson VARCHAR(100);
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS sampling_car_data ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_sampling_car_data_modtime ON sampling_car_data;
CREATE TRIGGER update_sampling_car_data_modtime BEFORE UPDATE ON sampling_car_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 6. 中心检查问题台账 inspection_center_records (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS inspection_center_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inspection_center_records ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS inspection_center_records ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_inspection_center_records_modtime ON inspection_center_records;
CREATE TRIGGER update_inspection_center_records_modtime BEFORE UPDATE ON inspection_center_records FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 7. 作业区检查问题台账 inspection_workshop_records (逐条记录存储模式)
-- ========================================================
ALTER TABLE IF EXISTS inspection_workshop_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inspection_workshop_records ALTER COLUMN id TYPE TEXT;

ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS _sync_version INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE IF EXISTS inspection_workshop_records ADD COLUMN IF NOT EXISTS data JSONB;

DROP TRIGGER IF EXISTS update_inspection_workshop_records_modtime ON inspection_workshop_records;
CREATE TRIGGER update_inspection_workshop_records_modtime BEFORE UPDATE ON inspection_workshop_records FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 设置行级安全策略
-- ========================================================
ALTER TABLE hazard_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_anomaly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_car_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_center_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_workshop_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_access_hazard" ON hazard_data;
CREATE POLICY "allow_all_access_hazard" ON hazard_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_task" ON task_data;
CREATE POLICY "allow_all_access_task" ON task_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_sampling_anomaly" ON sampling_anomaly_data;
CREATE POLICY "allow_all_access_sampling_anomaly" ON sampling_anomaly_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_instrument" ON instrument_data;
CREATE POLICY "allow_all_access_instrument" ON instrument_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_sampling_car" ON sampling_car_data;
CREATE POLICY "allow_all_access_sampling_car" ON sampling_car_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_inspection_center" ON inspection_center_records;
CREATE POLICY "allow_all_access_inspection_center" ON inspection_center_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_access_inspection_workshop" ON inspection_workshop_records;
CREATE POLICY "allow_all_access_inspection_workshop" ON inspection_workshop_records FOR ALL USING (true) WITH CHECK (true);

-- ========================================================
-- 显示执行结果
-- ========================================================
SELECT '✅ 所有表结构修复完成！' AS result;
SELECT 
    'hazard_data' AS table_name, (SELECT COUNT(*) FROM hazard_data) AS row_count UNION ALL
    SELECT 'task_data' AS table_name, (SELECT COUNT(*) FROM task_data) AS row_count UNION ALL
    SELECT 'sampling_anomaly_data' AS table_name, (SELECT COUNT(*) FROM sampling_anomaly_data) AS row_count UNION ALL
    SELECT 'instrument_data' AS table_name, (SELECT COUNT(*) FROM instrument_data) AS row_count UNION ALL
    SELECT 'sampling_car_data' AS table_name, (SELECT COUNT(*) FROM sampling_car_data) AS row_count UNION ALL
    SELECT 'inspection_center_records' AS table_name, (SELECT COUNT(*) FROM inspection_center_records) AS row_count UNION ALL
    SELECT 'inspection_workshop_records' AS table_name, (SELECT COUNT(*) FROM inspection_workshop_records) AS row_count;