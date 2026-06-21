-- ============================================
-- 为 sampling_anomaly_data 表添加 created_at 和 updated_at 字段
-- 如果表已存在但缺少这两个字段，请执行此脚本
-- ============================================

-- 添加 created_at 字段
ALTER TABLE IF EXISTS sampling_anomaly_data 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 添加 updated_at 字段
ALTER TABLE IF EXISTS sampling_anomaly_data 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

SELECT 'sampling_anomaly_data fields added successfully!' AS result;
