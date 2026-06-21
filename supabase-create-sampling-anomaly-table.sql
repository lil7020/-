-- ============================================
-- 创建采样点异常排查数据表 (sampling_anomaly_data)
-- ============================================

-- 创建表
CREATE TABLE IF NOT EXISTS sampling_anomaly_data (
    id TEXT PRIMARY KEY,
    device TEXT,
    tag TEXT,
    sample_name TEXT,
    problem_desc TEXT,
    report_time TEXT,
    reporter TEXT,
    rectifier TEXT,
    completion_status TEXT DEFAULT 'progress',
    completion_note TEXT,
    confirmer TEXT,
    remark TEXT,
    create_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    _sync_version INTEGER DEFAULT 1,
    _user_id TEXT
);

-- 启用行级安全策略
ALTER TABLE sampling_anomaly_data ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有认证用户读取
CREATE POLICY "Enable read access for sampling_anomaly_data" 
    ON sampling_anomaly_data 
    FOR SELECT 
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 创建策略：允许所有认证用户插入
CREATE POLICY "Enable insert access for sampling_anomaly_data" 
    ON sampling_anomaly_data 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 创建策略：允许所有认证用户更新
CREATE POLICY "Enable update access for sampling_anomaly_data" 
    ON sampling_anomaly_data 
    FOR UPDATE 
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- 创建策略：允许所有认证用户删除
CREATE POLICY "Enable delete access for sampling_anomaly_data" 
    ON sampling_anomaly_data 
    FOR DELETE 
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

SELECT 'sampling_anomaly_data table created successfully!' AS result;
