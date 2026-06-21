/**
 * 离线操作队列模块 - 确保数据不丢失
 * 
 * 核心功能：
 * 1. 离线操作暂存
 * 2. 自动重试机制
 * 3. 同步状态追踪
 * 4. 用户确认机制
 */

const OFFLINE_QUEUE_CONFIG = {
    STORAGE_KEY: 'offlineSyncQueue',
    MAX_RETRIES: 5,
    RETRY_DELAYS: [5000, 15000, 30000, 60000, 120000], // 5s, 15s, 30s, 1m, 2m
    BATCH_SIZE: 10,
    PROCESS_INTERVAL: 3000, // 3秒检查一次
    MAX_QUEUE_SIZE: 500
};

// 队列处理状态
let queueProcessing = false;
let processTimer = null;
let syncStatusListeners = [];

// ==================== 队列管理 ====================

/**
 * 获取离线队列
 */
function getOfflineQueue() {
    try {
        const data = localStorage.getItem(OFFLINE_QUEUE_CONFIG.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('[离线队列] 获取队列失败:', e);
        return [];
    }
}

/**
 * 保存离线队列
 */
function saveOfflineQueue(queue) {
    try {
        // 限制队列大小
        if (queue.length > OFFLINE_QUEUE_CONFIG.MAX_QUEUE_SIZE) {
            console.warn('[离线队列] 队列过大，保留最新的记录');
            queue = queue.slice(-OFFLINE_QUEUE_CONFIG.MAX_QUEUE_SIZE);
        }
        localStorage.setItem(OFFLINE_QUEUE_CONFIG.STORAGE_KEY, JSON.stringify(queue));
        notifySyncStatusChange();
    } catch (e) {
        console.error('[离线队列] 保存队列失败:', e);
    }
}

/**
 * 添加操作到队列
 * @param {Object} operation 操作对象
 * @param {string} operation.module - 模块名称
 * @param {string} operation.type - 操作类型 (create/update/delete)
 * @param {string} operation.recordId - 记录ID
 * @param {Object} operation.data - 操作数据
 * @param {Object} operation.oldData - 旧数据（用于回滚）
 */
function addToOfflineQueue(operation) {
    const queue = getOfflineQueue();
    
    // 检查是否已有相同记录的操作（更新操作可能被多次触发）
    const existingIndex = queue.findIndex(item => 
        item.recordId === operation.recordId && 
        item.module === operation.module &&
        item.type === 'update'
    );
    
    if (existingIndex !== -1) {
        // 更新操作：合并数据
        queue[existingIndex].data = { ...queue[existingIndex].data, ...operation.data };
        queue[existingIndex].timestamp = Date.now();
        queue[existingIndex].retryCount = 0;
    } else {
        // 新操作
        queue.push({
            id: generateOfflineId(),
            ...operation,
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
            lastError: null
        });
    }
    
    saveOfflineQueue(queue);
    console.log('[离线队列] 添加操作:', operation.type, operation.module, operation.recordId);
    
    // 尝试立即处理
    processQueue();
    
    return true;
}

/**
 * 从队列中移除操作
 */
function removeFromQueue(operationId) {
    const queue = getOfflineQueue();
    const filtered = queue.filter(item => item.id !== operationId);
    saveOfflineQueue(filtered);
}

/**
 * 更新队列中的操作
 */
function updateQueueItem(operationId, updates) {
    const queue = getOfflineQueue();
    const index = queue.findIndex(item => item.id === operationId);
    if (index !== -1) {
        queue[index] = { ...queue[index], ...updates };
        saveOfflineQueue(queue);
    }
}

/**
 * 生成唯一ID
 */
function generateOfflineId() {
    return 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==================== 同步执行 ====================

/**
 * 处理队列
 */
async function processQueue() {
    if (queueProcessing) {
        console.log('[离线队列] 队列正在处理中，跳过');
        return;
    }
    
    const queue = getOfflineQueue();
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
        return;
    }
    
    queueProcessing = true;
    console.log('[离线队列] 开始处理队列，待处理:', pendingItems.length, '条');
    
    // 分批处理
    const batch = pendingItems.slice(0, OFFLINE_QUEUE_CONFIG.BATCH_SIZE);
    
    for (const item of batch) {
        await processQueueItem(item);
    }
    
    queueProcessing = false;
    
    // 继续检查是否还有待处理项
    const remainingQueue = getOfflineQueue();
    const remainingPending = remainingQueue.filter(i => i.status === 'pending').length;
    
    if (remainingPending > 0) {
        console.log('[离线队列] 还有', remainingPending, '条待处理，3秒后继续');
        scheduleNextProcess();
    } else {
        console.log('[离线队列] 队列处理完成');
    }
    
    notifySyncStatusChange();
}

/**
 * 处理单个队列项
 */
async function processQueueItem(item) {
    const { id, module, type, recordId, data } = item;
    
    try {
        console.log('[离线队列] 处理:', type, module, recordId);
        
        let result;
        
        switch (type) {
            case 'create':
                result = await syncCreateToCloud(module, recordId, data);
                break;
            case 'update':
                result = await syncUpdateToCloud(module, recordId, data);
                break;
            case 'delete':
                result = await syncDeleteToCloud(module, recordId);
                break;
            default:
                throw new Error('未知的操作类型: ' + type);
        }
        
        if (result.success) {
            // 成功：标记并移除
            removeFromQueue(id);
            console.log('[离线队列] ✓ 同步成功:', module, recordId);
            
            // 记录审计日志
            if (typeof recordAuditLog === 'function') {
                recordAuditLog({
                    module: module,
                    action: type,
                    targetId: recordId,
                    targetDesc: getRecordDesc(module, data)
                }, true);
            }
        } else {
            throw new Error(result.message || '同步失败');
        }
        
    } catch (error) {
        console.error('[离线队列] ✗ 同步失败:', module, recordId, error.message);
        
        // 增加重试计数
        const queue = getOfflineQueue();
        const index = queue.findIndex(i => i.id === id);
        
        if (index !== -1) {
            queue[index].retryCount++;
            queue[index].lastError = error.message;
            
            if (queue[index].retryCount >= OFFLINE_QUEUE_CONFIG.MAX_RETRIES) {
                // 超过最大重试次数，标记为失败
                queue[index].status = 'failed';
                console.error('[离线队列] ⚠️ 超过最大重试次数:', module, recordId);
            } else {
                queue[index].status = 'pending';
            }
            
            saveOfflineQueue(queue);
        }
    }
}

/**
 * 创建记录到云端
 */
async function syncCreateToCloud(module, recordId, data) {
    const tableName = supabaseConfig?.tables?.[module];
    if (!tableName) {
        return { success: false, message: '未找到模块对应的表' };
    }
    
    try {
        let cleanedData = cleanInspectionData(module, data);
        
        // 如果是 hazard 或 samplingAnomaly 模块，需要处理字段命名转换
        if (module === 'hazard') {
            cleanedData = cleanHazardData(cleanedData);
        }
        if (module === 'samplingAnomaly') {
            cleanedData = cleanSamplingAnomalyData(cleanedData);
        }
        
        const existing = await supabaseRequest('GET', tableName, null, { id: `eq.${recordId}` });
        
        if (existing && existing.length > 0) {
            const result = await supabaseRequest('PATCH', tableName, {
                ...cleanedData,
                updated_at: new Date().toISOString()
            }, { id: `eq.${recordId}` });
            return { success: true, operation: 'update' };
        } else {
            const result = await supabaseRequest('POST', tableName, {
                id: recordId,
                ...cleanedData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            return { success: true, operation: 'create' };
        }
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * 更新记录到云端
 */
async function syncUpdateToCloud(module, recordId, data) {
    const tableName = supabaseConfig?.tables?.[module];
    if (!tableName) {
        return { success: false, message: '未找到模块对应的表' };
    }
    
    try {
        if (module === 'training') {
            const year = data.year;
            console.log(`[离线队列] ${module} 按年份 ${year} 查询...`);
            
            const existingData = await supabaseRequest('GET', tableName, null, { year: `eq.${year}` });
            console.log(`[离线队列] ${module} 云端现有数据:`, existingData);
            
            if (existingData && existingData.length > 0 && existingData[0].id) {
                console.log(`[离线队列] ${module} 执行 PATCH 更新，ID: ${existingData[0].id}`);
                const result = await supabaseRequest('PATCH', tableName, {
                    ...data,
                    updated_at: new Date().toISOString()
                }, { id: `eq.${existingData[0].id}` });
                console.log(`[离线队列] ${module} PATCH 结果:`, result);
                return { success: true };
            } else {
                const newId = generateStandardUUID();
                console.log(`[离线队列] ${module} 执行 POST 创建，新ID: ${newId}`);
                
                // 如果是hazard模块，需要处理字段命名转换
                let postData = data;
                if (module === 'hazard') {
                    postData = cleanHazardData(data);
                }
                if (module === 'samplingAnomaly') {
                    postData = cleanSamplingAnomalyData(data);
                }
                
                const result = await supabaseRequest('POST', tableName, {
                    id: newId,
                    ...postData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                console.log(`[离线队列] ${module} POST 结果:`, result);
                return { success: true };
            }
        }
        
        const cleanedData = cleanInspectionData(module, data);
        
        // 如果是hazard模块，需要处理字段命名转换
        let finalData = cleanedData;
        if (module === 'hazard') {
            finalData = Array.isArray(cleanedData) ? cleanedData.map(item => cleanHazardData(item)) : cleanHazardData(cleanedData);
        }
        if (module === 'samplingAnomaly') {
            finalData = Array.isArray(cleanedData) ? cleanedData.map(item => cleanSamplingAnomalyData(item)) : cleanSamplingAnomalyData(cleanedData);
        }
        
        const result = await supabaseRequest('PATCH', tableName, {
            ...finalData,
            updated_at: new Date().toISOString()
        }, { id: `eq.${recordId}` });
        return { success: true };
    } catch (e) {
        console.error(`[离线队列] ${module} 同步失败:`, e.message);
        return { success: false, message: e.message };
    }
}

/**
 * 清理隐患数据，将驼峰命名字段转换为下划线命名
 * @param {Object} data - 隐患数据
 * @returns {Object} 清理后的数据
 */
function cleanHazardData(data) {
    if (!data || typeof data !== 'object') {
        return data;
    }
    
    return {
        id: data.id,
        title: data.title || '',
        description: data.description || '',
        assignee: data.assignee || '',
        priority: data.priority || 'normal',
        status: data.status || 'pending',
        progress: data.progress || 0,
        deadline: data.deadline || null,
        notes: data.notes || data.remark || '',
        remark: data.remark || data.notes || '',
        completion_note: data.completion_note || data.completionNote || '',
        completion_user: data.completion_user || data.completionUser || '',
        // jsonb 字段直接使用数组
        reject_records: data.reject_records || data.rejectRecords || [],
        completion_records: data.completion_records || data.completionRecords || [],
        progress_records: data.progress_records || data.progressRecords || [],
        cannot_complete_records: data.cannot_complete_records || data.cannotCompleteRecords || [],
        status_change_records: data.status_change_records || data.statusChangeRecords || [],
        escalate_records: data.escalate_records || data.escalateRecords || [],
        created_at: data.created_at || data.createTime || new Date().toISOString(),
        updated_at: data.updated_at || data.updateTime || new Date().toISOString(),
        _sync_version: data._sync_version || 1,
        report_date: data.report_date || data.reportDate || null,
        department: data.department || '',
        reporter: data.reporter || '',
        category: data.category || '',
        hazard_type: data.hazard_type || data.hazardType || '',
        hazard_level: data.hazard_level || data.hazardLevel || '',
        result: data.result || '',
        creator: data.creator || '',
        creator_role: data.creator_role || data.creatorRole || '',
        is_admin_created: data.is_admin_created || data.isAdminCreated || false
    };
}

/**
 * 清理采样点异常数据，将驼峰命名字段转换为下划线命名
 * @param {Object} data - 采样点异常数据
 * @returns {Object} 清理后的数据
 */
function cleanSamplingAnomalyData(data) {
    if (!data || typeof data !== 'object') {
        return data;
    }
    
    return {
        id: data.id,
        device: data.device || '',
        tag: data.tag || '',
        sample_name: data.sample_name || data.sampleName || '',
        problem_desc: data.problem_desc || data.problemDesc || '',
        report_time: data.report_time || data.reportTime || '',
        reporter: data.reporter || '',
        rectifier: data.rectifier || '',
        completion_status: data.completion_status || data.completionStatus || 'progress',
        completion_note: data.completion_note || data.completionNote || '',
        confirmer: data.confirmer || '',
        remark: data.remark || '',
        created_at: data.created_at || data.createTime || new Date().toISOString(),
        updated_at: data.updated_at || data.updateTime || new Date().toISOString(),
        _sync_version: data._sync_version || 1,
        _user_id: data._user_id || '',
        // jsonb 字段直接使用数组
        status_history: data.status_history || data.statusHistory || [],
        completion_records: data.completion_records || data.completionRecords || [],
        reject_records: data.reject_records || data.rejectRecords || [],
        escalate_records: data.escalate_records || data.escalateRecords || [],
        protected: data.protected || false,
        processing_report: data.processing_report || data.processingReport || '',
        confirmed_by_leader: data.confirmed_by_leader || data.confirmedByLeader || ''
    };
}

/**
 * 清理 inspection 数据，移除云端表中不存在的字段
 * 同时处理字段映射（如 date -> checktime）
 * @param {string} module - 模块名称
 * @param {Object} data - 原始数据
 * @returns {Object} 清理后的数据
 */
function cleanInspectionData(module, data) {
    const inspectionModules = ['centerInspection', 'workshopInspection', 'inspection'];
    
    if (!inspectionModules.includes(module)) {
        return data;
    }
    
    const fieldMappings = {
        'date': 'checktime',
        'unit': 'checkunit'
    };
    
    const allowedFields = [
        'id', 'checkunit', 'checktime', 'deadline', 'description', 
        'inspector', 'status', 'responsible', 'responsiblePerson', 'measures', 
        'inspectioncategory', 'category', 'created_at', 'updated_at', 'date', 'unit'
    ];
    
    const cleaned = {};
    
    for (const field of allowedFields) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
            const targetField = fieldMappings[field] || field;
            
            if (targetField === 'checktime' && !data['checktime'] && data['date']) {
                cleaned['checktime'] = data['date'];
            } else if (targetField === 'checkunit' && !data['checkunit'] && data['unit']) {
                cleaned['checkunit'] = data['unit'];
            } else if (targetField === field) {
                cleaned[field] = data[field];
            }
        }
    }
    
    return cleaned;
}

/**
 * 生成标准 UUID 格式
 */
function generateStandardUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 检查ID是否为标准UUID格式
 */
function isValidUUID(id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}

/**
 * 删除云端记录
 */
async function syncDeleteToCloud(module, recordId) {
    const tableName = supabaseConfig?.tables?.[module];
    if (!tableName) {
        return { success: false, message: '未找到模块对应的表' };
    }
    
    try {
        if (!isValidUUID(recordId)) {
            console.warn(`[离线队列] ${module} 删除跳过：ID不是标准UUID格式: ${recordId}`);
            // ID不是标准UUID格式，尝试通过其他字段查找并删除
            return await syncDeleteByAlternativeKey(module, recordId);
        }
        
        const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${recordId}` });
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * 通过备用字段删除云端记录（当ID不是标准UUID时使用）
 */
async function syncDeleteByAlternativeKey(module, recordId) {
    const tableName = supabaseConfig?.tables?.[module];
    if (!tableName) {
        return { success: false, message: '未找到模块对应的表' };
    }
    
    try {
        // 先尝试直接用recordId删除（可能是TEXT类型的ID）
        const directDeleteResult = await supabaseRequest('DELETE', tableName, null, { id: `eq.${recordId}` });
        if (directDeleteResult && !directDeleteResult.error) {
            return { success: true };
        }
        
        // 查询所有记录，尝试找到匹配的记录
        const records = await supabaseRequest('GET', tableName);
        if (!records || records.length === 0) {
            console.warn(`[离线队列] ${module} 删除跳过：云端无数据，本地已删除`);
            return { success: true };
        }
        
        // 对于隐患排查治理，尝试通过多种字段匹配
        if (module === 'hazard') {
            for (const record of records) {
                if (record.id === recordId || 
                    record.title === recordId ||
                    record.id?.includes(recordId.replace('hz_', '')) ||
                    record.id?.includes(recordId)) {
                    const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${record.id}` });
                    return { success: true };
                }
            }
            console.warn(`[离线队列] ${module} 删除跳过：云端无匹配记录，本地已删除`);
            return { success: true };
        }
        
        // 对于采样点异常，尝试通过多种字段匹配
        if (module === 'samplingAnomaly') {
            for (const record of records) {
                if (record.id === recordId || 
                    record.device === recordId ||
                    record.tag === recordId ||
                    record.sample_name === recordId ||
                    record.id?.includes(recordId.replace('sa_', '')) ||
                    record.id?.includes(recordId)) {
                    const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${record.id}` });
                    return { success: true };
                }
            }
            console.warn(`[离线队列] ${module} 删除跳过：云端无匹配记录，本地已删除`);
            return { success: true };
        }
        
        // 对于任务管理，尝试通过多种字段匹配
        if (module === 'task') {
            for (const record of records) {
                if (record.id === recordId || 
                    record.title === recordId ||
                    record.id?.includes(recordId.replace('tk_', '')) ||
                    record.id?.includes(recordId)) {
                    const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${record.id}` });
                    return { success: true };
                }
            }
            console.warn(`[离线队列] ${module} 删除跳过：云端无匹配记录，本地已删除`);
            return { success: true };
        }
        
        // 通用处理：尝试查找ID包含recordId的记录
        for (const record of records) {
            if (record.id === recordId || 
                record.id?.includes(recordId.replace(/^[a-z]+_/i, '')) ||
                record.id?.includes(recordId)) {
                const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${record.id}` });
                return { success: true };
            }
        }
        
        // 如果云端没有找到记录，说明本地删除的记录从未上传到云端，直接标记成功
        console.warn(`[离线队列] ${module} 删除跳过：云端无匹配记录，本地已删除`);
        return { success: true };
    } catch (e) {
        console.error(`[离线队列] ${module} 删除异常: ${e.message}`);
        return { success: false, message: e.message };
    }
}

/**
 * 获取记录描述
 */
function getRecordDesc(module, data) {
    if (!data) return '未知';
    
    // 各模块的名称字段
    const nameFields = {
        personnel: 'name',
        task: 'title',
        hazard: 'title',
        inspection: 'description',
        honor: 'honorName',
        training: 'name',
        patrol: 'name',
        samplingCar: 'carNo',
        samplingAnomaly: 'sampleName',
        instrument: 'name'
    };
    
    const field = nameFields[module] || 'name';
    return data[field] || data.title || data.name || data.sample_name || '记录';
}

/**
 * 安排下一次处理
 */
function scheduleNextProcess() {
    if (processTimer) {
        clearTimeout(processTimer);
    }
    processTimer = setTimeout(() => {
        processQueue();
    }, OFFLINE_QUEUE_CONFIG.PROCESS_INTERVAL);
}

/**
 * 启动队列监听
 */
function startQueueListener() {
    // 页面加载时检查队列
    const queue = getOfflineQueue();
    const pendingCount = queue.filter(i => i.status === 'pending').length;
    const failedCount = queue.filter(i => i.status === 'failed').length;
    
    console.log('[离线队列] 启动监听，待处理:', pendingCount, '条，失败:', failedCount, '条');
    
    if (pendingCount > 0) {
        processQueue();
    }
    
    // 定时检查
    setInterval(() => {
        const queue = getOfflineQueue();
        const pendingCount = queue.filter(i => i.status === 'pending').length;
        
        if (pendingCount > 0 && !queueProcessing) {
            processQueue();
        }
    }, OFFLINE_QUEUE_CONFIG.PROCESS_INTERVAL);
    
    // 网络恢复时立即处理
    window.addEventListener('online', () => {
        console.log('[离线队列] 网络已恢复，开始处理队列');
        processQueue();
    });
}

// ==================== 同步状态追踪 ====================

/**
 * 同步状态
 */
const SYNC_STATUS = {
    SYNCED: 'synced',           // 已同步
    PENDING: 'pending',         // 待同步
    SYNCING: 'syncing',         // 同步中
    FAILED: 'failed',           // 同步失败
    OFFLINE: 'offline'          // 离线
};

/**
 * 获取同步状态
 */
function getGlobalSyncStatus() {
    const queue = getOfflineQueue();
    const pending = queue.filter(i => i.status === 'pending').length;
    const failed = queue.filter(i => i.status === 'failed').length;
    
    if (!navigator.onLine) {
        return { status: SYNC_STATUS.OFFLINE, pending, failed, total: queue.length };
    }
    
    if (failed > 0) {
        return { status: SYNC_STATUS.FAILED, pending, failed, total: queue.length };
    }
    
    if (pending > 0) {
        return { status: SYNC_STATUS.PENDING, pending, failed, total: queue.length };
    }
    
    return { status: SYNC_STATUS.SYNCED, pending: 0, failed: 0, total: 0 };
}

/**
 * 获取记录同步状态
 */
function getRecordSyncStatus(module, recordId) {
    const queue = getOfflineQueue();
    const item = queue.find(i => i.module === module && i.recordId === recordId);
    
    if (!item) {
        return SYNC_STATUS.SYNCED;
    }
    
    return item.status === 'failed' ? SYNC_STATUS.FAILED : SYNC_STATUS.PENDING;
}

/**
 * 重新同步失败项
 */
async function retryFailedItems() {
    const queue = getOfflineQueue();
    const failedItems = queue.filter(i => i.status === 'failed');
    
    if (failedItems.length === 0) {
        return { success: true, message: '没有需要重试的项目' };
    }
    
    console.log('[离线队列] 重试失败项目:', failedItems.length, '条');
    
    // 重置状态
    for (const item of failedItems) {
        updateQueueItem(item.id, { status: 'pending', retryCount: 0 });
    }
    
    // 开始处理
    await processQueue();
    
    return getGlobalSyncStatus();
}

/**
 * 清除失败项（放弃同步）
 */
function clearFailedItems() {
    const queue = getOfflineQueue();
    const failedItems = queue.filter(i => i.status === 'failed');
    
    for (const item of failedItems) {
        removeFromQueue(item.id);
    }
    
    console.log('[离线队列] 已清除', failedItems.length, '条失败记录');
    notifySyncStatusChange();
    
    return { cleared: failedItems.length };
}

/**
 * 添加状态变更监听器
 */
function addSyncStatusListener(callback) {
    syncStatusListeners.push(callback);
}

/**
 * 通知状态变更
 */
function notifySyncStatusChange() {
    const status = getGlobalSyncStatus();
    syncStatusListeners.forEach(callback => {
        try {
            callback(status);
        } catch (e) {
            console.error('[离线队列] 状态监听器执行失败:', e);
        }
    });
}

// ==================== 导出到全局 ====================

window.OfflineQueue = {
    add: addToOfflineQueue,
    process: processQueue,
    getStatus: getGlobalSyncStatus,
    getRecordStatus: getRecordSyncStatus,
    retryFailed: retryFailedItems,
    clearFailed: clearFailedItems,
    addListener: addSyncStatusListener,
    getQueue: getOfflineQueue,
    start: startQueueListener,
    CONFIG: OFFLINE_QUEUE_CONFIG
};

// 启动监听
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(startQueueListener, 2000);
    });
}

console.log('[离线队列] 模块已加载');
