-- ============================================
-- 违章违纪台账 - 完整数据库脚本
-- 此脚本用于创建违章违纪台账表，完全取代之前的勤巡检除隐患模块
-- ============================================

-- 1. 删除旧的 patrol_data 表（如果存在）
DROP TABLE IF EXISTS patrol_data;

-- 2. 创建新的违章违纪台账表
CREATE TABLE violation_discipline_data (
    id BIGSERIAL PRIMARY KEY,
    record_date DATE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    facts TEXT,
    occur_date DATE,
    basis TEXT,
    punishment_level VARCHAR(50),
    economic_penalty TEXT,
    safety_score VARCHAR(20),
    rectification_status TEXT,
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建索引
CREATE INDEX idx_violation_name ON violation_discipline_data(name);
CREATE INDEX idx_violation_department ON violation_discipline_data(department);
CREATE INDEX idx_violation_category ON violation_discipline_data(category);
CREATE INDEX idx_violation_record_date ON violation_discipline_data(record_date);
CREATE INDEX idx_violation_occur_date ON violation_discipline_data(occur_date);

-- 4. 启用 RLS（行级安全）
ALTER TABLE violation_discipline_data ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略（允许所有操作）
CREATE POLICY "Allow all access to violation_discipline_data" 
    ON violation_discipline_data 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 6. 创建视图（可选，用于简化查询）
CREATE VIEW v_violation_summary AS
SELECT 
    id,
    record_date,
    name,
    department,
    category,
    LEFT(facts, 50) || '...' AS facts_short,
    occur_date,
    punishment_level,
    rectification_status,
    created_at
FROM violation_discipline_data
ORDER BY record_date DESC;

-- 7. 创建触发器（自动更新 updated_at）
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_violation_discipline_updated_at
BEFORE UPDATE ON violation_discipline_data
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. 插入示例数据（可选）
INSERT INTO violation_discipline_data (
    record_date, name, department, category, facts, occur_date, basis, 
    punishment_level, economic_penalty, safety_score, rectification_status, remark
) VALUES 
(
    '2025-04-15', '张三', '甲醇部', '安全严重违章', 
    '在防爆区域使用非防爆手机', '2025-04-15', 
    '《化工分公司严重违章行为责任追究管理办法》附件1第3条',
    '诫勉谈话', '扣月度奖金50%', '-10分', '已进行离岗培训，考试合格', ''
),
(
    '2025-06-20', '李四', '烯烃部', '违反劳动纪律',
    '工作时间离岗', '2025-06-20',
    '《化工分公司劳动纪律管理办法》第3.4.7',
    '警告', '扣月度奖金2个月，并扣当年年终奖10%', '-10分', '已进行批评教育', ''
),
(
    '2025-11-01', '赵六', '水务部', '职工违规违纪',
    '工作时间打架斗殴', '2025-11-01',
    '《职工违规违纪行为经济考核实施细则》16；《化工分公司劳动纪律管理办法》5.3.7.5',
    '记过', '扣当事人月度奖金4个月，并扣当年年终奖30%', '/', '已按制度移交纪检监督部处理', ''
),
(
    '2026-02-19', '刘鹏', '水务部', '生产安全事故',
    '运行中徒手清理输送机异物，造成右手示指末节离断伤', '2026-02-19',
    '《化工分公司生产安全事故事件管理规定》附件8.6',
    '记大过、降级', '按事故调查报告执行', '按公司规定记分', '已落实整改措施', '损失工作日28天，认定为轻伤'
);

-- 完成！
SELECT '违章违纪台账表创建完成！' AS result;
