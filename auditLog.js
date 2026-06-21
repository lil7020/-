/**
 * 审计日志模块
 * 记录所有用户操作，供最高管理者审计查看
 */

// 审计日志配置
const AUDIT_CONFIG = {
    STORAGE_KEY: 'auditLogs',
    PENDING_KEY: 'pendingAuditLogs',  // 待审计日志队列存储键
    MAX_LOGS: 10000,           // 最大日志条数
    MAX_PENDING_LOGS: 1000,    // 最大待审计日志条数
    MAX_DISPLAY: 100,          // 分页每页显示条数
    RETENTION_DAYS: 90,         // 日志保留天数（超过自动清理）
    BATCH_UPLOAD_SIZE: 10,      // 批量上传大小
    BATCH_UPLOAD_DELAY: 2000,   // 批量上传延迟（毫秒）
    MODULE_INFO: {
        personnel: { name: '人员信息管理', icon: '👥' },
        training: { name: '副班培训成绩', icon: '📚' },
        team: { name: '红旗班组名次', icon: '🏆' },
        teamPersonnel: { name: '班组人员', icon: '👨‍👩‍👧‍👦' },
        inspection: { name: '检查问题台账', icon: '📋' },
        honor: { name: '获得荣誉台账', icon: '🏅' },
        patrol: { name: '违章违纪台账', icon: '📋' },
        samplingCar: { name: '采样车维修台账', icon: '🚛' },
        instrument: { name: '仪器维修台账', icon: '🔧' },
        users: { name: '用户管理', icon: '👤' },
        task: { name: '任务完成情况', icon: '✅' },
        hazard: { name: '隐患排查治理', icon: '⚠️' },
        samplingAnomaly: { name: '采样点异常排查', icon: '🔍' },
        system: { name: '系统管理', icon: '⚙️' }
    },
    ACTION_INFO: {
        create: { name: '新增', color: '#10b981', level: 'info' },
        update: { name: '修改', color: '#f59e0b', level: 'info' },
        delete: { name: '删除', color: '#ef4444', level: 'warning' },
        import: { name: '批量导入', color: '#8b5cf6', level: 'info' },
        export: { name: '导出', color: '#3b82f6', level: 'info' },
        login: { name: '登录', color: '#06b6d4', level: 'info' },
        logout: { name: '退出', color: '#6b7280', level: 'info' },
        batchDelete: { name: '批量删除', color: '#dc2626', level: 'danger' },
        sync: { name: '数据同步', color: '#14b8a6', level: 'info' },
        config: { name: '系统配置', color: '#f97316', level: 'warning' },
        approve: { name: '审批通过', color: '#22c55e', level: 'success' },
        reject: { name: '审批拒绝', color: '#eab308', level: 'warning' }
    },
    FIELD_LABELS: {
        name: '姓名',
        username: '用户名',
        role: '角色',
        department: '部门',
        status: '状态',
        title: '标题',
        description: '描述',
        deadline: '截止日期',
        assignee: '负责人',
        priority: '优先级',
        progress: '进度',
        remark: '备注',
        completionNote: '完成说明'
    }
};

/**
 * 生成UUID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 获取当前用户信息
 */
function getCurrentUserInfo() {
    try {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            // 统一处理真实姓名字段，支持多种字段名
            const realName = user.realName || user.real_name || user.name || user.username;
            return {
                ...user,
                realName: realName,
                username: user.username || '未知',
                role: user.role || 'user'
            };
        }
    } catch (e) {
        console.error('获取当前用户信息失败:', e);
    }
    return { username: '未知', role: 'unknown', realName: '未知' };
}

/**
 * 获取客户端IP地址（简化版本）
 */
function getClientIP() {
    try {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return '127.0.0.1';
        }
        return window.location.hostname;
    } catch (e) {
        return '未知';
    }
}

/**
 * 检查是否为最高管理者
 */
function isTopAdmin() {
    const user = getCurrentUserInfo();
    return user.role === 'topadmin';
}

/**
 * 获取待审计日志队列
 */
function getPendingAuditLogs() {
    try {
        const data = localStorage.getItem(AUDIT_CONFIG.PENDING_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

/**
 * 保存待审计日志队列
 */
function savePendingAuditLogs(logs) {
    try {
        localStorage.setItem(AUDIT_CONFIG.PENDING_KEY, JSON.stringify(logs));
    } catch (e) {
        console.error('保存待审计日志失败:', e);
    }
}

/**
 * 格式化变更详情为可读文本
 */
function formatChanges(changes) {
    if (!changes || typeof changes !== 'object') {
        return null;
    }
    
    const formatted = [];
    for (const [field, value] of Object.entries(changes)) {
        const fieldName = AUDIT_CONFIG.FIELD_LABELS[field] || field;
        if (value && typeof value === 'object' && 'old' in value && 'new' in value) {
            let oldValue = value.old;
            let newValue = value.new;
            
            // 处理特殊类型
            if (oldValue === null || oldValue === undefined) oldValue = '(空)';
            if (newValue === null || newValue === undefined) newValue = '(空)';
            
            // 限制长度
            if (String(oldValue).length > 50) oldValue = String(oldValue).substr(0, 50) + '...';
            if (String(newValue).length > 50) newValue = String(newValue).substr(0, 50) + '...';
            
            formatted.push({
                field: fieldName,
                old: String(oldValue),
                new: String(newValue),
                fieldKey: field
            });
        }
    }
    
    return formatted.length > 0 ? formatted : null;
}

/**
 * 正式提交审计日志（已同步到云端后调用）
 */
async function commitAuditLog(logEntry) {
    let logs = getAuditLogs();
    
    logs.unshift(logEntry);
    
    if (logs.length > AUDIT_CONFIG.MAX_LOGS) {
        logs = logs.slice(0, AUDIT_CONFIG.MAX_LOGS);
    }
    
    try {
        localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
        console.error('保存审计日志失败:', e);
    }
    
    try {
        if (typeof syncAuditLogToCloud === 'function') {
            await syncAuditLogToCloud(logEntry);
        }
    } catch (err) {
        console.error('审计日志同步到云端失败:', err);
    }
    
    return logEntry;
}

/**
 * 提交所有待审计日志（云端同步成功后调用）
 * 【优化版】批量处理：1次读 + 1次写 + 1次云端批量同步，而非逐条读写
 */
async function commitAllPendingAuditLogs() {
    const pendingLogs = getPendingAuditLogs();
    if (pendingLogs.length === 0) {
        return 0;
    }
    
    console.log(`[审计日志-批量] 提交 ${pendingLogs.length} 条待审计日志`);
    
    // 1次读取完整审计日志
    let allLogs = getAuditLogs();
    
    // 内存中批量添加所有待审计日志（newest first）
    allLogs = [...pendingLogs, ...allLogs];
    
    // 截断到最大数量
    if (allLogs.length > AUDIT_CONFIG.MAX_LOGS) {
        allLogs = allLogs.slice(0, AUDIT_CONFIG.MAX_LOGS);
    }
    
    // 1次写回localStorage
    try {
        localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, JSON.stringify(allLogs));
    } catch (e) {
        console.error('批量保存审计日志失败:', e);
    }
    
    // 1次批量同步到云端
    try {
        if (typeof supabaseRequest === 'function') {
            const tableName = 'audit_logs';
            await supabaseRequest('POST', tableName, pendingLogs, {
                on_conflict: 'id'
            });
            console.log(`[审计日志-批量] 云端同步成功: ${pendingLogs.length} 条`);
        }
    } catch (err) {
        console.error('[审计日志-批量] 云端同步失败:', err);
    }
    
    // 清空待审计队列
    savePendingAuditLogs([]);
    
    return pendingLogs.length;
}

/**
 * 记录审计日志（支持详细的操作追踪）
 * @param {Object} params 参数对象
 * @param {string} params.module 模块标识
 * @param {string} params.action 操作类型
 * @param {string} params.targetId 被操作记录的ID
 * @param {string} params.targetDesc 被操作对象的描述
 * @param {Object} params.changes 变更详情 {field: {old: xxx, new: xxx}}
 * @param {Object} params.beforeData 操作前的数据快照
 * @param {Object} params.afterData 操作后的数据快照
 * @param {boolean} params.success 操作是否成功
 * @param {string} params.errorMessage 错误信息（如果失败）
 * @param {string} params.source 操作来源（页面/API/菜单）
 * @param {boolean} immediate 是否立即记录
 */
async function recordAuditLog(params, immediate = false) {
    const { module, action, targetId, targetDesc, changes, beforeData, afterData, success = true, errorMessage, source = 'unknown' } = params;
    
    // 排除的操作类型
    const excludedActions = ['export', 'import'];
    if (excludedActions.includes(action)) {
        return null;
    }
    
    // 排除的模块（不记录审计日志）
    const excludedModules = ['hazard', 'samplingAnomaly', 'task'];
    if (excludedModules.includes(module)) {
        console.log(`[审计日志] 跳过排除模块的记录: ${module} - ${action}`);
        return null;
    }
    
    const user = getCurrentUserInfo();
    const moduleInfo = AUDIT_CONFIG.MODULE_INFO[module] || { name: module, icon: '📄' };
    const actionInfo = AUDIT_CONFIG.ACTION_INFO[action] || { name: action, color: '#6b7280', level: 'info' };
    
    const logEntry = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        username: user.username,
        realName: user.realName || user.username,
        role: user.role,
        roleName: getRoleName(user.role),
        module: module,
        moduleName: moduleInfo.name,
        moduleIcon: moduleInfo.icon,
        action: action,
        actionName: actionInfo.name,
        actionColor: actionInfo.color,
        actionLevel: actionInfo.level,
        targetId: targetId || '-',
        targetDesc: targetDesc || '-',
        changes: formatChanges(changes),
        changesRaw: changes || null,
        beforeData: beforeData ? (Object.keys(beforeData).length > 0 ? beforeData : null) : null,
        afterData: afterData ? (Object.keys(afterData).length > 0 ? afterData : null) : null,
        success: success,
        errorMessage: errorMessage || null,
        source: source,
        ipAddress: getClientIP(),
        userAgent: navigator.userAgent.substring(0, 200),
        location: window.location.pathname
    };
    
    if (immediate) {
        return await commitAuditLog(logEntry);
    }
    
    let pendingLogs = getPendingAuditLogs();
    pendingLogs.unshift(logEntry);
    
    if (pendingLogs.length > AUDIT_CONFIG.MAX_PENDING_LOGS) {
        pendingLogs = pendingLogs.slice(0, AUDIT_CONFIG.MAX_PENDING_LOGS);
    }
    
    savePendingAuditLogs(pendingLogs);
    console.log('[审计日志] 添加到待审计队列:', action, targetDesc);
    
    return logEntry;
}

/**
 * 获取角色名称
 */
function getRoleName(role) {
    const roleNames = {
        topadmin: '主任',
        manager: '管理人员',
        leader: '班长',
        user: '普通用户',
        unknown: '未知'
    };
    return roleNames[role] || role;
}

/**
 * 获取所有审计日志
 */
function getAuditLogs() {
    try {
        const logs = localStorage.getItem(AUDIT_CONFIG.STORAGE_KEY);
        return logs ? JSON.parse(logs) : [];
    } catch (e) {
        console.error('读取审计日志失败:', e);
        return [];
    }
}

// 批量上传队列
let auditLogUploadQueue = [];
let auditLogUploadTimer = null;

function syncAuditLogToCloud(logEntry) {
    if (typeof supabaseRequest !== 'function') {
        return;
    }
    
    auditLogUploadQueue.push(logEntry);
    
    if (auditLogUploadQueue.length >= AUDIT_CONFIG.BATCH_UPLOAD_SIZE) {
        processAuditLogQueue();
        return;
    }
    
    if (auditLogUploadTimer) {
        clearTimeout(auditLogUploadTimer);
    }
    auditLogUploadTimer = setTimeout(processAuditLogQueue, AUDIT_CONFIG.BATCH_UPLOAD_DELAY);
}

async function processAuditLogQueue() {
    if (auditLogUploadQueue.length === 0) {
        return;
    }
    
    const batch = [...auditLogUploadQueue];
    auditLogUploadQueue = [];
    
    try {
        const tableName = 'audit_logs';
        
        if (batch.length === 1) {
            const result = await supabaseRequest('POST', tableName, batch[0]);
            console.log('审计日志同步到云端成功:', result);
        } else {
            const result = await supabaseRequest('POST', tableName, batch, {
                on_conflict: 'id'
            });
            console.log('审计日志批量同步到云端成功，共', batch.length, '条');
        }
    } catch (error) {
        console.error('审计日志同步到云端失败:', error);
        auditLogUploadQueue = [...batch, ...auditLogUploadQueue];
    }
}

/**
 * 从云端同步审计日志
 */
async function syncAuditLogsFromCloud() {
    if (typeof supabaseRequest !== 'function') {
        return;
    }
    
    try {
        const tableName = 'audit_logs';
        const cloudLogs = await supabaseRequest('GET', tableName, null, {
            order: 'timestamp.desc',
            limit: 2000
        });
        
        if (cloudLogs && cloudLogs.length > 0) {
            const localLogs = getAuditLogs();
            const mergedLogs = mergeLogs(localLogs, cloudLogs);
            
            localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, JSON.stringify(mergedLogs));
            console.log('从云端同步审计日志成功，共', cloudLogs.length, '条');
            return mergedLogs;
        }
    } catch (error) {
        console.error('从云端同步审计日志失败:', error);
        throw error;
    }
}

/**
 * 清理过期日志（保留指定天数内的日志）
 */
async function cleanupOldLogs() {
    const retentionDays = AUDIT_CONFIG.RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let logs = getAuditLogs();
    const originalCount = logs.length;
    
    logs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= cutoffDate;
    });
    
    const removedCount = originalCount - logs.length;
    
    if (removedCount > 0) {
        localStorage.setItem(AUDIT_CONFIG.STORAGE_KEY, JSON.stringify(logs));
        console.log(`清理了 ${removedCount} 条过期审计日志（保留 ${retentionDays} 天内的日志）`);
        
        try {
            if (typeof deleteAuditLogsFromCloud === 'function') {
                const cloudLogs = await syncAuditLogsFromCloud();
                const expiredLogIds = cloudLogs
                    .filter(log => new Date(log.timestamp) < cutoffDate)
                    .map(log => log.id);
                
                if (expiredLogIds.length > 0) {
                    await deleteAuditLogsFromCloud(expiredLogIds);
                    console.log(`从云端删除了 ${expiredLogIds.length} 条过期日志`);
                }
            }
        } catch (error) {
            console.error('清理云端过期日志失败:', error);
        }
    }
    
    return removedCount;
}

/**
 * 手动清理所有审计日志（本地和云端）
 */
async function clearAllAuditLogs() {
    localStorage.removeItem(AUDIT_CONFIG.STORAGE_KEY);
    console.log('本地审计日志已清空');
    
    try {
        if (typeof deleteAuditLogsFromCloud === 'function') {
            await deleteAuditLogsFromCloud('all');
            console.log('云端审计日志已清空');
        }
    } catch (error) {
        console.error('清空云端审计日志失败:', error);
    }
}

/**
 * 从云端删除指定ID的审计日志
 */
async function deleteAuditLogsFromCloud(logIds) {
    try {
        if (logIds === 'all') {
            const cloudLogs = await syncAuditLogsFromCloud();
            if (!cloudLogs || !cloudLogs.map) {
                console.warn('无法获取云端日志，跳过删除');
                return;
            }
            logIds = cloudLogs.map(log => log.id);
        }
        
        if (!logIds || logIds.length === 0) {
            return;
        }
        
        // 使用批量删除，每次最多删除100条
        const batchSize = 100;
        const totalCount = logIds.length;
        
        for (let i = 0; i < logIds.length; i += batchSize) {
            const batch = logIds.slice(i, i + batchSize);
            
            // 使用 in 操作符批量删除
            const idList = batch.join(',');
            await supabaseRequest('DELETE', 'audit_logs', null, {
                id: `in.(${idList})`
            });
            
            console.log(`[审计日志] 已删除 ${Math.min(i + batchSize, totalCount)}/${totalCount} 条`);
        }
        
        console.log(`从云端删除了 ${logIds.length} 条审计日志`);
    } catch (error) {
        console.error('从云端删除审计日志失败:', error);
        throw error;
    }
}

/**
 * 合并本地和云端日志（去重）
 */
function mergeLogs(localLogs, cloudLogs) {
    const logMap = new Map();
    const allowedActions = ['delete', 'update', 'batchDelete', 'create', 'login', 'logout', 'sync', 'config', 'approve', 'reject'];
    
    localLogs.forEach(log => {
        if (!allowedActions.includes(log.action)) return;
        logMap.set(log.id, log);
    });
    
    cloudLogs.forEach(log => {
        if (!allowedActions.includes(log.action)) return;
        logMap.set(log.id, log);
    });
    
    const merged = Array.from(logMap.values());
    merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return merged.slice(0, AUDIT_CONFIG.MAX_LOGS);
}

/**
 * 查询审计日志（增强版 - 带筛选、搜索、排序）
 * @param {Object} filters 筛选条件
 * @param {string} filters.module 模块筛选
 * @param {string} filters.action 操作类型筛选
 * @param {string} filters.actionLevel 操作级别筛选 (info/warning/danger/success)
 * @param {string} filters.username 用户名筛选
 * @param {string} filters.role 角色筛选
 * @param {string} filters.startDate 开始日期
 * @param {string} filters.endDate 结束日期
 * @param {string} filters.keyword 关键词搜索
 * @param {boolean} filters.success 操作是否成功
 * @param {number} filters.page 页码
 * @param {number} filters.pageSize 每页条数
 * @param {string} filters.sortBy 排序字段
 * @param {string} filters.sortOrder 排序方向 (asc/desc)
 */
function queryAuditLogsCore(filters = {}) {
    let logs = getAuditLogs();
    
    // 模块筛选
    if (filters.module && filters.module !== 'all') {
        logs = logs.filter(log => log.module === filters.module);
    }
    
    // 操作类型筛选
    if (filters.action && filters.action !== 'all') {
        logs = logs.filter(log => log.action === filters.action);
    }
    
    // 操作级别筛选
    if (filters.actionLevel && filters.actionLevel !== 'all') {
        logs = logs.filter(log => log.actionLevel === filters.actionLevel);
    }
    
    // 用户名筛选
    if (filters.username && filters.username !== 'all') {
        logs = logs.filter(log => log.username === filters.username);
    }
    
    // 角色筛选
    if (filters.role && filters.role !== 'all') {
        logs = logs.filter(log => log.role === filters.role);
    }
    
    // 日期范围筛选
    if (filters.startDate) {
        const start = new Date(filters.startDate);
        logs = logs.filter(log => new Date(log.timestamp) >= start);
    }
    if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        logs = logs.filter(log => new Date(log.timestamp) <= end);
    }
    
    // 操作成功/失败筛选
    if (filters.success !== undefined) {
        logs = logs.filter(log => log.success === filters.success);
    }
    
    // 关键词搜索（增强版）
    if (filters.keyword) {
        const keyword = filters.keyword.toLowerCase();
        logs = logs.filter(log => 
            log.username.toLowerCase().includes(keyword) ||
            (log.realName && log.realName.toLowerCase().includes(keyword)) ||
            log.targetDesc.toLowerCase().includes(keyword) ||
            log.moduleName.toLowerCase().includes(keyword) ||
            log.actionName.toLowerCase().includes(keyword) ||
            (log.changes && JSON.stringify(log.changes).toLowerCase().includes(keyword)) ||
            (log.roleName && log.roleName.toLowerCase().includes(keyword))
        );
    }
    
    // 排序
    const sortBy = filters.sortBy || 'timestamp';
    const sortOrder = filters.sortOrder || 'desc';
    logs.sort((a, b) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        if (sortBy === 'timestamp') {
            aValue = new Date(aValue).getTime();
            bValue = new Date(bValue).getTime();
        }
        
        if (sortOrder === 'desc') {
            return bValue - aValue;
        } else {
            return aValue - bValue;
        }
    });
    
    // 分页
    const page = filters.page || 1;
    const pageSize = filters.pageSize || AUDIT_CONFIG.MAX_DISPLAY;
    const total = logs.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pagedLogs = logs.slice(startIndex, endIndex);
    
    return {
        logs: pagedLogs,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: totalPages,
        filters: filters
    };
}

/**
 * 获取审计统计数据（增强版）
 */
function getAuditStats() {
    const logs = getAuditLogs();
    
    // 排除统计的模块列表
    const excludedModules = ['hazard', 'samplingAnomaly', 'task'];
    
    // 过滤掉排除模块的日志
    const filteredLogs = logs.filter(log => !excludedModules.includes(log.module));
    
    const stats = {
        total: filteredLogs.length,
        byModule: {},
        byAction: {},
        byActionLevel: { info: 0, warning: 0, danger: 0, success: 0 },
        byUser: {},
        byRole: {},
        todayCount: 0,
        weekCount: 0,
        monthCount: 0,
        successCount: 0,
        failedCount: 0
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    filteredLogs.forEach(log => {
        // 按模块统计
        if (!stats.byModule[log.module]) {
            stats.byModule[log.module] = { name: log.moduleName || log.module, icon: log.moduleIcon || '📄', count: 0 };
        }
        stats.byModule[log.module].count++;
        
        // 按操作类型统计
        if (!stats.byAction[log.action]) {
            stats.byAction[log.action] = { name: log.actionName || log.action, color: log.actionColor || '#6b7280', count: 0 };
        }
        stats.byAction[log.action].count++;
        
        // 按操作级别统计
        const level = log.actionLevel || 'info';
        if (stats.byActionLevel[level] !== undefined) {
            stats.byActionLevel[level]++;
        }
        
        // 按用户统计
        if (!stats.byUser[log.username]) {
            stats.byUser[log.username] = { realName: log.realName || log.username, role: log.role, roleName: log.roleName, count: 0 };
        }
        stats.byUser[log.username].count++;
        
        // 按角色统计
        if (!stats.byRole[log.role]) {
            stats.byRole[log.role] = { name: log.roleName || log.role, count: 0 };
        }
        stats.byRole[log.role].count++;
        
        // 时间统计
        const logDate = new Date(log.timestamp);
        if (logDate >= today) {
            stats.todayCount++;
        }
        if (logDate >= weekAgo) {
            stats.weekCount++;
        }
        if (logDate >= monthAgo) {
            stats.monthCount++;
        }
        
        // 成功/失败统计
        if (log.success) {
            stats.successCount++;
        } else {
            stats.failedCount++;
        }
    });
    
    return stats;
}

/**
 * 获取操作趋势数据
 * @param {number} days 天数
 */
function getAuditTrend(days = 7) {
    const logs = getAuditLogs();
    const trend = [];
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= date && logDate < nextDate;
        });
        
        trend.push({
            date: formatDate(date),
            count: dayLogs.length,
            byAction: {
                create: dayLogs.filter(l => l.action === 'create').length,
                update: dayLogs.filter(l => l.action === 'update').length,
                delete: dayLogs.filter(l => l.action === 'delete').length
            }
        });
    }
    
    return trend;
}

/**
 * 导出审计日志（支持多种格式）
 * @param {string} format 导出格式 ('json' | 'csv' | 'xlsx')
 * @param {Object} filters 筛选条件（可选）
 */
function exportAuditLogs(format = 'json', filters = {}) {
    let logs = getAuditLogs();
    
    if (Object.keys(filters).length > 0) {
        const result = queryAuditLogsCore({ ...filters, page: 1, pageSize: 99999 });
        logs = result.logs;
    }
    
    if (format === 'json') {
        const dataStr = JSON.stringify(logs, null, 2);
        downloadFile(dataStr, '审计日志_' + formatDateTime(new Date()) + '.json', 'application/json');
    } else if (format === 'csv') {
        const headers = ['时间', '用户名', '真实姓名', '角色', '模块', '操作类型', '操作级别', '操作描述', '目标ID', '操作成功', '错误信息', '变更详情'];
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
            const row = [
                formatDateTime(new Date(log.timestamp)),
                `"${log.username}"`,
                `"${log.realName || ''}"`,
                `"${log.roleName || log.role}"`,
                `"${log.moduleName || log.module}"`,
                `"${log.actionName || log.action}"`,
                `"${log.actionLevel || 'info'}"`,
                `"${(log.targetDesc || '').replace(/"/g, '""')}"`,
                `"${log.targetId || ''}"`,
                log.success ? '是' : '否',
                `"${log.errorMessage || ''}"`,
                `"${log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : ''}"`
            ];
            csvRows.push(row.join(','));
        });
        
        downloadFile(csvRows.join('\n'), '审计日志_' + formatDateTime(new Date()) + '.csv', 'text/csv');
    }
}

/**
 * 格式化日期
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * 下载文件
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 记录登录日志
 */
function recordLoginLog(success = true, errorMessage = null) {
    return recordAuditLog({
        module: 'system',
        action: 'login',
        targetId: '-',
        targetDesc: success ? '用户登录成功' : '用户登录失败',
        success: success,
        errorMessage: errorMessage,
        source: 'login'
    });
}

/**
 * 记录退出日志
 */
function recordLogoutLog() {
    return recordAuditLog({
        module: 'system',
        action: 'logout',
        targetId: '-',
        targetDesc: '用户退出系统',
        source: 'logout'
    });
}

/**
 * 记录批量操作日志
 * @param {Object} params 参数
 * @param {number} count 操作数量
 */
function recordBatchAuditLog(params, count) {
    return recordAuditLog({
        ...params,
        targetDesc: `${params.targetDesc}（共${count}条）`,
        source: 'batch'
    });
}

// 导出到window对象
window.AUDIT_CONFIG = AUDIT_CONFIG;
window.recordAuditLog = recordAuditLog;
window.getAuditLogs = getAuditLogs;
window.queryAuditLogsCore = queryAuditLogsCore;
window.getAuditStats = getAuditStats;
window.getAuditTrend = getAuditTrend;
window.exportAuditLogs = exportAuditLogs;
window.isTopAdmin = isTopAdmin;
window.syncAuditLogsFromCloud = syncAuditLogsFromCloud;
window.refreshAuditLogsFromCloud = async function() {
    await syncAuditLogsFromCloud();
    if (typeof queryAuditLogs === 'function') {
        queryAuditLogs(1);
    }
    alert('已从云端同步审计日志');
};
window.cleanupOldLogs = cleanupOldLogs;
window.clearAllAuditLogs = clearAllAuditLogs;
window.commitAllPendingAuditLogs = commitAllPendingAuditLogs;
window.getPendingAuditLogs = getPendingAuditLogs;
window.savePendingAuditLogs = savePendingAuditLogs;
window.recordLoginLog = recordLoginLog;
window.recordLogoutLog = recordLogoutLog;
window.recordBatchAuditLog = recordBatchAuditLog;