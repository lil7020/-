/**
 * 可靠数据同步模块 - 解决多用户并发编辑冲突
 *
 * 核心功能：
 * 1. 乐观锁（版本号控制）
 * 2. 冲突检测与解决
 * 3. 变更历史记录
 * 4. 同步确认机制
 */

const RELIABLE_SYNC_CONFIG = {
    STORAGE_KEY: 'dataChangeHistory',
    MAX_HISTORY: 1000,
    SYNC_RETRY_TIMES: 3,
    SYNC_RETRY_DELAY: 1000,
    CONFLICT_STRATEGY: 'prompt' // 'prompt' | 'local' | 'cloud'
};

let conflictCallback = null;

function setConflictCallback(callback) {
    conflictCallback = callback;
}

/**
 * 为数据添加版本信息
 */
function addVersionInfo(record, operation) {
    return {
        ...record,
        _sync_version: (record._sync_version || 0) + 1,
        _last_modified: new Date().toISOString(),
        _modified_by: getCurrentUsername(),
        _operation: operation
    };
}

/**
 * 获取当前用户名
 */
function getCurrentUsername() {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return user.username || 'unknown';
    } catch (e) {
        return 'unknown';
    }
}

/**
 * 按ID去重数组 - 保留最后出现的记录，防止数据重复
 * @param {Array} arr - 要去重的数组
 * @param {string} key - 去重依据的字段名，默认 'id'
 * @returns {Array} 去重后的数组
 */
function dedupByKey(arr, key = 'id') {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    const seen = new Set();
    const result = [];
    for (let i = arr.length - 1; i >= 0; i--) {
        const item = arr[i];
        if (item && item[key] !== undefined && item[key] !== null && item[key] !== '') {
            if (!seen.has(item[key])) {
                seen.add(item[key]);
                result.unshift(item);
            }
        }
    }
    return result;
}

/**
 * 检测数据冲突
 * @param {Object} localRecord - 本地记录
 * @param {Object} cloudRecord - 云端记录
 * @returns {boolean} 是否存在冲突
 */
function detectConflict(localRecord, cloudRecord) {
    if (!localRecord || !cloudRecord) return false;

    const localVersion = localRecord._sync_version || 0;
    const cloudVersion = cloudRecord._sync_version || 0;

    // 如果版本号相同，检查数据是否真的相同
    if (localVersion === cloudVersion) {
        const localData = JSON.stringify(sortObjectKeys(localRecord));
        const cloudData = JSON.stringify(sortObjectKeys(cloudRecord));
        return localData !== cloudData;
    }

    // 版本号不同，肯定有冲突
    return localVersion !== cloudVersion;
}

/**
 * 对对象键进行排序（用于比较）
 */
function sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }

    const sorted = {};
    Object.keys(obj)
        .filter(key => !key.startsWith('_'))
        .sort()
        .forEach(key => {
            sorted[key] = sortObjectKeys(obj[key]);
        });

    return sorted;
}

/**
 * 合并数据 - 智能冲突解决
 */
function mergeWithConflictResolution(localData, cloudData, moduleKey) {
    const mergedData = {
        headers: localData.headers || cloudData.headers || [],
        data: [],
        lastModified: new Date().toISOString(),
        _sync_version: Math.max(
            localData._sync_version || 0,
            cloudData._sync_version || 0
        ) + 1
    };

    const localRows = localData.data || [];
    const cloudRows = cloudData.data || [];

    // 创建本地数据的 Map（按 ID 索引）
    const localMap = new Map();
    localRows.forEach(row => {
        if (row.id) localMap.set(row.id, { ...row, _source: 'local' });
    });

    // 创建云端数据的 Map（按 ID 索引）
    const cloudMap = new Map();
    cloudRows.forEach(row => {
        if (row.id) cloudMap.set(row.id, { ...row, _source: 'cloud' });
    });

    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
    const conflicts = [];

    allIds.forEach(id => {
        const localRecord = localMap.get(id);
        const cloudRecord = cloudMap.get(id);

        if (localRecord && cloudRecord) {
            // 两条数据都存在，检查冲突
            if (detectConflict(localRecord, cloudRecord)) {
                // 有冲突！
                conflicts.push({
                    id: id,
                    local: localRecord,
                    cloud: cloudRecord
                });

                // 记录冲突
                recordDataConflict(moduleKey, id, localRecord, cloudRecord);

                // 使用较新的版本
                const localTime = new Date(localRecord._last_modified || 0);
                const cloudTime = new Date(cloudRecord._last_modified || 0);

                if (localTime >= cloudTime) {
                    mergedData.data.push(localRecord);
                } else {
                    mergedData.data.push(cloudRecord);
                }
            } else {
                // 没有冲突，使用任一版本
                mergedData.data.push(localRecord);
            }
        } else if (localRecord) {
            // 只在本地存在
            mergedData.data.push(localRecord);
        } else if (cloudRecord) {
            // 只在云端存在
            mergedData.data.push(cloudRecord);
        }
    });

    return {
        data: mergedData,
        conflicts: conflicts
    };
}

/**
 * 记录数据冲突
 */
function recordDataConflict(moduleKey, recordId, localRecord, cloudRecord) {
    const history = getDataChangeHistory();
    history.push({
        type: 'conflict',
        module: moduleKey,
        recordId: recordId,
        localData: filterVersionFields(localRecord),
        cloudData: filterVersionFields(cloudRecord),
        timestamp: new Date().toISOString(),
        username: getCurrentUsername()
    });

    saveDataChangeHistory(history);
    console.warn(`[冲突检测] 模块: ${moduleKey}, 记录ID: ${recordId}`);
}

/**
 * 过滤掉版本控制字段
 */
function filterVersionFields(record) {
    const filtered = { ...record };
    const versionFields = ['_sync_version', '_last_modified', '_modified_by', '_operation', '_source'];
    versionFields.forEach(field => delete filtered[field]);
    return filtered;
}

/**
 * 获取数据变更历史
 */
function getDataChangeHistory() {
    try {
        const history = localStorage.getItem(RELIABLE_SYNC_CONFIG.STORAGE_KEY);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        return [];
    }
}

/**
 * 保存数据变更历史
 */
function saveDataChangeHistory(history) {
    try {
        // 只保留最近的历史记录
        if (history.length > RELIABLE_SYNC_CONFIG.MAX_HISTORY) {
            history = history.slice(-RELIABLE_SYNC_CONFIG.MAX_HISTORY);
        }
        localStorage.setItem(RELIABLE_SYNC_CONFIG.STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.error('保存变更历史失败:', e);
    }
}

/**
 * 记录数据变更
 */
function recordDataChange(moduleKey, operation, recordId, oldData, newData) {
    const history = getDataChangeHistory();

    history.push({
        type: operation,
        module: moduleKey,
        recordId: recordId,
        oldData: filterVersionFields(oldData),
        newData: filterVersionFields(newData),
        timestamp: new Date().toISOString(),
        username: getCurrentUsername()
    });

    saveDataChangeHistory(history);
}

/**
 * 生成UUID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 解析任务时间字段
 * 处理多种时间格式：ISO格式、本地格式等
 */
function parseTaskTime(timeStr) {
    if (!timeStr) {
        return new Date(0);
    }
    
    // 如果已经是有效的Date对象
    if (timeStr instanceof Date) {
        return isNaN(timeStr.getTime()) ? new Date(0) : timeStr;
    }
    
    // 尝试直接解析
    let date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
        return date;
    }
    
    // 尝试解析中文格式（YYYY/MM/DD HH:mm:ss）
    if (typeof timeStr === 'string' && timeStr.includes('/')) {
        const parts = timeStr.match(/(\d+)/g);
        if (parts && parts.length >= 5) {
            // 格式：YYYY/MM/DD HH:mm:ss
            date = new Date(
                parseInt(parts[0]),
                parseInt(parts[1]) - 1,
                parseInt(parts[2]),
                parseInt(parts[3]),
                parseInt(parts[4]),
                parseInt(parts[5] || 0)
            );
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }
    
    console.warn(`[时间解析] 无法解析时间字符串: ${timeStr}`);
    return new Date(0);
}

/**
 * 可靠的同步函数 - 带重试和确认
 */
async function reliableSyncToCloud(moduleKey, data) {
    const tableName = supabaseConfig.tables[moduleKey];
    if (!tableName) {
        throw new Error(`未找到模块 ${moduleKey} 对应的表名`);
    }

    // 任务模块使用增量同步
    if (moduleKey === 'task') {
        return await reliableSyncTasksToCloud(data);
    }
    
    // 隐患模块使用增量同步
    if (moduleKey === 'hazard') {
        return await reliableSyncHazardsToCloud(data);
    }

    let lastError = null;

    // 重试机制
    for (let i = 0; i < RELIABLE_SYNC_CONFIG.SYNC_RETRY_TIMES; i++) {
        try {
            // 获取当前云端版本
            const cloudData = await supabaseRequest('GET', tableName);

            // 添加版本信息
            const syncVersion = (cloudData && cloudData.length > 0 && cloudData[0]._sync_version)
                ? cloudData[0]._sync_version + 1
                : 1;

            const dataWithVersion = {
                ...data,
                _sync_version: syncVersion,
                _last_sync: new Date().toISOString(),
                _last_sync_by: getCurrentUsername()
            };

            let result;

            if (cloudData && cloudData.length > 0 && cloudData[0].id) {
                // 更新现有记录
                result = await supabaseRequest('PATCH', tableName, dataWithVersion, {
                    id: `eq.${cloudData[0].id}`
                });

                if (result !== null && !Array.isArray(result)) {
                    // PATCH 成功（返回空对象或错误）
                    console.log(`[可靠同步] ${moduleKey} 数据更新成功`);
                    return { success: true, version: syncVersion };
                }
            }

            // 如果 PATCH 失败或没有现有记录，尝试创建
            result = await supabaseRequest('POST', tableName, {
                id: cloudData && cloudData.length > 0 ? cloudData[0].id : generateUUID(),
                ...dataWithVersion,
                _created_at: new Date().toISOString()
            });

            if (result) {
                console.log(`[可靠同步] ${moduleKey} 数据同步成功`);
                return { success: true, version: syncVersion };
            }

        } catch (error) {
            lastError = error;
            console.warn(`[可靠同步] ${moduleKey} 第 ${i + 1} 次尝试失败:`, error.message);

            // 等待后重试
            if (i < RELIABLE_SYNC_CONFIG.SYNC_RETRY_TIMES - 1) {
                await new Promise(resolve => setTimeout(resolve, RELIABLE_SYNC_CONFIG.SYNC_RETRY_DELAY));
            }
        }
    }

    throw new Error(`同步失败（已重试 ${RELIABLE_SYNC_CONFIG.SYNC_RETRY_TIMES} 次）: ${lastError?.message}`);
}

/**
 * 任务模块的增量同步 - 逐条记录处理
 */
async function reliableSyncTasksToCloud(taskTableData) {
    console.log('[可靠同步] 任务模块使用增量同步方式');
    console.log('[可靠同步] 传入的数据:', taskTableData);
    
    const tableName = supabaseConfig.tables['task'];
    if (!tableName) {
        throw new Error('未找到任务模块对应的表名');
    }

    // 使用传入的数据，确保使用最新的任务列表
    const localTasks = Array.isArray(taskTableData) ? taskTableData : (taskTableData.data || []);
    
    console.log(`[可靠同步] 本地任务数量: ${localTasks.length}`);
    console.log(`[可靠同步] 本地任务ID列表: ${localTasks.map(t => t.id).join(', ')}`);
    
    // 先获取云端所有任务，用于后续删除判断
    let allCloudTasks = [];
    try {
        allCloudTasks = await supabaseRequest('GET', tableName) || [];
        console.log(`[可靠同步] 云端现有 ${allCloudTasks.length} 条任务`);
        console.log(`[可靠同步] 云端任务ID列表: ${allCloudTasks.map(t => t.id).join(', ')}`);
    } catch (error) {
        console.warn('[可靠同步] 获取云端任务列表失败，将跳过删除操作:', error.message);
    }

    let successCount = 0;
    let failCount = 0;
    let deleteCount = 0;

    // 第一步：删除云端有但本地没有的任务
    if (allCloudTasks.length > 0 && localTasks.length > 0) {
        const localTaskIds = new Set(localTasks.map(t => t.id));
        console.log(`[可靠同步] 本地任务ID集合:`, Array.from(localTaskIds));
        
        for (const cloudTask of allCloudTasks) {
            const cloudTaskId = cloudTask.id;
            if (!localTaskIds.has(cloudTaskId)) {
                try {
                    console.log(`[可靠同步] 云端有但本地无，准备删除任务: ${cloudTaskId}`);
                    await supabaseRequest('DELETE', tableName, null, { id: `eq.${cloudTaskId}` });
                    deleteCount++;
                    successCount++;
                    console.log(`[可靠同步] ✅ 删除任务成功: ${cloudTaskId}`);
                    
                    // 记录审计日志
                    if (typeof logAudit === 'function') {
                        logAudit('task', 'delete', `从云端删除任务: ${cloudTask.title || cloudTaskId}`);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`[可靠同步] ❌ 删除任务失败: ${cloudTaskId}`, error.message);
                }
            }
        }
    } else if (allCloudTasks.length > 0 && localTasks.length === 0) {
        // 本地没有任务，删除云端所有任务
        console.log('[可靠同步] 本地任务为空，将删除云端所有任务');
        for (const cloudTask of allCloudTasks) {
            try {
                console.log(`[可靠同步] 本地为空，删除云端任务: ${cloudTask.id}`);
                await supabaseRequest('DELETE', tableName, null, { id: `eq.${cloudTask.id}` });
                deleteCount++;
                successCount++;
                console.log(`[可靠同步] ✅ 删除任务成功: ${cloudTask.id}`);
            } catch (error) {
                failCount++;
                console.error(`[可靠同步] ❌ 删除任务失败: ${cloudTask.id}`, error.message);
            }
        }
    }

    // 第二步：处理本地任务（更新或创建）
    for (const task of localTasks) {
        try {
            // 获取云端现有记录
            const cloudResponse = await supabaseRequest('GET', tableName, null, { id: `eq.${task.id}` });
            const existingTask = cloudResponse && cloudResponse.length > 0 ? cloudResponse[0] : null;

            const taskWithVersion = addVersionInfo(task, existingTask ? 'update' : 'create');

            if (existingTask) {
                // 检查是否需要更新
                const localTime = parseTaskTime(task.updated_at || task.created_at);
                const cloudTime = parseTaskTime(existingTask.updated_at || existingTask.created_at);
                const localVersion = taskWithVersion._sync_version || 0;
                const cloudVersion = existingTask._sync_version || 0;

                console.log(`[可靠同步] 比较任务 ${task.id}:`);
                console.log(`  本地: ${task.updated_at} -> ${localTime.toISOString()}, version: ${localVersion}`);
                console.log(`  云端: ${existingTask.updated_at} -> ${cloudTime.toISOString()}, version: ${cloudVersion}`);

                const needsUpdate = localTime > cloudTime || localVersion > cloudVersion;

                if (needsUpdate) {
                    console.log(`[可靠同步] 需要更新任务 ${task.id}，准备发送 PATCH 请求`);

                    // 强制复制数组数据，防止引用问题
                    const rejectRecordsCopy = Array.isArray(task.reject_records) 
                        ? JSON.parse(JSON.stringify(task.reject_records)) 
                        : [];
                    const completionRecordsCopy = Array.isArray(task.completion_records) 
                        ? JSON.parse(JSON.stringify(task.completion_records)) 
                        : [];
                    
                    console.log(`[可靠同步] 任务 ${task.id} rejectRecordsCopy:`, rejectRecordsCopy);
                    console.log(`[可靠同步] 任务 ${task.id} completionRecordsCopy:`, completionRecordsCopy);
                    
                    // 直接发送 PATCH 请求，包含所有字段
                    const updateData = {
                        title: task.title || '',
                        description: task.description || '',
                        assignee: task.assignee || '',
                        priority: task.priority || 'normal',
                        status: task.status || '待分配',
                        progress: task.progress || 0,
                        deadline: task.deadline || null,
                        notes: task.notes || '',
                        remark: task.remark || task.notes || '',
                        completion_note: task.completion_note || '',
                        completion_user: task.completion_user || '',
                        reject_records: rejectRecordsCopy,
                        completion_records: completionRecordsCopy,
                        confirm_records: task.confirm_records || task.confirmRecords || [],
                        updated_at: new Date().toISOString(),
                        _sync_version: taskWithVersion._sync_version || 1
                    };

                    const patchResult = await supabaseRequest('PATCH', tableName, updateData, { id: `eq.${task.id}` });

                    console.log(`[可靠同步] PATCH 请求完成，结果:`, patchResult);

                    if (patchResult !== null) {
                        successCount++;
                        console.log(`[可靠同步] ✅ 更新任务成功: ${task.id}`);
                    } else {
                        console.error(`[可靠同步] ❌ PATCH 返回 null，任务 ${task.id} 可能更新失败`);
                        // 尝试检查任务是否真的更新了
                        const verifyResult = await supabaseRequest('GET', tableName, null, { id: `eq.${task.id}` });
                        if (verifyResult && verifyResult.length > 0) {
                            const updatedTask = verifyResult[0];
                            const localUpdateTime = parseTaskTime(task.updated_at).getTime();
                            const cloudUpdateTime = parseTaskTime(updatedTask.updated_at).getTime();
                            if (cloudUpdateTime >= localUpdateTime) {
                                console.log(`[可靠同步] ✅ 验证通过：任务 ${task.id} 已更新`);
                                successCount++;
                            } else {
                                console.error(`[可靠同步] ❌ 验证失败：任务 ${task.id} 未更新`);
                                failCount++;
                            }
                        } else {
                            failCount++;
                        }
                    }
                }
            } else {
                // 创建新记录 - 包含所有字段
                // 强制复制数组数据，防止引用问题
                const rejectRecordsCopy = Array.isArray(task.reject_records) 
                    ? JSON.parse(JSON.stringify(task.reject_records)) 
                    : [];
                const completionRecordsCopy = Array.isArray(task.completion_records) 
                    ? JSON.parse(JSON.stringify(task.completion_records)) 
                    : [];
                    
                console.log(`[可靠同步] 创建任务 ${task.id} rejectRecordsCopy:`, rejectRecordsCopy);
                console.log(`[可靠同步] 创建任务 ${task.id} completionRecordsCopy:`, completionRecordsCopy);
                
                const createData = {
                    id: task.id,
                    title: task.title || '',
                    description: task.description || '',
                    assignee: task.assignee || '',
                    priority: task.priority || 'normal',
                    status: task.status || '待分配',
                    progress: task.progress || 0,
                    deadline: task.deadline || null,
                    notes: task.notes || '',
                    remark: task.remark || task.notes || '',
                    completion_note: task.completion_note || '',
                    completion_user: task.completion_user || '',
                    reject_records: rejectRecordsCopy,
                    completion_records: completionRecordsCopy,
                    confirm_records: task.confirm_records || task.confirmRecords || [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    _sync_version: taskWithVersion._sync_version || 1
                };

                await supabaseRequest('POST', tableName, createData);
                successCount++;
                console.log(`[可靠同步] 创建任务: ${task.id}`);
            }
        } catch (error) {
            failCount++;
            console.error(`[可靠同步] 同步任务 ${task.id} 失败:`, error.message);
        }
    }

    if (failCount === 0) {
        let message = `同步成功: ${successCount} 条`;
        if (deleteCount > 0) {
            message += ` (删除 ${deleteCount} 条)`;
        }
        return { success: true, message };
    } else {
        let message = `部分成功: ${successCount} 条成功, ${failCount} 条失败`;
        if (deleteCount > 0) {
            message += ` (删除 ${deleteCount} 条)`;
        }
        return { 
            success: successCount > 0, 
            message,
            successCount,
            failCount,
            deleteCount
        };
    }
}

/**
 * 隐患模块的增量同步 - 逐条记录处理
 */
// 【优化版】批量数组合并 - 用于多条记录的数据合并
function mergeArraysFast(localArr, cloudArr) {
    const seen = new Set();
    const result = [];

    // 同时处理本地和云端数组
    const arraysToProcess = [cloudArr, localArr];
    for (const arr of arraysToProcess) {
        if (!Array.isArray(arr)) continue;
        for (const rec of arr) {
            if (!rec) continue;
            let operatorStr = '';
            if (rec.operator) {
                if (typeof rec.operator === 'string') {
                    operatorStr = rec.operator;
                } else if (typeof rec.operator === 'object') {
                    operatorStr = rec.operator.username || rec.operator.name || JSON.stringify(rec.operator);
                }
            }
            const timeStr = rec.timestamp || rec.completionTime || rec.time || '';
            const noteStr = rec.completionNote || rec.rejectReason || rec.status || rec.from_status || '';
            const key = timeStr + '_' + operatorStr + '_' + noteStr;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(rec);
            }
        }
    }
    return result;
}

// 【优化版】隐患模块批量同步 - 3次请求搞定所有数据
async function reliableSyncHazardsToCloud(hazardTableData) {
    console.log('[可靠同步-优化版] 隐患模块批量同步');

    const tableName = supabaseConfig.tables['hazard'];
    if (!tableName) {
        throw new Error('未找到隐患模块对应的表名');
    }

    // 使用传入的数据
    const rawLocalHazards = Array.isArray(hazardTableData) ? hazardTableData : (hazardTableData.data || []);
    // 关键防御：同步前按ID去重
    const localHazards = dedupByKey(rawLocalHazards, 'id');
    const localCount = localHazards.length;
    if (rawLocalHazards.length !== localCount) {
        console.log(`[可靠同步-优化版] 隐患数据去重: ${rawLocalHazards.length} → ${localCount}，移除 ${rawLocalHazards.length - localCount} 条重复`);
    }
    console.log('[可靠同步-优化版] 本地隐患数量: ' + localCount);

    if (localCount === 0) {
        return { success: true, message: '没有隐患数据需要同步' };
    }

    let successCount = 0;
    let failCount = 0;
    let deleteCount = 0;

    // ========== 第一步：一次GET获取云端必要字段用于判断 ==========
    // 只拉取id, updated_at, _sync_version + 所有数组合并所需字段 → 响应体小很多
    const cloudHazards = await supabaseRequest('GET', tableName, null, {
        select: 'id,updated_at,_sync_version,reject_records,completion_records,status_change_records,progress_records,cannot_complete_records,escalate_records,confirm_records'
    }) || [];

    console.log('[可靠同步-优化版] 云端隐患数量: ' + cloudHazards.length);

    // 构建云端id→数据的快速索引
    const cloudMap = {};
    for (let i = 0; i < cloudHazards.length; i++) {
        cloudMap[cloudHazards[i].id] = cloudHazards[i];
    }
    const localIds = {};
    for (let i = 0; i < localHazards.length; i++) {
        localIds[localHazards[i].id] = true;
    }

    // ========== 第二步：收集需要删除的ID（云端有但本地没有） ==========
    const idsToDelete = [];
    for (let i = 0; i < cloudHazards.length; i++) {
        const cid = cloudHazards[i].id;
        if (!localIds[cid]) {
            idsToDelete.push(cid);
        }
    }

    // ========== 第三步：批量构建所有记录的请求体（新增 + 更新合并） ==========
    const upsertData = [];
    const now = new Date().toISOString();

    for (let i = 0; i < localHazards.length; i++) {
        const hazard = localHazards[i];
        if (!hazard.id) continue;

        const existingHazard = cloudMap[hazard.id];
        const hazardWithVersion = addVersionInfo(hazard, existingHazard ? 'update' : 'create');

        // 数组合并逻辑（云端有记录时才需要合并）
        let recRecs, compRecs, scRecs, progRecs, ccRecs, escRecs, confRecs;
        if (existingHazard) {
            recRecs = mergeArraysFast(hazard.reject_records, existingHazard.reject_records);
            compRecs = mergeArraysFast(hazard.completion_records, existingHazard.completion_records);
            scRecs = mergeArraysFast(hazard.status_change_records, existingHazard.status_change_records);
            progRecs = mergeArraysFast(hazard.progress_records, existingHazard.progress_records);
            ccRecs = mergeArraysFast(hazard.cannot_complete_records, existingHazard.cannot_complete_records);
            escRecs = mergeArraysFast(hazard.escalate_records, existingHazard.escalate_records);
            confRecs = mergeArraysFast(hazard.confirm_records || hazard.confirmRecords, existingHazard.confirm_records || existingHazard.confirmRecords);
        } else {
            recRecs = hazard.reject_records || [];
            compRecs = hazard.completion_records || [];
            scRecs = hazard.status_change_records || [];
            progRecs = hazard.progress_records || [];
            ccRecs = hazard.cannot_complete_records || [];
            escRecs = hazard.escalate_records || [];
            confRecs = hazard.confirm_records || hazard.confirmRecords || [];
        }

        const record = {
            id: hazard.id,
            title: hazard.title || '',
            description: hazard.description || '',
            assignee: hazard.assignee || '',
            priority: hazard.priority || 'normal',
            status: hazard.status || '待班长确认',
            progress: hazard.progress || 0,
            deadline: hazard.deadline || null,
            notes: hazard.notes || '',
            remark: hazard.remark || hazard.notes || '',
            completion_note: hazard.completion_note || '',
            completion_user: hazard.completion_user || '',
            reject_records: recRecs,
            completion_records: compRecs,
            progress_records: progRecs,
            cannot_complete_records: ccRecs,
            status_change_records: scRecs,
            escalate_records: escRecs,
            confirm_records: confRecs,
            hazard_type: hazard.hazard_type || hazard.hazardType || '',
            hazard_level: hazard.hazard_level || hazard.hazardLevel || '',
            report_date: hazard.report_date || hazard.reportDate || null,
            department: hazard.department || '',
            category: hazard.category || '',
            reporter: hazard.reporter || '',
            result: hazard.result || '',
            updated_at: now,
            _sync_version: hazardWithVersion._sync_version || 1,
            creator: hazard.creator || '',
            creator_role: hazard.creator_role || hazard.creatorRole || '',
            is_admin_created: hazard.is_admin_created || hazard.isAdminCreated || false
        };

        // 如果是新增记录，补上 created_at 字段
        if (!existingHazard) {
            record.created_at = now;
        }

        upsertData.push(record);
    }

    console.log('[可靠同步-优化版] 准备 upsert ' + upsertData.length + ' 条隐患记录');

    // ========== 第四步：一次 POST 请求完成所有新增和更新 ==========
    // 使用 on_conflict=id + resolution=merge-duplicates 实现批量 upsert
    if (upsertData.length > 0) {
        try {
            const url = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
            url.searchParams.append('on_conflict', 'id');

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': 'Bearer ' + supabaseConfig.key,
                    'Prefer': 'return=minimal, resolution=merge-duplicates'
                },
                body: JSON.stringify(upsertData)
            });

            if (response.ok) {
                successCount = upsertData.length;
                console.log('[可靠同步-优化版] ✅ 批量 upsert 成功: ' + successCount + ' 条');
            } else {
                const errText = await response.text();
                console.error('[可靠同步-优化版] ❌ 批量 upsert 失败: ' + response.status + ' ' + errText);

                // 降级方案：逐条 POST（Supabase 可能对批量数组 body 支持有限制）
                console.log('[可靠同步-优化版] 降级为逐条 upsert...');
                successCount = 0;
                for (let i = 0; i < upsertData.length; i++) {
                    try {
                        const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                        url2.searchParams.append('on_conflict', 'id');
                        await fetch(url2.toString(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': supabaseConfig.key,
                                'Authorization': 'Bearer ' + supabaseConfig.key,
                                'Prefer': 'return=minimal, resolution=merge-duplicates'
                            },
                            body: JSON.stringify(upsertData[i])
                        });
                        successCount++;
                    } catch (err) {
                        failCount++;
                        console.error('[可靠同步-优化版] 单条 upsert 失败: ' + upsertData[i].id, err.message);
                    }
                }
            }
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量 upsert 异常: ' + error.message);

            // 降级方案
            successCount = 0;
            for (let i = 0; i < upsertData.length; i++) {
                try {
                    const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                    url2.searchParams.append('on_conflict', 'id');
                    await fetch(url2.toString(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseConfig.key,
                            'Authorization': 'Bearer ' + supabaseConfig.key,
                            'Prefer': 'return=minimal, resolution=merge-duplicates'
                        },
                        body: JSON.stringify(upsertData[i])
                    });
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }
        }
    }

    // ========== 第五步：一次批量 DELETE 处理云端有但本地没有的记录 ==========
    if (idsToDelete.length > 0) {
        console.log('[可靠同步-优化版] 准备批量删除 ' + idsToDelete.length + ' 条云端记录');
        try {
            // 每批最多100个ID（避免URL太长）
            const DELETE_BATCH_SIZE = 100;
            for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH_SIZE) {
                const batch = idsToDelete.slice(i, i + DELETE_BATCH_SIZE);
                const deleteUrl = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                deleteUrl.searchParams.append('id', 'in.(' + batch.join(',') + ')');

                const delResponse = await fetch(deleteUrl.toString(), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabaseConfig.key,
                        'Authorization': 'Bearer ' + supabaseConfig.key
                    }
                });

                if (delResponse.ok) {
                    deleteCount += batch.length;
                    console.log('[可靠同步-优化版] ✅ 批量删除成功: ' + batch.length + ' 条');
                } else {
                    const err = await delResponse.text();
                    console.error('[可靠同步-优化版] ❌ 批量删除失败: ' + err);
                    // 降级：逐条删除
                    for (let j = 0; j < batch.length; j++) {
                        try {
                            await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + batch[j] });
                            deleteCount++;
                        } catch (de) {
                            failCount++;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量删除异常: ' + error.message);
            // 降级：逐条删除
            for (let j = 0; j < idsToDelete.length; j++) {
                try {
                    await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + idsToDelete[j] });
                    deleteCount++;
                } catch (de) {
                    failCount++;
                }
            }
        }
    }

    // 同步成功后提交待审计日志
    if (typeof commitAllPendingAuditLogs === 'function') {
        await commitAllPendingAuditLogs();
    }

    let message = '同步成功: ' + successCount + ' 条';
    if (deleteCount > 0) {
        message += ' (删除 ' + deleteCount + ' 条)';
    }
    if (failCount > 0) {
        message += ', 失败 ' + failCount + ' 条';
    }

    return {
        success: failCount === 0 || successCount > 0,
        message,
        successCount,
        failCount,
        deleteCount
    };
}

/**
 * 可靠的同步单条记录
 */
async function reliableSyncRecord(moduleKey, record) {
    const tableName = supabaseConfig.tables[moduleKey];
    if (!tableName) {
        throw new Error(`未找到模块 ${moduleKey} 对应的表名`);
    }

    // 任务模块使用特殊的增量同步方式
    if (moduleKey === 'task') {
        return await reliableSyncTaskRecord(record);
    }

    try {
        const recordWithVersion = addVersionInfo(record, 'update');

        // 获取云端版本
        const cloudData = await supabaseRequest('GET', tableName);

        if (cloudData && cloudData.length > 0 && cloudData[0].data) {
            const cloudRecords = cloudData[0].data;
            const existingIndex = cloudRecords.findIndex(r => r.id === record.id);

            if (existingIndex !== -1) {
                // 检查版本冲突
                const cloudRecord = cloudRecords[existingIndex];

                if (detectConflict(record, cloudRecord)) {
                    // 有冲突！
                    console.warn(`[可靠同步] 检测到冲突，记录ID: ${record.id}`);

                    // 使用较新的版本
                    const localTime = new Date(record._last_modified || 0);
                    const cloudTime = new Date(cloudRecord._last_modified || 0);

                    if (localTime >= cloudTime) {
                        // 本地更新，覆盖云端
                        cloudRecords[existingIndex] = recordWithVersion;
                    } else {
                        // 云端更新，返回云端版本
                        return {
                            success: false,
                            conflict: true,
                            cloudRecord: cloudRecord
                        };
                    }
                } else {
                    // 没有冲突，直接更新
                    cloudRecords[existingIndex] = recordWithVersion;
                }

                // 更新整个数据
                await reliableSyncToCloud(moduleKey, {
                    data: cloudRecords,
                    headers: cloudData[0].headers || []
                });

                return { success: true, version: recordWithVersion._sync_version };
            }
        }

        // 记录不存在，需要添加
        return { success: false, notFound: true };

    } catch (error) {
        console.error(`[可靠同步] 同步记录失败:`, error);
        throw error;
    }
}

/**
 * 同步单条任务记录到云端
 */
async function reliableSyncTaskRecord(record) {
    const tableName = supabaseConfig.tables['task'];
    if (!tableName) {
        throw new Error('未找到任务模块对应的表名');
    }

    try {
        // 获取云端现有记录
        const cloudResponse = await supabaseRequest('GET', tableName, null, { id: `eq.${record.id}` });
        const existingTask = cloudResponse && cloudResponse.length > 0 ? cloudResponse[0] : null;

        if (existingTask) {
            // 检查版本冲突
            if (detectConflict(record, existingTask)) {
                console.warn(`[可靠同步] 任务记录冲突，ID: ${record.id}`);

                const localTime = parseTaskTime(record._last_modified || record.updated_at);
                const cloudTime = parseTaskTime(existingTask._last_modified || existingTask.updated_at);

                if (localTime < cloudTime) {
                    // 云端更新更晚，返回冲突信息
                    return {
                        success: false,
                        conflict: true,
                        cloudRecord: existingTask
                    };
                }
            }

            // 更新现有记录 - 只发送数据库中存在的字段
            const localVersion = (record._sync_version || 0) + 1;
            const cloudVersion = existingTask._sync_version || 0;

            if (localVersion > cloudVersion) {
                const updateData = {
                    title: record.title || '',
                    description: record.description || '',
                    assignee: record.assignee || '',
                    priority: record.priority || 'normal',
                    status: record.status || '待分配',
                    progress: record.progress || 0,
                    deadline: record.deadline || null,
                    notes: record.notes || '',
                    remark: record.remark || record.notes || '',
                    completion_note: record.completion_note || '',
                    completion_user: record.completion_user || '',
                    reject_records: record.reject_records || [],
                    completion_records: record.completion_records || [],
                    _sync_version: localVersion,
                    updated_at: new Date().toISOString()
                };

                await supabaseRequest('PATCH', tableName, updateData, { id: `eq.${record.id}` });
                console.log(`[可靠同步] 更新任务记录: ${record.id}`);
            }

            return { success: true, version: localVersion };
        } else {
            // 记录不存在，需要添加
            return { success: false, notFound: true };
        }

    } catch (error) {
        console.error(`[可靠同步] 同步任务记录失败:`, error);
        throw error;
    }
}

/**
 * 同步前的数据验证
 */
function validateDataForSync(data, moduleKey) {
    const errors = [];

    if (!data) {
        errors.push('数据不能为空');
        return { valid: false, errors };
    }

    if (moduleKey === 'honor') {
        // 荣誉模块验证
        if (!data.honorName) errors.push('荣誉名称不能为空');
        if (!data.honorRecipient) errors.push('获奖人不能为空');
        if (!data.honorDate) errors.push('获奖日期不能为空');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * 获取冲突历史
 */
function getConflictHistory(moduleKey = null) {
    const history = getDataChangeHistory();
    return history.filter(h =>
        h.type === 'conflict' &&
        (!moduleKey || h.module === moduleKey)
    );
}

/**
 * 清除变更历史
 */
function clearChangeHistory() {
    localStorage.removeItem(RELIABLE_SYNC_CONFIG.STORAGE_KEY);
    console.log('数据变更历史已清除');
}

/**
 * 导出变更历史（用于审计）
 */
function exportChangeHistory(moduleKey = null) {
    const history = getDataChangeHistory();
    const filtered = moduleKey
        ? history.filter(h => h.module === moduleKey)
        : history;

    return JSON.stringify(filtered, null, 2);
}

// 导出到全局对象
window.reliableSync = {
    syncToCloud: reliableSyncToCloud,
    syncRecord: reliableSyncRecord,
    mergeWithConflictResolution: mergeWithConflictResolution,
    detectConflict: detectConflict,
    recordDataChange: recordDataChange,
    validateData: validateDataForSync,
    getConflictHistory: getConflictHistory,
    getChangeHistory: getDataChangeHistory,
    clearHistory: clearChangeHistory,
    exportHistory: exportChangeHistory,
    setConflictCallback: setConflictCallback,
    addVersionInfo: addVersionInfo
};

// 单独暴露任务和隐患同步函数
window.reliableSyncTasksToCloud = reliableSyncTasksToCloud;
window.reliableSyncHazardsToCloud = reliableSyncHazardsToCloud;

// 暴露隐患模块的增量同步函数
window.syncHazardDataIncrementally = async function(hazardDataToSync) {
    console.log('[隐患同步] 开始增量同步隐患数据...');

    // 确保使用最新的隐患数据
    let hazardData = hazardDataToSync || window.hazardData || [];
    // 入口防御：按ID去重
    if (Array.isArray(hazardData)) {
        const beforeLen = hazardData.length;
        hazardData = dedupByKey(hazardData, 'id');
        if (beforeLen !== hazardData.length) {
            console.log(`[隐患同步] 入口去重: ${beforeLen} → ${hazardData.length}`);
        }
    }

    if (!Array.isArray(hazardData) || hazardData.length === 0) {
        return { success: true, message: '没有隐患数据需要同步' };
    }
    
    console.log(`[隐患同步] 当前本地隐患数量: ${hazardData.length}`);
    console.log(`[隐患同步] 本地隐患ID列表: ${hazardData.map(h => h.id).join(', ')}`);
    
    // 调用可靠同步模块的隐患同步函数
    return await reliableSyncHazardsToCloud(hazardData);
};

/**
 * 采样点异常模块的增量同步 - 逐条记录处理
 */
// 【优化版】采样点异常模块批量同步 - 3次请求搞定所有数据
async function reliableSyncSamplingAnomaliesToCloud(samplingAnomalyTableData) {
    console.log('[可靠同步-优化版] 采样点异常模块批量同步');

    const tableName = supabaseConfig.tables['samplingAnomaly'];
    if (!tableName) {
        throw new Error('未找到采样点异常模块对应的表名');
    }

    const rawLocalAnomalies = Array.isArray(samplingAnomalyTableData) ? samplingAnomalyTableData : (samplingAnomalyTableData.data || []);
    // 关键防御：同步前按ID去重
    const localAnomalies = dedupByKey(rawLocalAnomalies, 'id');
    const localCount = localAnomalies.length;
    if (rawLocalAnomalies.length !== localCount) {
        console.log(`[可靠同步-优化版] 采样点异常数据去重: ${rawLocalAnomalies.length} → ${localCount}，移除 ${rawLocalAnomalies.length - localCount} 条重复`);
    }
    console.log('[可靠同步-优化版] 本地采样点异常数量: ' + localCount);

    if (localCount === 0) {
        return { success: true, message: '没有采样点异常数据需要同步' };
    }

    let successCount = 0;
    let failCount = 0;
    let deleteCount = 0;

    // ========== 第一步：一次GET获取云端必要字段
    const cloudAnomalies = await supabaseRequest('GET', tableName, null, {
        select: 'id,updated_at,_sync_version,status_history,completion_records,reject_records,escalate_records,confirm_records'
    }) || [];

    console.log('[可靠同步-优化版] 云端采样点异常数量: ' + cloudAnomalies.length);

    const cloudMap = {};
    for (let i = 0; i < cloudAnomalies.length; i++) {
        cloudMap[cloudAnomalies[i].id] = cloudAnomalies[i];
    }
    const localIds = {};
    for (let i = 0; i < localAnomalies.length; i++) {
        localIds[localAnomalies[i].id] = true;
    }

    // ========== 第二步：收集需要删除的ID
    const idsToDelete = [];
    for (let i = 0; i < cloudAnomalies.length; i++) {
        const cid = cloudAnomalies[i].id;
        if (!localIds[cid]) {
            idsToDelete.push(cid);
        }
    }

    // ========== 第三步：批量构建upsert数据
    const upsertData = [];
    const now = new Date().toISOString();

    for (let i = 0; i < localAnomalies.length; i++) {
        const anomaly = localAnomalies[i];
        if (!anomaly.id) continue;

        const existingAnomaly = cloudMap[anomaly.id];
        const anomalyWithVersion = addVersionInfo(anomaly, existingAnomaly ? 'update' : 'create');

        let shRecs, compRecs, rejRecs, escRecs, confRecs;
        if (existingAnomaly) {
            shRecs = mergeArraysFast(anomaly.status_history || anomaly.statusHistory, existingAnomaly.status_history);
            compRecs = mergeArraysFast(anomaly.completion_records || anomaly.completionRecords, existingAnomaly.completion_records);
            rejRecs = mergeArraysFast(anomaly.reject_records || anomaly.rejectRecords, existingAnomaly.reject_records);
            escRecs = mergeArraysFast(anomaly.escalate_records || anomaly.escalateRecords, existingAnomaly.escalate_records);
            confRecs = mergeArraysFast(anomaly.confirm_records || anomaly.confirmRecords, existingAnomaly.confirm_records);
        } else {
            shRecs = anomaly.status_history || anomaly.statusHistory || [];
            compRecs = anomaly.completion_records || anomaly.completionRecords || [];
            rejRecs = anomaly.reject_records || anomaly.rejectRecords || [];
            escRecs = anomaly.escalate_records || anomaly.escalateRecords || [];
            confRecs = anomaly.confirm_records || anomaly.confirmRecords || [];
        }

        const record = {
            id: anomaly.id,
            device: anomaly.device || '',
            tag: anomaly.tag || '',
            sample_name: anomaly.sample_name || anomaly.sampleName || '',
            problem_desc: anomaly.problem_desc || anomaly.problemDesc || '',
            report_time: anomaly.report_time || anomaly.reportTime || '',
            reporter: anomaly.reporter || '',
            rectifier: anomaly.rectifier || '',
            completion_status: anomaly.completion_status || anomaly.completionStatus || 'progress',
            completion_note: anomaly.completion_note || anomaly.completionNote || '',
            confirmer: anomaly.confirmer || '',
            remark: anomaly.remark || '',
            created_at: anomaly.created_at || anomaly.createTime || now,
            updated_at: now,
            _sync_version: anomalyWithVersion._sync_version || 1,
            _user_id: anomaly._user_id || '',
            status_history: shRecs,
            completion_records: compRecs,
            reject_records: rejRecs,
            escalate_records: escRecs,
            confirm_records: confRecs,
            protected: anomaly.protected || false,
            processing_report: anomaly.processing_report || anomaly.processingReport || '',
            confirmed_by_leader: anomaly.confirmed_by_leader || anomaly.confirmedByLeader || ''
        };

        if (!existingAnomaly) {
            record.created_at = now;
        }

        upsertData.push(record);
    }

    console.log('[可靠同步-优化版] 准备 upsert ' + upsertData.length + ' 条采样点异常记录');

    // ========== 第四步：一次 POST 批量 upsert
    if (upsertData.length > 0) {
        try {
            const url = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
            url.searchParams.append('on_conflict', 'id');

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': 'Bearer ' + supabaseConfig.key,
                    'Prefer': 'return=minimal, resolution=merge-duplicates'
                },
                body: JSON.stringify(upsertData)
            });

            if (response.ok) {
                successCount = upsertData.length;
                console.log('[可靠同步-优化版] ✅ 批量 upsert 成功: ' + successCount + ' 条');
            } else {
                const errText = await response.text();
                console.error('[可靠同步-优化版] ❌ 批量 upsert 失败: ' + response.status + ' ' + errText);

                console.log('[可靠同步-优化版] 降级为逐条 upsert...');
                successCount = 0;
                for (let i = 0; i < upsertData.length; i++) {
                    try {
                        const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                        url2.searchParams.append('on_conflict', 'id');
                        await fetch(url2.toString(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': supabaseConfig.key,
                                'Authorization': 'Bearer ' + supabaseConfig.key,
                                'Prefer': 'return=minimal, resolution=merge-duplicates'
                            },
                            body: JSON.stringify(upsertData[i])
                        });
                        successCount++;
                    } catch (err) {
                        failCount++;
                    }
                }
            }
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量 upsert 异常: ' + error.message);
            successCount = 0;
            for (let i = 0; i < upsertData.length; i++) {
                try {
                    const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                    url2.searchParams.append('on_conflict', 'id');
                    await fetch(url2.toString(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseConfig.key,
                            'Authorization': 'Bearer ' + supabaseConfig.key,
                            'Prefer': 'return=minimal, resolution=merge-duplicates'
                        },
                        body: JSON.stringify(upsertData[i])
                    });
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }
        }
    }

    // ========== 第五步：批量 DELETE
    if (idsToDelete.length > 0) {
        console.log('[可靠同步-优化版] 准备批量删除 ' + idsToDelete.length + ' 条云端记录');
        try {
            const DELETE_BATCH_SIZE = 100;
            for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH_SIZE) {
                const batch = idsToDelete.slice(i, i + DELETE_BATCH_SIZE);
                const deleteUrl = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                deleteUrl.searchParams.append('id', 'in.(' + batch.join(',') + ')');

                const delResponse = await fetch(deleteUrl.toString(), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabaseConfig.key,
                        'Authorization': 'Bearer ' + supabaseConfig.key
                    }
                });

                if (delResponse.ok) {
                    deleteCount += batch.length;
                } else {
                    const err = await delResponse.text();
                    console.error('[可靠同步-优化版] ❌ 批量删除失败: ' + err);
                    for (let j = 0; j < batch.length; j++) {
                        try {
                            await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + batch[j] });
                            deleteCount++;
                        } catch (de) { failCount++; }
                    }
                }
            }
            console.log('[可靠同步-优化版] ✅ 批量删除完成: ' + deleteCount + ' 条');
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量删除异常: ' + error.message);
            for (let j = 0; j < idsToDelete.length; j++) {
                try {
                    await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + idsToDelete[j] });
                    deleteCount++;
                } catch (de) { failCount++; }
            }
        }
    }

    if (typeof commitAllPendingAuditLogs === 'function') {
        await commitAllPendingAuditLogs();
    }

    let message = '同步成功！成功 ' + successCount + ' 条, 删除 ' + deleteCount + ' 条';
    if (failCount > 0) {
        message += ', 失败 ' + failCount + ' 条';
    }

    return {
        success: failCount === 0 || successCount > 0,
        message,
        successCount,
        failCount,
        deleteCount
    };
}

// 暴露采样点异常模块的增量同步函数
window.syncSamplingAnomalyDataIncrementally = async function(samplingAnomalyDataToSync) {
    console.log('[采样点异常同步] 开始增量同步采样点异常数据...');

    // 确保使用最新的采样点异常数据
    let samplingAnomalyData = samplingAnomalyDataToSync || window.samplingAnomalyData || [];
    // 入口防御：按ID去重
    if (Array.isArray(samplingAnomalyData)) {
        const beforeLen = samplingAnomalyData.length;
        samplingAnomalyData = dedupByKey(samplingAnomalyData, 'id');
        if (beforeLen !== samplingAnomalyData.length) {
            console.log(`[采样点异常同步] 入口去重: ${beforeLen} → ${samplingAnomalyData.length}`);
        }
    }
    
    if (!Array.isArray(samplingAnomalyData) || samplingAnomalyData.length === 0) {
        return { success: true, message: '没有采样点异常数据需要同步' };
    }
    
    console.log(`[采样点异常同步] 当前本地采样点异常数量: ${samplingAnomalyData.length}`);
    console.log(`[采样点异常同步] 本地采样点异常ID列表: ${samplingAnomalyData.map(a => a.id).join(', ')}`);
    
    // 调用可靠同步模块的采样点异常同步函数
    return await reliableSyncSamplingAnomaliesToCloud(samplingAnomalyData);
};

// 暴露采样点异常同步函数
window.reliableSyncSamplingAnomaliesToCloud = reliableSyncSamplingAnomaliesToCloud;

// ==================== 仪器维修台账批量同步 ====================
// 【优化版】仪器维修模块同步 - 1-2次请求搞定（固定ID upsert）
async function reliableSyncInstrumentsToCloud(instrumentTableData) {
    console.log('[可靠同步-优化版] 仪器维修台账批量同步');

    const tableName = supabaseConfig.tables['instrument'];
    if (!tableName) {
        throw new Error('未找到仪器维修模块对应的表名');
    }

    const localData = Array.isArray(instrumentTableData)
        ? instrumentTableData
        : (instrumentTableData?.data || []);
    const localCount = localData.length;
    console.log('[可靠同步-优化版] 本地仪器维修记录数量: ' + localCount);

    if (localCount === 0) {
        return { success: true, message: '没有仪器维修数据需要同步', successCount: 0, failCount: 0 };
    }

    const now = new Date().toISOString();
    const fullDataObject = Array.isArray(instrumentTableData)
        ? {
            headers: ['仪器编号', '仪器名称', '维修日期', '维修内容', '维修人员', '更换配件', '备注'],
            data: localData,
            lastModified: now
        }
        : instrumentTableData;

    const existingRecords = await supabaseRequest('GET', tableName, null, { select: 'id' }) || [];
    const existingId = existingRecords.length > 0 ? existingRecords[0].id : null;
    const targetId = existingId || 'instrument-ledger-main';
    console.log('[可靠同步-优化版] 使用记录ID: ' + targetId + (existingId ? '（已有记录）' : '（新建记录）'));

    // ========== 核心 payload：同时包含 updated_at 和 lastModified 两种命名 ==========
    // 数据库表可能使用 updated_at 或 lastModified/lastmodified 作为时间戳列
    const basePayload = {
        id: targetId,
        data: fullDataObject,
        updated_at: now,
        lastModified: now,
        lastmodified: now
    };
    if (!existingId) {
        basePayload.created_at = now;
    }

    // ========== 第一层：POST upsert ==========
    try {
        const url = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
        url.searchParams.append('on_conflict', 'id');

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': 'Bearer ' + supabaseConfig.key,
                'Prefer': 'return=minimal, resolution=merge-duplicates'
            },
            body: JSON.stringify(basePayload)
        });

        if (response.ok) {
            console.log('[可靠同步-优化版] ✅ 仪器维修台账 upsert 成功，同步了 ' + localCount + ' 条记录');
            return {
                success: true,
                message: '仪器维修台账同步成功！同步了 ' + localCount + ' 条记录',
                successCount: localCount,
                failCount: 0,
                method: 'POST upsert'
            };
        }

        const errText = await response.text();
        console.error('[可靠同步-优化版] ⚠️ POST upsert 失败: ' + response.status + ' ' + errText);

        // ========== 第二层：降级 PATCH/POST ==========
        console.log('[可靠同步-优化版] 降级为 PATCH/POST 方式...');
        const fallbackPayload = existingId
            ? { data: fullDataObject, updated_at: now, lastModified: now, lastmodified: now }
            : basePayload;

        const fallbackResult = existingId
            ? await supabaseRequest('PATCH', tableName, fallbackPayload, { id: 'eq.' + existingId })
            : await supabaseRequest('POST', tableName, fallbackPayload);

        if (fallbackResult !== null) {
            console.log('[可靠同步-优化版] ✅ 降级方案成功');
            return {
                success: true,
                message: '仪器维修台账同步成功！同步了 ' + localCount + ' 条记录',
                successCount: localCount,
                failCount: 0,
                method: 'PATCH/POST fallback'
            };
        }

        return {
            success: false,
            message: '同步失败。可能原因：(1)网络问题 (2)instrument_data 表缺少 lastmodified/updated_at 列 (3)数据库触发函数有问题。请查看浏览器控制台',
            successCount: 0,
            failCount: 1,
            error: errText
        };
    } catch (error) {
        console.error('[可靠同步-优化版] ❌ 请求异常: ' + error.message);

        // ========== 第三层：异常后再次尝试降级 ==========
        try {
            const finalFallback = existingId
                ? await supabaseRequest('PATCH', tableName, { data: fullDataObject, updated_at: now }, { id: 'eq.' + existingId })
                : await supabaseRequest('POST', tableName, { id: targetId, data: fullDataObject, created_at: now, updated_at: now });

            if (finalFallback !== null) {
                return {
                    success: true,
                    message: '仪器维修台账同步成功！同步了 ' + localCount + ' 条记录',
                    successCount: localCount,
                    failCount: 0,
                    method: 'final fallback'
                };
            }
        } catch (err2) {
            console.error('[可靠同步-优化版] ❌ 最终降级也失败: ' + err2.message);
        }

        return {
            success: false,
            message: '同步失败：' + error.message + '（如错误提示缺少 lastmodified 字段，请在 Supabase 运行 SQL 修复脚本）',
            successCount: 0,
            failCount: 1,
            error: error.message
        };
    }
}

// ==================== 采样车维修台账批量同步 ====================
// 【优化版】采样车维修模块同步 - 1-2次请求搞定（固定ID upsert）
async function reliableSyncSamplingCarsToCloud(samplingCarTableData) {
    console.log('[可靠同步-优化版] 采样车维修台账批量同步');

    const tableName = supabaseConfig.tables['samplingCar'];
    if (!tableName) {
        throw new Error('未找到采样车维修模块对应的表名');
    }

    const localData = Array.isArray(samplingCarTableData)
        ? samplingCarTableData
        : (samplingCarTableData?.data || []);
    const localCount = localData.length;
    console.log('[可靠同步-优化版] 本地采样车维修记录数量: ' + localCount);

    if (localCount === 0) {
        return { success: true, message: '没有采样车维修数据需要同步', successCount: 0, failCount: 0 };
    }

    const now = new Date().toISOString();
    const fullDataObject = Array.isArray(samplingCarTableData)
        ? {
            headers: ['维修厂家', '维修日期', '故障描述', '维修项目', '维修人', '费用', '备注'],
            data: localData,
            lastModified: now
        }
        : samplingCarTableData;

    const existingRecords = await supabaseRequest('GET', tableName, null, { select: 'id' }) || [];
    const existingId = existingRecords.length > 0 ? existingRecords[0].id : null;
    const targetId = existingId || 'sampling-car-ledger-main';
    console.log('[可靠同步-优化版] 使用记录ID: ' + targetId + (existingId ? '（已有记录）' : '（新建记录）'));

    // ========== 核心 payload：同时包含 updated_at 和 lastModified 两种命名 ==========
    const basePayload = {
        id: targetId,
        data: fullDataObject,
        updated_at: now,
        lastModified: now,
        lastmodified: now
    };
    if (!existingId) {
        basePayload.created_at = now;
    }

    // ========== 第一层：POST upsert ==========
    try {
        const url = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
        url.searchParams.append('on_conflict', 'id');

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': 'Bearer ' + supabaseConfig.key,
                'Prefer': 'return=minimal, resolution=merge-duplicates'
            },
            body: JSON.stringify(basePayload)
        });

        if (response.ok) {
            console.log('[可靠同步-优化版] ✅ 采样车维修台账 upsert 成功，同步了 ' + localCount + ' 条记录');
            return {
                success: true,
                message: '采样车维修台账同步成功！同步了 ' + localCount + ' 条记录',
                successCount: localCount,
                failCount: 0,
                method: 'POST upsert'
            };
        }

        const errText = await response.text();
        console.error('[可靠同步-优化版] ⚠️ POST upsert 失败: ' + response.status + ' ' + errText);

        // ========== 第二层：降级 PATCH/POST ==========
        console.log('[可靠同步-优化版] 降级为 PATCH/POST 方式...');
        const fallbackPayload = existingId
            ? { data: fullDataObject, updated_at: now, lastModified: now, lastmodified: now }
            : basePayload;

        const fallbackResult = existingId
            ? await supabaseRequest('PATCH', tableName, fallbackPayload, { id: 'eq.' + existingId })
            : await supabaseRequest('POST', tableName, fallbackPayload);

        if (fallbackResult !== null) {
            console.log('[可靠同步-优化版] ✅ 降级方案成功');
            return {
                success: true,
                message: '采样车维修台账同步成功！同步了 ' + localCount + ' 条记录',
                successCount: localCount,
                failCount: 0,
                method: 'PATCH/POST fallback'
            };
        }

        return {
            success: false,
            message: '同步失败。可能原因：(1)网络问题 (2)sampling_car_data 表缺少字段 (3)数据库触发函数有问题',
            successCount: 0,
            failCount: 1,
            error: errText
        };
    } catch (error) {
        console.error('[可靠同步-优化版] ❌ 请求异常: ' + error.message);

        // ========== 第三层：异常后再次尝试降级 ==========
        try {
            const finalFallback = existingId
                ? await supabaseRequest('PATCH', tableName, { data: fullDataObject, updated_at: now }, { id: 'eq.' + existingId })
                : await supabaseRequest('POST', tableName, { id: targetId, data: fullDataObject, created_at: now, updated_at: now });

            if (finalFallback !== null) {
                return {
                    success: true,
                    message: '采样车维修台账同步成功！同步了 ' + localCount + ' 条记录',
                    successCount: localCount,
                    failCount: 0,
                    method: 'final fallback'
                };
            }
        } catch (err2) {
            console.error('[可靠同步-优化版] ❌ 最终降级也失败: ' + err2.message);
        }

        return {
            success: false,
            message: '同步失败：' + error.message + '（请查看 Supabase 表结构或运行 SQL 修复脚本）',
            successCount: 0,
            failCount: 1,
            error: error.message
        };
    }
}

// 暴露仪器和采样车维修同步函数
window.reliableSyncInstrumentsToCloud = reliableSyncInstrumentsToCloud;
window.reliableSyncSamplingCarsToCloud = reliableSyncSamplingCarsToCloud;

// ==================== 检查问题台账同步 ====================
// 严格字段白名单：只发送数据库存在的 10 个列（全部小写）
// 数据库列：checkunit, checktime, deadline, description, inspector, status, responsible, responsibleperson, measures, inspectioncategory
// 另外附加：id (主键), created_at (新记录), updated_at (总是)
async function reliableSyncInspectionsToCloud(inspectionData, moduleKey) {
    const t0 = Date.now();
    const tableName = supabaseConfig.tables[moduleKey];
    if (!tableName) {
        throw new Error('未找到检查问题模块对应的表名: ' + moduleKey);
    }

    const localData = Array.isArray(inspectionData) ? inspectionData : (inspectionData?.data || []);
    if (localData.length === 0) {
        return { success: true, message: '没有检查问题数据需要同步', successCount: 0, failCount: 0 };
    }

    console.log('[检查问题同步] 开始，本地 ' + localData.length + ' 条，表: ' + tableName);
    const now = new Date().toISOString();

    const VALID_FIELDS = new Set([
        'checkunit', 'checktime', 'deadline', 'description',
        'inspector', 'status', 'responsible', 'responsibleperson',
        'measures', 'inspectioncategory'
    ]);

    function cleanItem(item) {
        const r = {};
        const v = (x) => (x !== undefined && x !== null && x !== '');

        // checkunit (兼容 unit/checkUnit)
        let val = item.checkunit !== undefined ? item.checkunit : (item.unit !== undefined ? item.unit : item.checkUnit);
        if (v(val)) r.checkunit = val;

        // checktime (兼容 date/checkTime)
        val = item.checktime !== undefined ? item.checktime : (item.date !== undefined ? item.date : item.checkTime);
        if (v(val)) r.checktime = val;

        if (v(item.deadline)) r.deadline = item.deadline;
        if (v(item.description)) r.description = item.description;
        if (v(item.inspector)) r.inspector = item.inspector;
        if (v(item.status)) r.status = item.status;
        if (v(item.responsible)) r.responsible = item.responsible;

        // responsibleperson (兼容 responsiblePerson)
        val = item.responsibleperson !== undefined ? item.responsibleperson : item.responsiblePerson;
        if (v(val)) r.responsibleperson = val;

        if (v(item.measures)) r.measures = item.measures;

        // inspectioncategory (兼容 category/inspectionCategory)
        val = item.inspectioncategory !== undefined ? item.inspectioncategory : (item.category !== undefined ? item.category : item.inspectionCategory);
        if (v(val)) r.inspectioncategory = val;

        // 安全检查：确保没有任何意外字段泄漏
        Object.keys(r).forEach(k => {
            if (!VALID_FIELDS.has(k)) delete r[k];
        });

        return r;
    }

    // 1. GET 云端现有 id（决定新增 vs 更新）
    const cloudData = await supabaseRequest('GET', tableName, null, { select: 'id' }) || [];
    const existingIds = new Set(cloudData.map(x => x && x.id).filter(Boolean));
    console.log('[检查问题同步] 云端 ' + existingIds.size + ' 条 (耗时 ' + (Date.now() - t0) + 'ms)');

    const toInsert = [];
    const toUpdateRecords = [];
    for (let i = 0; i < localData.length; i++) {
        const item = localData[i];
        if (!item || !item.id) continue;
        if (existingIds.has(item.id)) {
            toUpdateRecords.push(item);
        } else {
            toInsert.push(item);
        }
    }
    console.log('[检查问题同步] 新增 ' + toInsert.length + ' 条，更新 ' + toUpdateRecords.length + ' 条');

    let successCount = 0;
    let failCount = 0;

    // 2. 新增记录 - 批量 POST
    if (toInsert.length > 0) {
        const insertData = toInsert.map(item => {
            const cleaned = cleanItem(item);
            cleaned.id = item.id;
            cleaned.created_at = item.created_at || now;
            cleaned.updated_at = now;
            return cleaned;
        });

        // 调试：打印第一条记录将要发送的字段
        if (insertData.length > 0) {
            console.log('[检查问题同步] 发送字段: ' + Object.keys(insertData[0]).join(', '));
        }

        try {
            const insertUrl = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
            insertUrl.searchParams.append('on_conflict', 'id');

            const response = await fetch(insertUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': 'Bearer ' + supabaseConfig.key,
                    'Prefer': 'return=minimal, resolution=merge-duplicates'
                },
                body: JSON.stringify(insertData)
            });

            if (response.ok) {
                successCount += insertData.length;
            } else {
                const errText = await response.text();
                console.error('[检查问题同步] 批量新增失败: ' + errText);
                // 降级逐条
                for (let i = 0; i < insertData.length; i++) {
                    try {
                        await supabaseRequest('POST', tableName, insertData[i]);
                        successCount++;
                    } catch (e) { failCount++; }
                }
            }
        } catch (error) {
            console.error('[检查问题同步] 批量新增异常: ' + error.message);
            for (let i = 0; i < insertData.length; i++) {
                try {
                    await supabaseRequest('POST', tableName, insertData[i]);
                    successCount++;
                } catch (e) { failCount++; }
            }
        }
        console.log('[检查问题同步] 新增完成: 成功 ' + successCount + ', 失败 ' + failCount);
    }

    // 3. 更新记录 - 并行 PATCH
    if (toUpdateRecords.length > 0) {
        const BATCH_SIZE = 50;
        for (let start = 0; start < toUpdateRecords.length; start += BATCH_SIZE) {
            const batch = toUpdateRecords.slice(start, start + BATCH_SIZE);
            const promises = batch.map(item => {
                const patchData = cleanItem(item);
                patchData.updated_at = now;
                return supabaseRequest('PATCH', tableName, patchData, { id: 'eq.' + item.id })
                    .then(() => { successCount++; })
                    .catch(() => { failCount++; });
            });
            await Promise.all(promises);
        }
        console.log('[检查问题同步] 更新完成: 成功 ' + successCount + ', 失败 ' + failCount);
    }

    if (typeof commitAllPendingAuditLogs === 'function') {
        await commitAllPendingAuditLogs();
    }

    console.log('[检查问题同步] 总耗时: ' + (Date.now() - t0) + 'ms，成功 ' + successCount + '，失败 ' + failCount);
    return {
        success: failCount === 0 || successCount > 0,
        message: '同步成功：' + successCount + ' 条' + (failCount > 0 ? '，失败 ' + failCount + ' 条' : ''),
        successCount, failCount, deleteCount: 0
    };
}

// ==================== 违章违纪台账批量同步 ====================
async function reliableSyncPatrolsToCloud(patrolData) {
    console.log('[可靠同步-优化版] 违章违纪台账批量同步');

    const tableName = supabaseConfig.tables['patrol'];
    if (!tableName) {
        throw new Error('未找到违章违纪模块对应的表名');
    }

    const localPatrols = Array.isArray(patrolData)
        ? patrolData
        : (patrolData?.data || []);
    const localCount = localPatrols.length;
    console.log('[可靠同步-优化版] 本地违章违纪记录数量: ' + localCount);

    if (localCount === 0) {
        return { success: true, message: '没有违章违纪数据需要同步', successCount: 0, failCount: 0 };
    }

    let successCount = 0;
    let failCount = 0;
    let deleteCount = 0;
    const now = new Date().toISOString();

    const cloudPatrols = await supabaseRequest('GET', tableName, null, {
        select: 'id,updated_at,_sync_version'
    }) || [];

    console.log('[可靠同步-优化版] 云端违章违纪记录数量: ' + cloudPatrols.length);

    const cloudIds = new Set(cloudPatrols.filter(i => i.id).map(i => i.id));
    const localIds = new Set(localPatrols.filter(i => i.id).map(i => i.id));

    const idsToDelete = [];
    for (const cloudItem of cloudPatrols) {
        if (cloudItem.id && !localIds.has(cloudItem.id)) {
            idsToDelete.push(cloudItem.id);
        }
    }

    const upsertData = [];
    for (let i = 0; i < localPatrols.length; i++) {
        const item = localPatrols[i];
        if (!item.id) continue;

        const itemWithVersion = addVersionInfo(item, cloudIds.has(item.id) ? 'update' : 'create');

        const record = {
            id: item.id,
            record_date: item.record_date || item.recordDate || new Date().toISOString().split('T')[0],
            name: item.name || '',
            department: item.department || '',
            category: item.category || '',
            facts: item.facts || '',
            occur_date: item.occur_date || item.occurDate || '',
            basis: item.basis || '',
            punishment_level: item.punishment_level || item.punishmentLevel || '',
            economic_penalty: item.economic_penalty || item.economicPenalty || '',
            safety_score: item.safety_score || item.safetyScore || '',
            rectification_status: item.rectification_status || item.rectificationStatus || '',
            remark: item.remark || '',
            created_at: item.created_at || item.createTime || now,
            updated_at: now,
            _sync_version: itemWithVersion._sync_version || 1
        };

        upsertData.push(record);
    }

    console.log('[可靠同步-优化版] 准备 upsert ' + upsertData.length + ' 条违章违纪记录');

    if (upsertData.length > 0) {
        try {
            const url = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
            url.searchParams.append('on_conflict', 'id');

            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': 'Bearer ' + supabaseConfig.key,
                    'Prefer': 'return=minimal, resolution=merge-duplicates'
                },
                body: JSON.stringify(upsertData)
            });

            if (response.ok) {
                successCount = upsertData.length;
                console.log('[可靠同步-优化版] ✅ 批量 upsert 成功: ' + successCount + ' 条');
            } else {
                const errText = await response.text();
                console.error('[可靠同步-优化版] ❌ 批量 upsert 失败: ' + response.status + ' ' + errText);
                console.log('[可靠同步-优化版] 降级为逐条 upsert...');
                successCount = 0;
                for (let i = 0; i < upsertData.length; i++) {
                    try {
                        const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                        url2.searchParams.append('on_conflict', 'id');
                        await fetch(url2.toString(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': supabaseConfig.key,
                                'Authorization': 'Bearer ' + supabaseConfig.key,
                                'Prefer': 'return=minimal, resolution=merge-duplicates'
                            },
                            body: JSON.stringify(upsertData[i])
                        });
                        successCount++;
                    } catch (err) {
                        failCount++;
                    }
                }
            }
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量 upsert 异常: ' + error.message);
            successCount = 0;
            for (let i = 0; i < upsertData.length; i++) {
                try {
                    const url2 = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                    url2.searchParams.append('on_conflict', 'id');
                    await fetch(url2.toString(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseConfig.key,
                            'Authorization': 'Bearer ' + supabaseConfig.key,
                            'Prefer': 'return=minimal, resolution=merge-duplicates'
                        },
                        body: JSON.stringify(upsertData[i])
                    });
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }
        }
    }

    if (idsToDelete.length > 0) {
        console.log('[可靠同步-优化版] 准备批量删除 ' + idsToDelete.length + ' 条云端记录');
        try {
            const DELETE_BATCH_SIZE = 100;
            for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH_SIZE) {
                const batch = idsToDelete.slice(i, i + DELETE_BATCH_SIZE);
                const deleteUrl = new URL(supabaseConfig.url + '/rest/v1/' + tableName);
                deleteUrl.searchParams.append('id', 'in.(' + batch.join(',') + ')');

                const delResponse = await fetch(deleteUrl.toString(), {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabaseConfig.key,
                        'Authorization': 'Bearer ' + supabaseConfig.key
                    }
                });

                if (delResponse.ok) {
                    deleteCount += batch.length;
                } else {
                    const err = await delResponse.text();
                    console.error('[可靠同步-优化版] ❌ 批量删除失败: ' + err);
                    for (let j = 0; j < batch.length; j++) {
                        try {
                            await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + batch[j] });
                            deleteCount++;
                        } catch (de) { failCount++; }
                    }
                }
            }
            console.log('[可靠同步-优化版] ✅ 批量删除完成: ' + deleteCount + ' 条');
        } catch (error) {
            console.error('[可靠同步-优化版] ❌ 批量删除异常: ' + error.message);
            for (let j = 0; j < idsToDelete.length; j++) {
                try {
                    await supabaseRequest('DELETE', tableName, null, { id: 'eq.' + idsToDelete[j] });
                    deleteCount++;
                } catch (de) { failCount++; }
            }
        }
    }

    if (typeof commitAllPendingAuditLogs === 'function') {
        await commitAllPendingAuditLogs();
    }

    let message = '同步成功：' + successCount + ' 条';
    if (deleteCount > 0) message += '，删除 ' + deleteCount + ' 条';
    if (failCount > 0) message += '，失败 ' + failCount + ' 条';

    return {
        success: failCount === 0 || successCount > 0,
        message,
        successCount,
        failCount,
        deleteCount
    };
}

// ==================== 暴露所有模块的增量同步函数 ====================
window.reliableSyncInspectionsToCloud = reliableSyncInspectionsToCloud;
window.reliableSyncPatrolsToCloud = reliableSyncPatrolsToCloud;

window.syncInstrumentDataIncrementally = async function(instrumentDataToSync) {
    console.log('[仪器维修同步] 开始增量同步仪器维修数据...');
    const data = instrumentDataToSync || JSON.parse(localStorage.getItem('instrumentLedger') || '{}');
    return await reliableSyncInstrumentsToCloud(data);
};

window.syncSamplingCarDataIncrementally = async function(samplingCarDataToSync) {
    console.log('[采样车维修同步] 开始增量同步采样车维修数据...');
    const data = samplingCarDataToSync || JSON.parse(localStorage.getItem('samplingCarLedger') || '{}');
    return await reliableSyncSamplingCarsToCloud(data);
};

window.syncInspectionDataIncrementally = async function(inspectionDataToSync, moduleKey) {
    console.log('[检查问题同步] 开始增量同步检查问题数据...');
    const key = moduleKey || 'centerInspection';
    const centerData = window.centerInspectionData || JSON.parse(localStorage.getItem('centerInspectionData') || '[]');
    const workshopData = window.workshopInspectionData || JSON.parse(localStorage.getItem('workshopInspectionData') || '[]');
    const data = inspectionDataToSync || (key === 'centerInspection' ? centerData : workshopData);
    return await reliableSyncInspectionsToCloud(data, key);
};

window.syncPatrolDataIncrementally = async function(patrolDataToSync) {
    console.log('[违章违纪同步] 开始增量同步违章违纪数据...');
    const data = patrolDataToSync || window.patrolData || JSON.parse(localStorage.getItem('violationDisciplineLedger') || '{}');
    const patrolRecords = Array.isArray(data) ? data : (data?.data || []);      
    return await reliableSyncPatrolsToCloud(patrolRecords);
};

window.syncTaskDataIncrementally = async function(taskDataToSync) {
    console.log('[任务管理同步] 开始增量同步任务管理数据...');
    const data = taskDataToSync || window.taskData || JSON.parse(localStorage.getItem('taskData') || '[]');
    return await reliableSyncTasksToCloud(data);
};
