-- ============================================
-- Supabase 完整修复脚本（包含所有表）
-- ============================================

-- 注意：先删除旧的有问题的策略，再重新创建

-- 1. 禁用所有表的RLS（临时），确保我们可以操作
ALTER TABLE IF EXISTS inspection_center_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inspection_workshop_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sampling_car_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instrument_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS honor_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patrol_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS personnel_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_personnel_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_data DISABLE ROW LEVEL SECURITY;

-- 2. 删除所有旧策略
DROP POLICY IF EXISTS "Enable read access for inspection_center_data" ON inspection_center_data;
DROP POLICY IF EXISTS "Enable insert access for inspection_center_data" ON inspection_center_data;
DROP POLICY IF EXISTS "Enable update access for inspection_center_data" ON inspection_center_data;
DROP POLICY IF EXISTS "Enable delete access for inspection_center_data" ON inspection_center_data;
DROP POLICY IF EXISTS "allow_all_access" ON inspection_center_data;

DROP POLICY IF EXISTS "Enable read access for inspection_workshop_data" ON inspection_workshop_data;
DROP POLICY IF EXISTS "Enable insert access for inspection_workshop_data" ON inspection_workshop_data;
DROP POLICY IF EXISTS "Enable update access for inspection_workshop_data" ON inspection_workshop_data;
DROP POLICY IF EXISTS "Enable delete access for inspection_workshop_data" ON inspection_workshop_data;
DROP POLICY IF EXISTS "allow_all_access" ON inspection_workshop_data;

DROP POLICY IF EXISTS "Enable read access for sampling_car_data" ON sampling_car_data;
DROP POLICY IF EXISTS "Enable insert access for sampling_car_data" ON sampling_car_data;
DROP POLICY IF EXISTS "Enable update access for sampling_car_data" ON sampling_car_data;
DROP POLICY IF EXISTS "Enable delete access for sampling_car_data" ON sampling_car_data;
DROP POLICY IF EXISTS "allow_all_access" ON sampling_car_data;

DROP POLICY IF EXISTS "Enable read access for instrument_data" ON instrument_data;
DROP POLICY IF EXISTS "Enable insert access for instrument_data" ON instrument_data;
DROP POLICY IF EXISTS "Enable update access for instrument_data" ON instrument_data;
DROP POLICY IF EXISTS "Enable delete access for instrument_data" ON instrument_data;
DROP POLICY IF EXISTS "allow_all_access" ON instrument_data;

DROP POLICY IF EXISTS "Enable read access for honor_data" ON honor_data;
DROP POLICY IF EXISTS "Enable insert access for honor_data" ON honor_data;
DROP POLICY IF EXISTS "Enable update access for honor_data" ON honor_data;
DROP POLICY IF EXISTS "Enable delete access for honor_data" ON honor_data;
DROP POLICY IF EXISTS "allow_all_access" ON honor_data;

DROP POLICY IF EXISTS "Enable read access for patrol_data" ON patrol_data;
DROP POLICY IF EXISTS "Enable insert access for patrol_data" ON patrol_data;
DROP POLICY IF EXISTS "Enable update access for patrol_data" ON patrol_data;
DROP POLICY IF EXISTS "Enable delete access for patrol_data" ON patrol_data;
DROP POLICY IF EXISTS "allow_all_access" ON patrol_data;

DROP POLICY IF EXISTS "Enable read access for personnel_data" ON personnel_data;
DROP POLICY IF EXISTS "Enable insert access for personnel_data" ON personnel_data;
DROP POLICY IF EXISTS "Enable update access for personnel_data" ON personnel_data;
DROP POLICY IF EXISTS "Enable delete access for personnel_data" ON personnel_data;
DROP POLICY IF EXISTS "allow_all_access" ON personnel_data;

DROP POLICY IF EXISTS "Enable read access for team_data" ON team_data;
DROP POLICY IF EXISTS "Enable insert access for team_data" ON team_data;
DROP POLICY IF EXISTS "Enable update access for team_data" ON team_data;
DROP POLICY IF EXISTS "Enable delete access for team_data" ON team_data;
DROP POLICY IF EXISTS "allow_all_access" ON team_data;

DROP POLICY IF EXISTS "Enable read access for team_personnel_data" ON team_personnel_data;
DROP POLICY IF EXISTS "Enable insert access for team_personnel_data" ON team_personnel_data;
DROP POLICY IF EXISTS "Enable update access for team_personnel_data" ON team_personnel_data;
DROP POLICY IF EXISTS "Enable delete access for team_personnel_data" ON team_personnel_data;
DROP POLICY IF EXISTS "allow_all_access" ON team_personnel_data;

DROP POLICY IF EXISTS "Enable read access for training_data" ON training_data;
DROP POLICY IF EXISTS "Enable insert access for training_data" ON training_data;
DROP POLICY IF EXISTS "Enable update access for training_data" ON training_data;
DROP POLICY IF EXISTS "Enable delete access for training_data" ON training_data;
DROP POLICY IF EXISTS "allow_all_access" ON training_data;

-- 3. 创建所有表（如果不存在）
CREATE TABLE IF NOT EXISTS inspection_center_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_workshop_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.1 确保检查问题台账表有正确的列（修复已存在表缺少data列的问题）
ALTER TABLE inspection_center_data ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE inspection_center_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inspection_center_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE inspection_workshop_data ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE inspection_workshop_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE inspection_workshop_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS sampling_car_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS instrument_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS honor_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patrol_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personnel_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_personnel_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 启用RLS
ALTER TABLE inspection_center_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_workshop_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_car_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE honor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrol_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_personnel_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;

-- 5. 创建新的开放策略（对所有表）
-- inspection_center_data
CREATE POLICY "allow_all_access" ON inspection_center_data FOR ALL USING (true) WITH CHECK (true);

-- inspection_workshop_data
CREATE POLICY "allow_all_access" ON inspection_workshop_data FOR ALL USING (true) WITH CHECK (true);

-- sampling_car_data
CREATE POLICY "allow_all_access" ON sampling_car_data FOR ALL USING (true) WITH CHECK (true);

-- instrument_data
CREATE POLICY "allow_all_access" ON instrument_data FOR ALL USING (true) WITH CHECK (true);

-- honor_data
CREATE POLICY "allow_all_access" ON honor_data FOR ALL USING (true) WITH CHECK (true);

-- patrol_data
CREATE POLICY "allow_all_access" ON patrol_data FOR ALL USING (true) WITH CHECK (true);

-- personnel_data
CREATE POLICY "allow_all_access" ON personnel_data FOR ALL USING (true) WITH CHECK (true);

-- team_data
CREATE POLICY "allow_all_access" ON team_data FOR ALL USING (true) WITH CHECK (true);

-- team_personnel_data
CREATE POLICY "allow_all_access" ON team_personnel_data FOR ALL USING (true) WITH CHECK (true);

-- training_data
CREATE POLICY "allow_all_access" ON training_data FOR ALL USING (true) WITH CHECK (true);

-- 完成！
SELECT '所有表和策略配置完成！' AS result;
