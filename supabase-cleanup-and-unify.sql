-- ============================================
-- Supabase 表设置脚本（完整版本）
-- ============================================

-- 创建/修复 patrol_data 表
CREATE TABLE IF NOT EXISTS patrol_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 启用 RLS（包括已有的表）
ALTER TABLE IF EXISTS patrol_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sampling_car_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instrument_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS honor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS personnel_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inspection_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_personnel_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_data ENABLE ROW LEVEL SECURITY;

-- 安全创建策略
DO $$
BEGIN
    -- patrol_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patrol_data') THEN
        CREATE POLICY "Enable read access for patrol_data" ON patrol_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for patrol_data" ON patrol_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for patrol_data" ON patrol_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for patrol_data" ON patrol_data FOR DELETE USING (true);
    END IF;
    
    -- sampling_car_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sampling_car_data') THEN
        CREATE POLICY "Enable read access for sampling_car_data" ON sampling_car_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for sampling_car_data" ON sampling_car_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for sampling_car_data" ON sampling_car_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for sampling_car_data" ON sampling_car_data FOR DELETE USING (true);
    END IF;
    
    -- instrument_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instrument_data') THEN
        CREATE POLICY "Enable read access for instrument_data" ON instrument_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for instrument_data" ON instrument_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for instrument_data" ON instrument_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for instrument_data" ON instrument_data FOR DELETE USING (true);
    END IF;
    
    -- honor_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'honor_data') THEN
        CREATE POLICY "Enable read access for honor_data" ON honor_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for honor_data" ON honor_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for honor_data" ON honor_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for honor_data" ON honor_data FOR DELETE USING (true);
    END IF;
    
    -- personnel_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'personnel_data') THEN
        CREATE POLICY "Enable read access for personnel_data" ON personnel_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for personnel_data" ON personnel_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for personnel_data" ON personnel_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for personnel_data" ON personnel_data FOR DELETE USING (true);
    END IF;
    
    -- inspection_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inspection_data') THEN
        CREATE POLICY "Enable read access for inspection_data" ON inspection_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for inspection_data" ON inspection_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for inspection_data" ON inspection_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for inspection_data" ON inspection_data FOR DELETE USING (true);
    END IF;
    
    -- team_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_data') THEN
        CREATE POLICY "Enable read access for team_data" ON team_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for team_data" ON team_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for team_data" ON team_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for team_data" ON team_data FOR DELETE USING (true);
    END IF;
    
    -- team_personnel_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_personnel_data') THEN
        CREATE POLICY "Enable read access for team_personnel_data" ON team_personnel_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for team_personnel_data" ON team_personnel_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for team_personnel_data" ON team_personnel_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for team_personnel_data" ON team_personnel_data FOR DELETE USING (true);
    END IF;
    
    -- training_data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_data') THEN
        CREATE POLICY "Enable read access for training_data" ON training_data FOR SELECT USING (true);
        CREATE POLICY "Enable insert access for training_data" ON training_data FOR INSERT WITH CHECK (true);
        CREATE POLICY "Enable update access for training_data" ON training_data FOR UPDATE USING (true);
        CREATE POLICY "Enable delete access for training_data" ON training_data FOR DELETE USING (true);
    END IF;
END $$;

SELECT 'All tables setup complete!' AS result;