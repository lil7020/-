// 配置文件 - 生产环境请修改这些值
const CONFIG = {
    // Supabase配置
    SUPABASE_URL: 'https://gfeoegvntxyfotvhklri.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_rBqTlyxcWEa1lwumCvxLLQ_bnimmF06',
    
    // 数据库表名
    TABLES: {
        hazardData: 'hazard_data',
        taskData: 'task_data',
        personnelData: 'personnel_data'
    },
    
    // 同步配置
    SYNC_RETRY_MAX: 3,
    SYNC_RETRY_DELAY: 1000,
    
    // 本地存储键名
    STORAGE_KEYS: {
        hazardData: 'hazardData',
        taskData: 'taskData',
        currentUser: 'currentUser'
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}