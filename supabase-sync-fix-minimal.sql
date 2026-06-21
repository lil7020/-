-- ========================================================
-- 最小化修复脚本 - 解决核心同步问题
-- ========================================================

-- 1. 创建更新触发器函数
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
DROP TRIGGER IF EXISTS update_task_data_modtime ON task_data;
CREATE TRIGGER update_task_data_modtime BEFORE UPDATE ON task_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 修复 sampling_anomaly_data 表
-- ========================================================
ALTER TABLE sampling_anomaly_data ALTER COLUMN id TYPE TEXT;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS lastModified TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS headers TEXT[];
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS completion_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS reject_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS escalate_records JSONB DEFAULT '[]';
ALTER TABLE sampling_anomaly_data ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]';
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
DROP TRIGGER IF EXISTS update_inspection_workshop_records_modtime ON inspection_workshop_records;
CREATE TRIGGER update_inspection_workshop_records_modtime BEFORE UPDATE ON inspection_workshop_records FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ========================================================
-- 设置权限
-- ========================================================
ALTER TABLE hazard_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_anomaly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_car_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_center_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_workshop_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_access_hazard" ON hazard_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_task" ON task_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_sampling_anomaly" ON sampling_anomaly_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_instrument" ON instrument_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_sampling_car" ON sampling_car_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_inspection_center" ON inspection_center_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_access_inspection_workshop" ON inspection_workshop_records FOR ALL USING (true) WITH CHECK (true);

-- 完成
SELECT '✅ 所有表结构修复完成！' AS result;