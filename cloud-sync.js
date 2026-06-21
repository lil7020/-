// 使用配置文件中的配置
const SUPABASE_URL = typeof CONFIG !== 'undefined' ? CONFIG.SUPABASE_URL : 'https://gfeoegvntxyfotvhklri.supabase.co';
const SUPABASE_ANON_KEY = typeof CONFIG !== 'undefined' ? CONFIG.SUPABASE_ANON_KEY : 'sb_publishable_rBqTlyxcWEa1lwumCvxLLQ_bnimmF06';
const SYNC_RETRY_MAX = typeof CONFIG !== 'undefined' ? CONFIG.SYNC_RETRY_MAX : 3;
const SYNC_RETRY_DELAY = typeof CONFIG !== 'undefined' ? CONFIG.SYNC_RETRY_DELAY : 1000;

const supabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    tables: {
        inspection: 'inspection_center_records',
        centerInspection: 'inspection_center_records',
        workshopInspection: 'inspection_workshop_records',
        samplingCar: 'sampling_car_data',
        instrument: 'instrument_data',
        honor: 'honor_data',
        patrol: 'violation_discipline_data',
        personnel: 'personnel_data',
        team: 'team_data',
        teamPersonnel: 'team_personnel_data',
        training: 'training_data',
        users: 'users',
        syncLock: 'sync_lock',
        task: 'task_data',
        hazard: 'hazard_data',
        samplingAnomaly: 'sampling_anomaly_data'
    }
};

window.supabaseConfig = supabaseConfig;

let currentUser = null;
let lockPollingInterval = null;
let lockTableCreated = false;

function setCurrentUser(username) {
    currentUser = username;
}

async function createSyncLockTable() {
    if (lockTableCreated) {
        return true;
    }
    
    try {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS sync_lock (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                lock_time TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `;
        
        const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/create_sync_lock_table`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            },
            body: JSON.stringify({})
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.log('RPC 函数不存在，尝试其他方式:', text);
            
            const alternativeResponse = await fetch(`${supabaseConfig.url}/rest/v1/${supabaseConfig.tables.syncLock}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': `Bearer ${supabaseConfig.key}`
                },
                body: JSON.stringify({
                    id: 'test_lock',
                    username: 'system',
                    lock_time: new Date().toISOString()
                })
            });
            
            if (!alternativeResponse.ok) {
                const altText = await alternativeResponse.text();
                if (altText.includes('Could not find the table')) {
                    console.log('表不存在，需要手动创建');
                    return false;
                }
            } else {
                await fetch(`${supabaseConfig.url}/rest/v1/${supabaseConfig.tables.syncLock}/test_lock`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': supabaseConfig.key,
                        'Authorization': `Bearer ${supabaseConfig.key}`
                    }
                });
                lockTableCreated = true;
                return true;
            }
        } else {
            lockTableCreated = true;
            return true;
        }
    } catch (error) {
        console.error('创建锁表失败:', error);
        return false;
    }
    
    return false;
}

async function getUploadLockStatus() {
    try {
        const url = new URL(`${supabaseConfig.url}/rest/v1/${supabaseConfig.tables.syncLock}`);
        url.searchParams.append('select', '*');
        url.searchParams.append('limit', '1');
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            return null;
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
            return data[0];
        }
        return null;
    } catch (error) {
        console.error('获取锁状态失败:', error);
        return null;
    }
}

async function acquireUploadLock(username) {
    try {
        let lockStatus;
        try {
            lockStatus = await getUploadLockStatus();
        } catch (error) {
            console.log('获取锁状态失败（可能表不存在），跳过锁检查:', error.message);
            return { success: true, message: '锁表不存在，跳过锁检查' };
        }
        
        if (lockStatus) {
            if (lockStatus.username === username) {
                console.log(`检测到自己的锁，直接获取`);
                return { success: true, message: '已获取上传锁' };
            }
            return { success: false, message: `${lockStatus.username} 正在上传数据，请等待上传完成后再试。`, lockedBy: lockStatus.username };
        }
        
        const url = new URL(`${supabaseConfig.url}/rest/v1/${supabaseConfig.tables.syncLock}`);
        
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            },
            body: JSON.stringify({
                id: 'upload_lock',
                username: username,
                lock_time: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            const text = await response.text();
            if (text.includes('duplicate key')) {
                try {
                    const lockStatus = await getUploadLockStatus();
                    if (lockStatus) {
                        if (lockStatus.username === username) {
                            return { success: true, message: '已获取上传锁' };
                        }
                        return { success: false, message: `${lockStatus.username} 正在上传数据，请等待上传完成后再试。`, lockedBy: lockStatus.username };
                    }
                } catch (e) {
                    console.log('获取锁状态失败，可能表不存在:', e.message);
                    return { success: true, message: '锁表不存在，跳过锁检查' };
                }
            }
            if (response.status === 404 || text.includes('Could not find the table')) {
                console.log('锁表不存在，跳过锁检查');
                return { success: true, message: '锁表不存在，跳过锁检查' };
            }
            console.error('获取上传锁失败，HTTP状态:', response.status, '响应:', text);
            return { success: false, message: `获取上传锁失败 (${response.status})` };
        }
        
        return { success: true, message: '已获取上传锁' };
    } catch (error) {
        console.error('获取上传锁失败:', error);
        return { success: false, message: `获取上传锁失败: ${error.message}` };
    }
}

async function releaseUploadLock() {
    try {
        const url = new URL(`${supabaseConfig.url}/rest/v1/${supabaseConfig.tables.syncLock}`);
        url.searchParams.append('id', 'eq.upload_lock');
        
        const response = await fetch(url.toString(), {
            method: 'DELETE',
            headers: {
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('释放上传锁失败:', error);
        return false;
    }
}

function startLockPolling(callback) {
    if (lockPollingInterval) {
        clearInterval(lockPollingInterval);
    }
    
    lockPollingInterval = setInterval(async () => {
        const status = await getUploadLockStatus();
        callback(status);
    }, 3000);
}

function stopLockPolling() {
    if (lockPollingInterval) {
        clearInterval(lockPollingInterval);
        lockPollingInterval = null;
    }
}

window.uploadLock = {
    getStatus: getUploadLockStatus,
    acquire: acquireUploadLock,
    release: releaseUploadLock,
    setCurrentUser: setCurrentUser,
    startPolling: startLockPolling,
    stopPolling: stopLockPolling
};

async function deleteAllFromCloud(table) {
    try {
        console.log(`[DEBUG] 开始清空表 ${table}`);
        console.log(`[DEBUG] Supabase URL: ${supabaseConfig.url}`);
        console.log(`[DEBUG] Supabase Key: ${supabaseConfig.key ? '已设置' : '未设置!'}`);
        
        // 首先获取所有记录的id
        const getUrl = new URL(`${supabaseConfig.url}/rest/v1/${table}`);
        getUrl.searchParams.append('select', 'id');
        
        console.log(`[DEBUG] 获取记录列表 URL: ${getUrl.toString()}`);
        
        const getResponse = await fetch(getUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            }
        });
        
        console.log(`[DEBUG] 获取记录响应状态: ${getResponse.status}`);
        
        if (!getResponse.ok) {
            const errorText = await getResponse.text();
            console.error(`[DEBUG] 获取记录列表失败: ${getResponse.status}`, errorText);
            return false;
        }
        
        const records = await getResponse.json();
        console.log(`[DEBUG] 获取到 ${records.length} 条记录`);
        
        if (!Array.isArray(records) || records.length === 0) {
            console.log(`表 ${table} 已经为空`);
            return true;
        }
        
        // 逐个删除记录 - 使用查询参数而不是路径参数
        // 删除后验证记录确实被删除
        let allSuccess = true;
        let failedDeletions = [];
        for (const record of records) {
            if (record.id) {
                const deleteUrl = new URL(`${supabaseConfig.url}/rest/v1/${table}`);
                deleteUrl.searchParams.append('id', `eq.${record.id}`);

                console.log(`[DEBUG] 删除记录 URL: ${deleteUrl.toString()}`);

                const deleteResponse = await fetch(deleteUrl.toString(), {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseConfig.key,
                        'Authorization': `Bearer ${supabaseConfig.key}`
                    }
                });

                console.log(`[DEBUG] 删除记录 ${record.id} 响应状态: ${deleteResponse.status}`);

                // Supabase DELETE 成功返回 204，RLS 拒绝时可能返回 200 但 response body 有错误信息
                // 所以需要检查状态码是否为 204
                if (deleteResponse.status !== 204) {
                    const errorText = await deleteResponse.text();
                    console.error(`[DEBUG] 删除记录 ${record.id} 失败:`, deleteResponse.status, errorText);
                    allSuccess = false;
                    failedDeletions.push(record.id);
                } else {
                    console.log(`[DEBUG] 删除记录 ${record.id} 成功`);
                }
            }
        }

        // 如果有删除失败的记录，再验证一下是否真的删除了
        if (failedDeletions.length > 0) {
            console.log(`[DEBUG] 验证 ${failedDeletions.length} 条记录是否真的被删除...`);
            const verifyUrl = new URL(`${supabaseConfig.url}/rest/v1/${table}`);
            verifyUrl.searchParams.append('id', `in.(${failedDeletions.join(',')})`);
            verifyUrl.searchParams.append('select', 'id');

            const verifyResponse = await fetch(verifyUrl.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': `Bearer ${supabaseConfig.key}`
                }
            });

            if (verifyResponse.ok) {
                const remainingRecords = await verifyResponse.json();
                if (remainingRecords && remainingRecords.length > 0) {
                    console.error(`[DEBUG] 验证失败: 仍有 ${remainingRecords.length} 条记录未被删除`);
                    allSuccess = false;
                } else {
                    console.log(`[DEBUG] 验证通过: 所有记录已删除`);
                    allSuccess = true;
                }
            }
        }
        
        if (allSuccess) {
            console.log(`[DEBUG] 表 ${table} 已全部清空`);
        }
        
        return allSuccess;
    } catch (error) {
        console.error('[DEBUG] 清空表失败', error);
        return false;
    }
}

function recordBandwidthUsageFromCloud(sizeKB, operationType = 'other') {
    console.log(`[cloud-sync] 记录带宽: ${sizeKB} KB, 操作: ${operationType}`);
    
    // 直接访问 window 上的全局函数
    if (window.recordBandwidthUsage && typeof window.recordBandwidthUsage === 'function') {
        try {
            window.recordBandwidthUsage(sizeKB, operationType);
            console.log(`[cloud-sync] 带宽记录成功`);
        } catch (e) {
            console.error('[cloud-sync] 调用记录带宽失败:', e);
        }
    } else {
        console.log('[cloud-sync] recordBandwidthUsage 函数未找到，将使用本地存储备份');
        // 备份方案：直接保存到 localStorage
        try {
            const now = new Date();
            let records = [];
            const savedRecords = localStorage.getItem('bandwidthRecords');
            if (savedRecords) {
                records = JSON.parse(savedRecords);
            }
            records.push({
                timestamp: now.toISOString(),
                sizeKB: sizeKB,
                operationType: operationType,
                date: now.toDateString()
            });
            localStorage.setItem('bandwidthRecords', JSON.stringify(records));
            console.log(`[cloud-sync] 备份带宽记录成功，当前记录数: ${records.length}`);
        } catch (backupError) {
            console.error('[cloud-sync] 备份记录带宽也失败了:', backupError);
        }
    }
}

async function supabaseRequest(method, table, data = null, params = {}) {
    const url = new URL(`${supabaseConfig.url}/rest/v1/${table}`);
    
    if (params) {
        Object.keys(params).forEach(key => {
            // 处理特殊参数：upsert 需要特殊处理
            if (key === 'upsert' && params[key] === 'true') {
                // 添加 Prefer header 来启用 upsert
                return; // 不在 URL 参数中添加，而是在 headers 中处理
            }
            url.searchParams.append(key, params[key]);
        });
    }

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.key,
            'Authorization': `Bearer ${supabaseConfig.key}`
        }
    };

    // 如果是 upsert 操作，添加 Prefer header
    if (params && params.upsert === 'true') {
        options.headers['Prefer'] = 'return=representation';
    }

    if (method === 'DELETE' && !data && !Object.keys(params).length) {
        url.searchParams.append('id', 'not.is.null');
        url.searchParams.append('select', 'id');
    }

    let requestSizeKB = 0;
    if (data) {
        options.body = JSON.stringify(data);
        requestSizeKB = Math.ceil(new Blob([options.body]).size / 1024);
    }

    try {
        const response = await fetch(url.toString(), options);
        
        if (!response.ok) {
            let errorMessage = `HTTP: ${response.status} ${response.statusText}`;
            try {
                const error = await response.json();
                if (error.message) errorMessage += ` - ${error.message}`;
                if (error.details) errorMessage += ` - ${error.details}`;
            } catch (e) {
                try {
                    const text = await response.text();
                    if (text) errorMessage += ` - ${text}`;
                } catch (e2) {}
            }
            console.error('Supabase请求失败:', errorMessage);
            throw new Error(errorMessage);
        }
        
        const text = await response.text();
        
        const responseSizeKB = Math.ceil(new Blob([text]).size / 1024);
        
        const totalSizeKB = requestSizeKB + responseSizeKB;
        const operation = method === 'GET' ? 'download' : 
                       method === 'POST' || method === 'PUT' ? 'upload' : 
                       method === 'DELETE' ? 'delete' : 'other';
        recordBandwidthUsageFromCloud(totalSizeKB, operation);
        
        if (!text || text.trim() === '') {
            console.log('Supabase返回空响应');
            return [];
        }
        
        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn('Supabase返回非JSON数据:', text);
            return [];
        }
    } catch (error) {
        console.error('Supabase请求错误:', error.message);
        return null;
    }
}

async function syncTableData(tableKey, localStorageKey, localArrayRef, isObjectData = false, isRefresh = false) {
    const tableName = supabaseConfig.tables[tableKey];
    console.log(`开始同步 ${tableKey} (${tableName})...`);
    
    let syncDirection = 'none';
    
    try {
        let localData = JSON.parse(localStorage.getItem(localStorageKey) || (isObjectData ? '{}' : '[]'));
        
        if (isObjectData) {
            if (typeof localData !== 'object' || localData === null) {
                localData = { headers: [], data: [], lastModified: null };
            }
        } else {
            if (!Array.isArray(localData)) {
                localData = [];
            }
        }
        
        const cloudData = await supabaseRequest('GET', tableName);
        
        if (!cloudData) {
            console.log(`未获取到 ${tableKey} 数据`);
            return { success: true, direction: 'none' };
        }

        let cloudParsed = isObjectData ? {} : [];
        let cloudRecordId = null;
        
        if (cloudData.length > 0) {
            const record = cloudData[0];
            cloudRecordId = record.id;
            
            if (record.data) {
                try {
                    cloudParsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
                    if (!isObjectData && !Array.isArray(cloudParsed)) {
                        cloudParsed = [];
                    }
                    if (isObjectData && typeof cloudParsed !== 'object') {
                        cloudParsed = {};
                    }
                } catch (e) {
                    console.warn(`解析 ${tableKey} 数据失败:`, e);
                    cloudParsed = isObjectData ? {} : [];
                }
            }
        }

        let finalData;
        // 如果是刷新操作，直接用云端数据替换本地数据，不合并（强制覆盖）
        if (isRefresh) {
            console.log(`[刷新模式] ${tableKey} 使用云端数据覆盖本地数据...`);
            
            // 检查云端数据是否有效
            let cloudDataValid = false;
            if (isObjectData) {
                // 对象类型数据：检查是否是有效的对象
                if (cloudParsed && typeof cloudParsed === 'object') {
                    cloudDataValid = true;
                }
            } else {
                // 数组类型数据：检查是否是有效的数组
                cloudDataValid = cloudParsed && Array.isArray(cloudParsed);
            }
            
            if (!cloudDataValid) {
                console.log(`[刷新模式] ${tableKey} 云端数据无效，使用空数据覆盖本地`);
                finalData = isObjectData ? { headers: [], data: [], lastModified: new Date().toISOString() } : [];
            } else {
                console.log(`[刷新模式] ${tableKey} 使用云端数据`);
                // 确保特殊模块的数据格式正确
                if (tableKey === 'honor') {
                    // 荣誉模块需要特定格式
                    // 检查 cloudParsed 是数组还是对象，提取出实际的数据数组
                    let honorArray = [];
                    if (cloudParsed && Array.isArray(cloudParsed)) {
                        honorArray = cloudParsed;
                    } else if (cloudParsed && cloudParsed.data && Array.isArray(cloudParsed.data)) {
                        honorArray = cloudParsed.data;
                    }
                    
                    if (honorArray.length > 0) {
                        finalData = {
                            headers: ['荣誉名称', '获奖人/单位', '荣誉级别', '颁发单位', '获奖日期', '备注'],
                            data: honorArray,
                            lastModified: new Date().toISOString()
                        };
                    } else {
                        finalData = {
                            headers: ['荣誉名称', '获奖人/单位', '荣誉级别', '颁发单位', '获奖日期', '备注'],
                            data: [],
                            lastModified: new Date().toISOString()
                        };
                    }
                } else if (tableKey === 'patrol') {
                    // 违章违纪台账模块需要特定格式
                    // 检查 cloudParsed 是数组还是对象，提取出实际的数据数组
                    let patrolArray = [];
                    if (cloudParsed && Array.isArray(cloudParsed)) {
                        patrolArray = cloudParsed;
                    } else if (cloudParsed && cloudParsed.data && Array.isArray(cloudParsed.data)) {
                        patrolArray = cloudParsed.data;
                    } else if (cloudParsed && Array.isArray(cloudParsed)) {
                        patrolArray = cloudParsed;
                    }
                    
                    if (patrolArray.length > 0) {
                        finalData = {
                            headers: ['记录日期', '姓名', '所属部门/单位', '行为/事件类别', '具体事实/经过', '发生日期', '处理依据', '行政处分等级', '经济考核内容', '安全记分', '整改/关闭情况', '备注'],
                            data: patrolArray,
                            lastModified: new Date().toISOString()
                        };
                    } else {
                        finalData = {
                            headers: ['记录日期', '姓名', '所属部门/单位', '行为/事件类别', '具体事实/经过', '发生日期', '处理依据', '行政处分等级', '经济考核内容', '安全记分', '整改/关闭情况', '备注'],
                            data: [],
                            lastModified: new Date().toISOString()
                        };
                    }
                } else if (tableKey === 'samplingCar') {
                    // 采样车维修台账模块需要特定格式
                    // 检查 cloudParsed 是数组还是对象，提取出实际的数据数组
                    let samplingCarArray = [];
                    if (cloudParsed && Array.isArray(cloudParsed)) {
                        samplingCarArray = cloudParsed;
                    } else if (cloudParsed && cloudParsed.data && Array.isArray(cloudParsed.data)) {
                        samplingCarArray = cloudParsed.data;
                    }
                    
                    // 检查云端数据是否有效（刷新时直接用云端数据覆盖）
                    if (samplingCarArray.length > 0) {
                        finalData = {
                            headers: ['维修厂家', '维修日期', '故障描述', '维修项目', '维修人', '费用', '备注'],
                            data: samplingCarArray,
                            lastModified: new Date().toISOString()
                        };
                    } else {
                        // 云端数据为空，清空本地数据
                        finalData = {
                            headers: ['维修厂家', '维修日期', '故障描述', '维修项目', '维修人', '费用', '备注'],
                            data: [],
                            lastModified: new Date().toISOString()
                        };
                    }
                } else if (tableKey === 'team') {
                    // 红旗班组名次模块需要特定格式（data是对象形式，按年份存储）
                    if (cloudParsed && typeof cloudParsed === 'object') {
                        finalData = {
                            headers: cloudParsed.headers || ['排名', '一班', '二班', '三班', '四班'],
                            data: cloudParsed.data || {},
                            lastModified: new Date().toISOString()
                        };
                    } else {
                        finalData = {
                            headers: ['排名', '一班', '二班', '三班', '四班'],
                            data: {},
                            lastModified: new Date().toISOString()
                        };
                    }
                } else if (tableKey === 'instrument') {
                    // 仪器维修台账模块需要特定格式
                    // 检查 cloudParsed 是数组还是对象，提取出实际的数据数组
                    let instrumentArray = [];
                    if (cloudParsed && Array.isArray(cloudParsed)) {
                        instrumentArray = cloudParsed;
                    } else if (cloudParsed && cloudParsed.data && Array.isArray(cloudParsed.data)) {
                        instrumentArray = cloudParsed.data;
                    }

                    if (instrumentArray.length > 0) {
                        finalData = {
                            headers: ['仪器编号', '仪器名称', '维修日期', '维修内容', '维修人员', '更换配件', '备注'],
                            data: instrumentArray,
                            lastModified: new Date().toISOString()
                        };
                        syncDirection = 'refresh';
                    } else {
                        // 云端数据为空或无效，不要覆盖本地！
                        // 提前返回，避免 localStorage 被写成空数据
                        console.log('[syncTableData] 仪器模块云端数据为空，保留本地数据');
                        return { success: false, direction: 'none' };
                    }
                } else {
                    finalData = cloudParsed;
                    syncDirection = 'refresh';
                }
            }
        } else {
            // 正常同步模式，使用合并逻辑
            if (tableKey === 'personnel') {
                finalData = mergePersonnelData(localData, cloudParsed);
            } else if (tableKey === 'teamPersonnel') {
                finalData = mergeObjectData(localData || {}, cloudParsed || {});
            } else if (isObjectData) {
                finalData = mergeTableData(localData || { headers: [], data: [] }, cloudParsed || { headers: [], data: [] });
            } else {
                finalData = mergeDataByUpdatedAt(localData, cloudParsed);
            }

            const hasChanges = JSON.stringify(localData) !== JSON.stringify(cloudParsed);
            
            const localDataEmpty = isObjectData ? Object.keys(localData || {}).length === 0 : localData.length === 0;
            const cloudDataEmpty = isObjectData ? Object.keys(cloudParsed || {}).length === 0 : cloudParsed.length === 0;
            
            let needsUpload = false;
            let needsDownload = false;
            
            if (tableKey === 'personnel') {
                needsUpload = cloudDataEmpty || (!localDataEmpty && JSON.stringify(localData) !== JSON.stringify(finalData));
                needsDownload = localDataEmpty || (!cloudDataEmpty && JSON.stringify(cloudParsed) !== JSON.stringify(finalData));
            } else {
                needsUpload = cloudDataEmpty || (!localDataEmpty && JSON.stringify(localData) !== JSON.stringify(finalData));
                needsDownload = localDataEmpty || (!cloudDataEmpty && JSON.stringify(cloudParsed) !== JSON.stringify(finalData));
            }
            
            if (needsUpload && needsDownload) {
                syncDirection = 'both';
            } else if (needsUpload) {
                syncDirection = 'upload';
            } else if (needsDownload) {
                syncDirection = 'download';
            } else {
                syncDirection = 'none';
            }
            
            if (hasChanges) {
                const nowStr = new Date().toISOString();
                if (cloudRecordId) {
                    console.log(`更新 ${tableKey} 数据...`);
                    const result = await supabaseRequest('PATCH', tableName, {
                        data: finalData,
                        updated_at: nowStr,
                        lastModified: nowStr,
                        lastmodified: nowStr
                    }, { id: `eq.${cloudRecordId}` });
                    if (result) {
                        console.log(`${tableKey} 数据更新成功`);
                    }
                } else {
                    console.log(`创建 ${tableKey} 数据...`);
                    const result = await supabaseRequest('POST', tableName, {
                        id: generateUUID(),
                        data: finalData,
                        created_at: nowStr,
                        updated_at: nowStr,
                        lastModified: nowStr,
                        lastmodified: nowStr
                    });
                    if (result) {
                        console.log(`${tableKey} 数据创建成功`);
                    }
                }
            } else {
                console.log(`${tableKey} 数据无变化`);
            }
        }

        if (localArrayRef && typeof window[localArrayRef] !== 'undefined') {
            window[localArrayRef] = finalData;
        }
        
        localStorage.setItem(localStorageKey, JSON.stringify(finalData));
        console.log(`${tableKey} 数据已保存到本地`);
        
        return { success: true, direction: syncDirection };
    } catch (error) {
        console.error(`${tableKey} 同步失败:`, error);
        return { success: false, direction: 'error' };
    }
}

function mergeDataByUpdatedAt(localData, cloudData) {
    const mergedData = [...localData];
    
    cloudData.forEach(cloudItem => {
        const localIndex = mergedData.findIndex(item => item.id === cloudItem.id);
        
        if (localIndex === -1) {
            mergedData.push(cloudItem);
        } else {
            const localUpdated = mergedData[localIndex].updated_at 
                ? new Date(mergedData[localIndex].updated_at) 
                : new Date(0);
            const cloudUpdated = cloudItem.updated_at 
                ? new Date(cloudItem.updated_at) 
                : new Date(0);
            
            if (cloudUpdated > localUpdated) {
                mergedData[localIndex] = cloudItem;
            }
        }
    });
    
    return mergedData;
}

function mergeObjectData(localData, cloudData) {
    const mergedData = { ...localData };
    
    for (const key of Object.keys(cloudData)) {
        if (!mergedData[key]) {
            mergedData[key] = [];
        }
        
        const cloudArray = cloudData[key] || [];
        const localArray = mergedData[key] || [];
        
        const mergedArray = [...localArray];
        
        cloudArray.forEach(cloudItem => {
            if (!mergedArray.includes(cloudItem)) {
                mergedArray.push(cloudItem);
            }
        });
        
        mergedData[key] = mergedArray;
    }
    
    return mergedData;
}

/**
 * 可靠的合并数据函数 - 使用版本号和冲突检测
 * 这个函数会替代原来的 mergeTableData
 */
function reliableMergeTableData(localData, cloudData, moduleKey) {
    // 如果有可靠同步模块，使用它的合并逻辑
    if (typeof window.reliableSync !== 'undefined') {
        const result = window.reliableSync.mergeWithConflictResolution(localData, cloudData, moduleKey);
        return result.data;
    }

    // 回退到原来的简单合并逻辑（带警告）
    console.warn('可靠同步模块未加载，使用简单的合并逻辑，可能存在数据冲突风险');
    return simpleMergeTableData(localData, cloudData);
}

/**
 * 简单的合并数据函数（原逻辑）
 */
function simpleMergeTableData(localData, cloudData) {
    const localHeaders = localData.headers || [];
    const localRows = localData.data || [];
    const cloudHeaders = cloudData.headers || [];
    const cloudRows = cloudData.data || [];
    
    const mergedHeaders = [...new Set([...localHeaders, ...cloudHeaders])];
    
    const localRowStrings = new Set(localRows.map(row => JSON.stringify(row)));
    const mergedRows = [...localRows];
    
    cloudRows.forEach(cloudRow => {
        const rowString = JSON.stringify(cloudRow);
        if (!localRowStrings.has(rowString)) {
            mergedRows.push(cloudRow);
        }
    });
    
    const localModified = new Date(localData.lastModified || 0);
    const cloudModified = new Date(cloudData.lastModified || 0);
    const lastModified = localModified > cloudModified ? localData.lastModified : cloudData.lastModified;
    
    return {
        headers: mergedHeaders,
        data: mergedRows,
        lastModified: lastModified || new Date().toISOString()
    };
}

/**
 * 合并数据 - 使用可靠的版本
 * 这个函数会被 syncTableData 调用
 */
function mergeTableData(localData, cloudData) {
    // 判断使用哪种合并策略
    // 如果数据包含版本控制字段，使用可靠合并
    const hasVersionField = (data) => {
        if (!data || !data.data) return false;
        return data.data.some(row => row._sync_version !== undefined);
    };

    // 如果本地或云端数据包含版本号，使用可靠合并
    if (hasVersionField(localData) || hasVersionField(cloudData)) {
        console.log('[合并] 使用可靠合并策略');
        return reliableMergeTableData(localData, cloudData, 'unknown');
    }

    // 否则使用简单合并
    console.log('[合并] 使用简单合并策略');
    return simpleMergeTableData(localData, cloudData);
}

function mergePersonnelData(localData, cloudData) {
    const idMap = new Map();
    
    const allData = [...localData, ...cloudData];
    
    allData.forEach(item => {
        const key = getPersonnelUniqueKey(item);
        
        if (!key) {
            return;
        }
        
        if (!idMap.has(key)) {
            idMap.set(key, item);
        } else {
            const existing = idMap.get(key);
            const existingUpdated = existing.updated_at 
                ? new Date(existing.updated_at) 
                : new Date(0);
            const itemUpdated = item.updated_at 
                ? new Date(item.updated_at) 
                : new Date(0);
            
            if (itemUpdated > existingUpdated) {
                idMap.set(key, item);
            }
        }
    });
    
    const mergedData = Array.from(idMap.values());
    
    console.log(`人员数据去重完成: 原始 ${allData.length} 条 -> 合并后 ${mergedData.length} 条`);
    return mergedData;
}

function getPersonnelUniqueKey(item) {
    if (!item) return null;
    
    const possibleKeys = [
        'personnelId',
        'idCardNumber', 
        'id', 
        'name', 
        'mobile',
        'phone',
        'idNumber',
        'employeeId',
        'staffId'
    ];
    
    for (const key of possibleKeys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '' && item[key] !== 'undefined' && item[key] !== 'null') {
            return String(item[key]).trim();
        }
    }
    
    return null;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const moduleNames = {
    inspection: '检查问题台账',
    samplingCar: '采样车维修台账',
    instrument: '仪器维修台账',
    honor: '获得荣誉台账',
    patrol: '违章违纪台账',
    personnel: '人员信息管理',
    team: '红旗班组名次',
    teamPersonnel: '班组人员管理',
    training: '副班培训成绩',
    users: '系统用户',
    hazard: '隐患排查治理',
    samplingAnomaly: '采样点异常排查'
};

const moduleConfigs = [
    { key: 'inspection', storageKey: 'centerInspectionData', arrayRef: 'centerInspectionData', isObject: false },
    { key: 'samplingCar', storageKey: 'samplingCarData', arrayRef: 'samplingCarData', isObject: true },
    { key: 'instrument', storageKey: 'instrumentData', arrayRef: 'instrumentData', isObject: true },
    { key: 'honor', storageKey: 'honorData', arrayRef: 'honorData', isObject: false },
    { key: 'patrol', storageKey: 'violationDisciplineLedger', arrayRef: null, isObject: true },
    { key: 'personnel', storageKey: 'personnelData', arrayRef: 'allPersonnelData', isObject: false },
    { key: 'team', storageKey: 'teamCompetitionLedger', arrayRef: null, isObject: true },
    { key: 'teamPersonnel', storageKey: 'teamPersonnelData', arrayRef: 'currentTeamPersonnelData', isObject: true },
    { key: 'training', storageKey: 'trainingData', arrayRef: 'allTrainingData', isObject: false },
    { key: 'users', storageKey: 'systemUsers', arrayRef: 'systemUsers', isObject: false },
    { key: 'task', storageKey: 'taskData', arrayRef: 'taskData', isObject: false },
    { key: 'hazard', storageKey: 'hazardData', arrayRef: 'hazardData', isObject: false },
    { key: 'samplingAnomaly', storageKey: 'samplingAnomalyData', arrayRef: 'samplingAnomalyData', isObject: false }
];

async function cloudSyncAllData() {
    console.log('========== 开始同步所有数据 ==========');
    const syncResults = [];
    
    try {
        for (const module of moduleConfigs) {
            console.log(`开始同步 ${moduleNames[module.key]}...`);
            try {
                const result = await syncTableData(module.key, module.storageKey, module.arrayRef, module.isObject, true);
                const directionText = getDirectionText(result.direction);
                syncResults.push({
                    name: moduleNames[module.key],
                    success: result.success,
                    direction: result.direction
                });
                console.log(`${moduleNames[module.key]}: ${result.success ? '成功' : '失败'} ${directionText}`);
            } catch (error) {
                syncResults.push({
                    name: moduleNames[module.key],
                    success: false,
                    direction: 'error',
                    error: error.message
                });
                console.error(`${moduleNames[module.key]} 同步失败:`, error);
            }
        }

        const successCount = syncResults.filter(r => r.success).length;
        const totalCount = syncResults.length;
        
        console.log(`========== 同步完成: ${successCount}/${totalCount} 模块成功 ==========`);
        
        showSyncResultModal(syncResults);
        
        return successCount > 0;
    } catch (error) {
        console.error('同步过程发生错误:', error);
        return false;
    }
}

async function syncSingleModule(moduleKey) {
    console.log(`========== 同步单个模块 ${moduleNames[moduleKey]} ==========`);
    
    const moduleConfig = moduleConfigs.find(m => m.key === moduleKey);
    if (!moduleConfig) {
        console.error(`未找到模块配置: ${moduleKey}`);
        alert(`未找到模块配置: ${moduleKey}`);
        return;
    }
    
    const btn = document.getElementById(`sync${moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)}Btn`);
    const originalText = btn ? btn.innerHTML : null;
    
    if (btn) {
        btn.innerHTML = '<span class="btn-icon">⏳</span> 同步中..';
        btn.disabled = true;
    }
    
    try {
        const result = await syncTableData(moduleConfig.key, moduleConfig.storageKey, moduleConfig.arrayRef, moduleConfig.isObject);
        
        const directionText = getDirectionText(result.direction);
        
        if (result.success) {
            alert(`同步${moduleNames[moduleKey]}成功\n方向: ${directionText}`);
            console.log(`${moduleNames[moduleKey]} 同步成功 ${directionText}`);
        } else {
            alert(`同步${moduleNames[moduleKey]}失败`);
            console.error(`${moduleNames[moduleKey]} 同步失败`);
        }
    } catch (error) {
        alert(`同步${moduleNames[moduleKey]}失败\n\n错误: ${error.message}`);
        console.error(`${moduleNames[moduleKey]} 同步异常:`, error);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function deleteFromCloud(tableKey, id) {
    const tableName = supabaseConfig.tables[tableKey];
    
    if (!tableName) {
        console.warn(`未找到模块 ${tableKey} 对应的表名`);
        return false;
    }
    
    try {
        const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${id}` });
        
        if (result !== null) {
            console.log(`删除${tableKey}记录成功: ${id}`);
            return true;
        } else {
            console.error(`删除${tableKey}记录失败`);
            return false;
        }
    } catch (error) {
        console.error(`删除记录失败`, error);
        return false;
    }
}

async function batchDeleteFromCloud(tableKey, ids) {
    const tableName = supabaseConfig.tables[tableKey];
    
    if (!tableName) {
        console.warn(`未找到模块 ${tableKey} 对应的表名`);
        return false;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const id of ids) {
        try {
            const result = await supabaseRequest('DELETE', tableName, null, { id: `eq.${id}` });
            
            if (result !== null) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            failCount++;
            console.error(`删除记录 ID ${id} 失败`, error);
        }
    }
    
    console.log(`批量删除完成: 成功 ${successCount} 条, 失败 ${failCount} 条`);
    return { success: successCount, failed: failCount };
}

function getDirectionText(direction) {
    switch(direction) {
        case 'upload': return '上传';
        case 'download': return '下载';
        case 'both': return '双向同步';
        case 'none': return '无变化';
        case 'error': return '错误';
        default: return '';
    }
}

function getDirectionIcon(direction) {
    switch(direction) {
        case 'upload': return '⬆️';
        case 'download': return '⬇️';
        case 'both': return '🔄';
        case 'none': return '➡️';
        case 'error': return '❌';
        default: return '';
    }
}

function showSyncResultModal(results) {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    let resultHtml = `
        <div style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 10px; text-align: left; font-size: 13px; color: #6b7280;">模块</th>
                        <th style="padding: 10px; text-align: center; font-size: 13px; color: #6b7280;">方向</th>
                        <th style="padding: 10px; text-align: right; font-size: 13px; color: #6b7280;">状态</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        const directionIcon = getDirectionIcon(result.direction);
        const directionText = getDirectionText(result.direction);
        resultHtml += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${result.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-size: 14px;" title="${directionText}">${directionIcon}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                    ${result.success ? '<span style="color: #10b981;">成功</span>' : '<span style="color: #ef4444;">失败</span>'}
                </td>
            </tr>
        `;
    });
    
    resultHtml += `
                </tbody>
            </table>
        </div>
        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 15px; font-size: 12px; color: #6b7280;">
            <strong style="color: #374151;">同步说明</strong>
            <span style="margin-right: 15px;">⬆️ 上传</span>
            <span style="margin-right: 15px;">⬇️ 下载</span>
            <span style="margin-right: 15px;">🔄 双向同步</span>
            <span style="margin-right: 15px;">➡️ 无变化</span>
        </div>
        <div style="text-align: center; padding: 15px; background: ${successCount === totalCount ? '#dcfce7' : successCount > 0 ? '#fef3c7' : '#fee2e2'}; border-radius: 8px; margin-bottom: 15px;">
            <strong style="font-size: 16px; color: ${successCount === totalCount ? '#166534' : successCount > 0 ? '#92400e' : '#991b1b'};">
                ${successCount === totalCount ? '全部同步成功' : successCount > 0 ? `部分成功 (${successCount}/${totalCount})` : '全部失败'}
            </strong>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.id = 'syncResultModal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        padding: 24px;
        max-width: 450px;
        width: 90%;
        z-index: 2000;
        animation: fadeIn 0.2s ease;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'closeSyncModalBtn';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        transition: color 0.2s;
    `;
    closeBtn.addEventListener('mouseover', () => closeBtn.style.color = '#1f2937');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.color = '#6b7280');
    
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';
    
    const title = document.createElement('h3');
    title.textContent = '同步结果';
    title.style.cssText = 'margin: 0; font-size: 18px; color: #1f2937;';
    
    headerDiv.appendChild(title);
    headerDiv.appendChild(closeBtn);
    
    const okBtn = document.createElement('button');
    okBtn.id = 'syncModalOkBtn';
    okBtn.textContent = '确定';
    okBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, rgb(102, 126, 234) 0%, rgb(118, 75, 162) 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: transform 0.2s, box-shadow 0.2s;
    `;
    okBtn.addEventListener('mouseover', () => {
        okBtn.style.transform = 'translateY(-2px)';
        okBtn.style.boxShadow = 'rgba(102, 126, 234, 0.6) 0px 4px 15px';
    });
    okBtn.addEventListener('mouseout', () => {
        okBtn.style.transform = 'translateY(0)';
        okBtn.style.boxShadow = 'none';
    });
    
    modal.appendChild(headerDiv);
    
    const resultContainer = document.createElement('div');
    resultContainer.innerHTML = resultHtml;
    modal.appendChild(resultContainer);
    
    modal.appendChild(okBtn);
    
    const overlay = document.createElement('div');
    overlay.id = 'syncResultOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1999;
    `;
    
    function closeSyncModal() {
        modal.remove();
        overlay.remove();
    }
    
    closeBtn.addEventListener('click', closeSyncModal);
    okBtn.addEventListener('click', closeSyncModal);
    overlay.addEventListener('click', closeSyncModal);
    
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

async function syncModuleChangesToCloud(moduleKey, changes) {
    try {
        const tableName = supabaseConfig.tables[moduleKey];
        if (!tableName) {
            console.error(`未找到模块 ${moduleKey} 对应的表名`);
            return false;
        }

        let successCount = 0;
        const totalCount = changes.added.length + changes.updated.length + changes.deleted.length;
        let hasAnySuccess = false;

        // 对于添加记录，我们需要使用与完整同步相同的方式：
        // 1. 先获取现有记录
        // 2. 如果有现有记录，更新它
        // 3. 如果没有，创建新记录（使用 UUID）
        if (changes.added.length > 0) {
            try {
                // 获取云端现有数据
                const cloudData = await supabaseRequest('GET', tableName);
                
                // 收集所有要添加的数据
                const allNewData = changes.added.map(row => row.data);
                
                // 如果有现有数据，需要合并
                let finalData = allNewData;
                if (cloudData && cloudData.length > 0 && cloudData[0].data) {
                    const existingData = cloudData[0].data;
                    if (Array.isArray(existingData)) {
                        // 合并现有数据和新数据，去重
                        const existingIds = new Set(existingData.map(item => item.id));
                        const newItems = allNewData.filter(item => !existingIds.has(item.id));
                        finalData = [...existingData, ...newItems];
                    }
                }
                
                // 更新或创建云端记录
                const payload = {
                    data: finalData,
                    updated_at: new Date().toISOString()
                };
                
                if (cloudData && cloudData.length > 0 && cloudData[0].id) {
                    await supabaseRequest('PATCH', tableName, payload, {
                        id: `eq.${cloudData[0].id}`
                    });
                } else {
                    await supabaseRequest('POST', tableName, {
                        id: generateUUID(),
                        ...payload,
                        created_at: new Date().toISOString()
                    });
                }
                
                successCount += changes.added.length;
                hasAnySuccess = true;
                console.log(`${moduleKey} 添加记录成功: ${changes.added.length} 条`);
            } catch (error) {
                console.error(`${moduleKey} 添加记录失败:`, error);
            }
        }

        // 对于更新和删除操作，重新上传所有数据到云端
        if (changes.updated.length > 0 || changes.deleted.length > 0) {
            try {
                // 获取当前模块的完整数据
                const moduleDataKey = moduleKey;
                const moduleData = localStorage.getItem(moduleDataKey + 'Data');
                const currentData = moduleData ? JSON.parse(moduleData) : [];
                
                // 如果有删除操作，先过滤掉删除的记录
                if (changes.deleted.length > 0) {
                    const deletedIds = new Set(changes.deleted.map(d => d.rowId));
                    currentData = currentData.filter(item => !deletedIds.has(item.id));
                }
                
                // 更新或创建云端记录
                const cloudData = await supabaseRequest('GET', tableName);
                const payload = {
                    data: currentData,
                    updated_at: new Date().toISOString()
                };
                
                if (cloudData && cloudData.length > 0 && cloudData[0].id) {
                    await supabaseRequest('PATCH', tableName, payload, {
                        id: `eq.${cloudData[0].id}`
                    });
                } else {
                    await supabaseRequest('POST', tableName, {
                        id: generateUUID(),
                        ...payload,
                        created_at: new Date().toISOString()
                    });
                }
                
                hasAnySuccess = true;
                console.log(`${moduleKey} 更新/删除操作同步成功: ${changes.updated.length}/${changes.deleted.length}`);
            } catch (error) {
                console.error(`${moduleKey} 更新/删除操作同步失败:`, error);
            }
        }

        console.log(`${moduleKey} 变更同步完成: ${successCount}/${totalCount}`);
        
        // 如果有任何操作成功，提交待审计日志
        if (hasAnySuccess && typeof commitAllPendingAuditLogs === 'function') {
            await commitAllPendingAuditLogs();
        }
        
        return hasAnySuccess;
    } catch (error) {
        console.error(`${moduleKey} 变更同步失败:`, error);
        return false;
    }
}

async function syncModuleDataToCloud(moduleKey, data) {
    try {
        const tableName = supabaseConfig.tables[moduleKey];
        if (!tableName) {
            console.error(`未找到模块 ${moduleKey} 对应的表名`);
            return false;
        }

        if (moduleKey === 'patrol') {
            return await syncPatrolRelationalDataToCloud(data);
        }

        if (moduleKey === 'samplingAnomaly') {
            return await syncSamplingAnomalyDataToCloud(data);
        }

        // 检查问题台账模块使用单记录存储模式（每条记录单独一行）
        if (moduleKey === 'centerInspection' || moduleKey === 'workshopInspection') {
            return await syncInspectionRelationalDataToCloud(moduleKey, tableName, data);
        }

        // 任务完成情况和隐患排查治理使用单记录存储模式
        if (moduleKey === 'task' || moduleKey === 'hazard') {
            return await syncTaskOrHazardToCloud(moduleKey, tableName, data);
        }

        const payload = {
            data: data,
            updated_at: new Date().toISOString()
        };

        const cloudData = await supabaseRequest('GET', tableName);

        if (cloudData && cloudData.length > 0 && cloudData[0].id) {
            await supabaseRequest('PATCH', tableName, payload, {
                id: `eq.${cloudData[0].id}`
            });
            console.log(`${moduleKey} 数据更新成功`);
        } else {
            await supabaseRequest('POST', tableName, {
                id: generateUUID(),
                ...payload,
                created_at: new Date().toISOString()
            });
            console.log(`${moduleKey} 数据创建成功`);
        }

        // 同步成功后提交待审计日志
        if (typeof commitAllPendingAuditLogs === 'function') {
            await commitAllPendingAuditLogs();
        }

        return true;
    } catch (error) {
        console.error(`${moduleKey} 同步到云端失败`, error);
        return false;
    }
}

// 任务和隐患的增量同步函数
async function syncTaskOrHazardToCloud(moduleKey, tableName, data) {
    try {
        if (!Array.isArray(data) || data.length === 0) {
            console.log(`${moduleKey} 没有数据需要同步`);
            return { success: true };
        }

        // 获取云端现有数据
        const cloudData = await supabaseRequest('GET', tableName);
        const cloudIdSet = new Set(cloudData?.map(item => item.id) || []);
        const cloudUpdateTimes = {};
        cloudData?.forEach(item => {
            if (item.id && item.updated_at) {
                cloudUpdateTimes[item.id] = item.updated_at;
            }
        });

        // 增量同步：分离新增和更新数据
        const newRecords = [];
        const updateRecords = [];
        
        data.forEach(item => {
            const cloudUpdateTime = cloudUpdateTimes[item.id];
            const localUpdateTime = item.updated_at;
            
            if (!cloudIdSet.has(item.id)) {
                newRecords.push(item);
            } else if (localUpdateTime && cloudUpdateTime && new Date(localUpdateTime) > new Date(cloudUpdateTime)) {
                updateRecords.push(item);
            } else if (!cloudUpdateTime) {
                // 云端没有更新时间，默认需要更新
                updateRecords.push(item);
            }
        });

        console.log(`[增量同步] ${moduleKey}: 新增 ${newRecords.length} 条, 更新 ${updateRecords.length} 条`);

        if (newRecords.length === 0 && updateRecords.length === 0) {
            console.log(`${moduleKey} 数据已是最新，无需同步`);
            return { success: true };
        }

        // 批量新增（每批100条）
        const batchSize = 100;
        for (let i = 0; i < newRecords.length; i += batchSize) {
            const batch = newRecords.slice(i, i + batchSize);
            const batchData = batch.map(item => {
                const now = new Date().toISOString();
                return {
                    id: item.id,
                    title: item.title || '',
                    description: item.description || '',
                    assignee: item.assignee || '',
                    priority: item.priority || 'normal',
                    status: item.status || 'pending',
                    progress: item.progress || 0,
                    deadline: item.deadline || null,
                    notes: item.notes || item.remark || '',
                    remark: item.remark || '',
                    completion_note: item.completion_note || '',
                    completion_user: item.completion_user || '',
                    reject_records: item.reject_records || item.rejectRecords || [],
                    completion_records: item.completion_records || item.completionRecords || [],
                    progress_records: item.progress_records || item.progressRecords || [],
                    cannot_complete_records: item.cannot_complete_records || item.cannotCompleteRecords || [],
                    status_change_records: item.status_change_records || item.statusChangeRecords || [],
                    escalate_records: item.escalate_records || item.escalateRecords || [],
                    confirm_records: item.confirm_records || item.confirmRecords || [],
                    created_at: item.created_at || now,
                    updated_at: item.updated_at || now,
                    _sync_version: item._sync_version || 1,
                    report_date: item.report_date || item.reportDate || null,
                    department: item.department || '',
                    reporter: item.reporter || '',
                    category: item.category || '',
                    hazard_type: item.hazard_type || item.hazardType || '',
                    hazard_level: item.hazard_level || item.hazardLevel || '',
                    result: item.result || '',
                    creator: item.creator || '',
                    creator_role: item.creator_role || '',
                    is_admin_created: item.is_admin_created || false
                };
            });
            
            // 使用批量 upsert（冲突时更新）
            const url = new URL(`${supabaseConfig.url}/rest/v1/${tableName}`);
            url.searchParams.append('on_conflict', 'id');
            url.searchParams.append('select', ''); // 不返回数据
            
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseConfig.key,
                    'Authorization': `Bearer ${supabaseConfig.key}`,
                    'Prefer': 'return=minimal, resolution=merge-duplicates'
                },
                body: JSON.stringify(batchData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`${moduleKey} 批量新增失败:`, errorText);
            }
        }

        // 并行更新（每批50条）
        const updateBatchSize = 50;
        for (let i = 0; i < updateRecords.length; i += updateBatchSize) {
            const batch = updateRecords.slice(i, i + updateBatchSize);
            const promises = batch.map(async (item) => {
                const now = new Date().toISOString();
                const updateData = {
                    title: item.title || '',
                    description: item.description || '',
                    assignee: item.assignee || '',
                    priority: item.priority || 'normal',
                    status: item.status || 'pending',
                    progress: item.progress || 0,
                    deadline: item.deadline || null,
                    notes: item.notes || item.remark || '',
                    remark: item.remark || '',
                    completion_note: item.completion_note || '',
                    completion_user: item.completion_user || '',
                    reject_records: item.reject_records || item.rejectRecords || [],
                    completion_records: item.completion_records || item.completionRecords || [],
                    progress_records: item.progress_records || item.progressRecords || [],
                    cannot_complete_records: item.cannot_complete_records || item.cannotCompleteRecords || [],
                    status_change_records: item.status_change_records || item.statusChangeRecords || [],
                    escalate_records: item.escalate_records || item.escalateRecords || [],
                    confirm_records: item.confirm_records || item.confirmRecords || [],
                    updated_at: now,
                    _sync_version: (item._sync_version || 0) + 1,
                    report_date: item.report_date || item.reportDate || null,
                    department: item.department || '',
                    reporter: item.reporter || '',
                    category: item.category || '',
                    hazard_type: item.hazard_type || item.hazardType || '',
                    hazard_level: item.hazard_level || item.hazardLevel || '',
                    result: item.result || '',
                    creator: item.creator || '',
                    creator_role: item.creator_role || '',
                    is_admin_created: item.is_admin_created || false
                };
                
                await supabaseRequest('PATCH', tableName, updateData, { id: `eq.${item.id}` });
            });
            await Promise.all(promises);
        }

        console.log(`${moduleKey} 增量同步完成`);
        return { success: true };
    } catch (error) {
        console.error(`${moduleKey} 增量同步失败:`, error);
        return { success: false, error: error.message };
    }
}

async function syncInspectionRelationalDataToCloud(moduleKey, tableName, data) {
    try {
        if (!Array.isArray(data) || data.length === 0) {
            console.log(`${moduleKey} 没有数据需要同步`);
            return true;
        }

        // 获取云端现有数据的ID和最新更新时间
        const cloudData = await supabaseRequest('GET', tableName);
        const cloudIdSet = new Set(cloudData?.map(item => item.id) || []);
        const cloudUpdateTimes = {};
        cloudData?.forEach(item => {
            if (item.id && item.updated_at) {
                cloudUpdateTimes[item.id] = item.updated_at;
            }
        });

        // 增量同步：分离新增和更新数据
        const newRecords = [];
        const updateRecords = [];
        
        data.forEach(item => {
            const cloudUpdateTime = cloudUpdateTimes[item.id];
            const localUpdateTime = item.updated_at;
            
            if (!cloudIdSet.has(item.id)) {
                newRecords.push(item);
            } else if (localUpdateTime && cloudUpdateTime) {
                if (new Date(localUpdateTime) > new Date(cloudUpdateTime)) {
                    updateRecords.push(item);
                }
            }
        });

        console.log(`${moduleKey} 增量同步，新增 ${newRecords.length} 条，更新 ${updateRecords.length} 条（总数据 ${data.length} 条）`);

        if (newRecords.length === 0 && updateRecords.length === 0) {
            console.log(`${moduleKey} 没有需要同步的数据`);
            return true;
        }

        const now = new Date().toISOString();
        let successCount = 0;
        let errorCount = 0;

        // 批量新增（每批最多100条）
        if (newRecords.length > 0) {
            const insertBatchSize = 100;
            for (let i = 0; i < newRecords.length; i += insertBatchSize) {
                const batch = newRecords.slice(i, i + insertBatchSize);
                const batchData = batch.map(item => {
                    const cleaned = cleanInspectionDataForSync(item);
                    return {
                        id: item.id,
                        checkunit: cleaned.checkunit || '',
                        checktime: cleaned.checktime || '',
                        deadline: cleaned.deadline || '',
                        description: cleaned.description || '',
                        inspector: cleaned.inspector || '',
                        status: cleaned.status || '未整改',
                        responsible: cleaned.responsible || '',
                        responsibleperson: cleaned.responsibleperson || '',
                        measures: cleaned.measures || '',
                        inspectioncategory: cleaned.inspectioncategory || '',
                        created_at: item.created_at || now,
                        updated_at: now
                    };
                });

                const result = await bulkInsertToCloud(tableName, batchData);
                if (result) {
                    successCount += batchData.length;
                } else {
                    // 降级为逐条插入
                    for (const item of batch) {
                        try {
                            const cleaned = cleanInspectionDataForSync(item);
                            await supabaseRequest('POST', tableName, {
                                id: item.id,
                                ...cleaned,
                                created_at: item.created_at || now,
                                updated_at: now
                            });
                            successCount++;
                        } catch (e) {
                            errorCount++;
                            console.warn(`${moduleKey} 插入失败 (id: ${item.id}):`, e.message);
                        }
                    }
                }
            }
        }

        // 批量更新（每批最多100条，并行处理）
        if (updateRecords.length > 0) {
            const updateBatchSize = 50;
            for (let i = 0; i < updateRecords.length; i += updateBatchSize) {
                const batch = updateRecords.slice(i, i + updateBatchSize);
                
                const promises = batch.map(async (item) => {
                    try {
                        const cleaned = cleanInspectionDataForSync(item);
                        await supabaseRequest('PATCH', tableName, {
                            ...cleaned,
                            updated_at: now
                        }, { id: `eq.${item.id}` });
                        successCount++;
                    } catch (e) {
                        errorCount++;
                        console.warn(`${moduleKey} 更新失败 (id: ${item.id}):`, e.message);
                    }
                });
                
                await Promise.all(promises);
                await new Promise(resolve => setTimeout(resolve, 30));
            }
        }

        console.log(`${moduleKey} 同步完成，成功: ${successCount}, 失败: ${errorCount}`);
        
        if (typeof commitAllPendingAuditLogs === 'function') {
            await commitAllPendingAuditLogs();
        }

        return errorCount === 0;
    } catch (error) {
        console.error(`${moduleKey} 同步到云端失败`, error);
        return false;
    }
}

async function bulkInsertToCloud(tableName, data) {
    try {
        const url = new URL(`${supabaseConfig.url}/rest/v1/${tableName}`);
        url.searchParams.append('on_conflict', 'id'); // 主键冲突时更新
        url.searchParams.append('select', ''); // 不返回数据

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`,
                'Prefer': 'return=minimal, resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('批量插入失败:', errorText);
            return false;
        }

        console.log('批量插入/更新成功，处理:', data.length, '条');
        return true;
    } catch (error) {
        console.error('批量插入异常:', error);
        return false;
    }
}

async function bulkUpsertToCloud(tableName, data) {
    try {
        const url = new URL(`${supabaseConfig.url}/rest/v1/${tableName}`);
        url.searchParams.append('on_conflict', 'id');
        url.searchParams.append('select', '');

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`,
                'Prefer': 'return=representation,resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('批量插入失败:', error);
            return false;
        }

        const result = await response.json();
        console.log('批量插入成功，插入/更新:', result.length, '条');
        return true;
    } catch (error) {
        console.error('批量插入异常:', error);
        return false;
    }
}

async function syncInspectionFallback(moduleKey, tableName, pendingSync, cloudIdSet) {
    let successCount = 0;
    let errorCount = 0;

    const batchSize = 50;
    for (let i = 0; i < pendingSync.length; i += batchSize) {
        const batch = pendingSync.slice(i, i + batchSize);
        
        const promises = batch.map(async (item) => {
            try {
                const cleanedData = cleanInspectionDataForSync(item);
                const now = new Date().toISOString();

                if (cloudIdSet.has(item.id)) {
                    await supabaseRequest('PATCH', tableName, {
                        ...cleanedData,
                        updated_at: now
                    }, { id: `eq.${item.id}` });
                } else {
                    await supabaseRequest('POST', tableName, {
                        id: item.id,
                        ...cleanedData,
                        created_at: now,
                        updated_at: now
                    });
                }
                successCount++;
            } catch (e) {
                errorCount++;
                console.warn(`${moduleKey} 同步失败 (id: ${item.id}):`, e.message);
            }
        });

        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`${moduleKey} 降级同步完成，成功: ${successCount}, 失败: ${errorCount}`);
    return errorCount === 0;
}

function cleanInspectionDataForSync(data, excludeField = null) {
    // 数据库实际存在的列（全小写）
    const DB_COLUMNS = new Set([
        'checkunit', 'checktime', 'deadline', 'description',
        'inspector', 'status', 'responsible', 'responsibleperson',
        'measures', 'inspectioncategory'
    ]);

    // 本地数据中可能使用的各种字段名 → 数据库列名
    const value = (src, ...keys) => {
        for (const k of keys) {
            if (src[k] !== undefined && src[k] !== null && src[k] !== '') return src[k];
        }
        return undefined;
    };

    const cleaned = {};
    cleaned.checkunit = value(data, 'checkunit', 'unit', 'checkUnit');
    cleaned.checktime = value(data, 'checktime', 'date', 'checkTime');
    cleaned.deadline = value(data, 'deadline');
    cleaned.description = value(data, 'description');
    cleaned.inspector = value(data, 'inspector');
    cleaned.status = value(data, 'status');
    cleaned.responsible = value(data, 'responsible');
    cleaned.responsibleperson = value(data, 'responsibleperson', 'responsiblePerson');
    cleaned.measures = value(data, 'measures');
    cleaned.inspectioncategory = value(data, 'inspectioncategory', 'category', 'inspectionCategory');

    // 移除空值字段
    Object.keys(cleaned).forEach(k => {
        if (cleaned[k] === undefined || cleaned[k] === null || cleaned[k] === '') delete cleaned[k];
    });

    // 安全检查：确保只保留数据库存在的列
    Object.keys(cleaned).forEach(k => {
        if (!DB_COLUMNS.has(k)) delete cleaned[k];
    });

    return cleaned;
}

async function syncPatrolRelationalDataToCloud(data) {
    try {
        const tableName = supabaseConfig.tables['patrol'];
        if (!tableName) {
            console.error('未找到违章违纪台账对应的表名');
            return false;
        }

        const patrolData = data.data || [];
        console.log('开始同步违章违纪台账到云端，数据条数:', patrolData.length);
        console.log('数据详情:', patrolData);

        // 先删除所有现有数据
        console.log('清空云端现有数据...');
        await supabaseRequest('DELETE', tableName);
        
        // 然后重新插入所有数据
        let successCount = 0;
        for (let i = 0; i < patrolData.length; i++) {
            const item = patrolData[i];
            try {
                // 确保日期格式正确，如果为空使用今天的日期
                const getToday = () => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                const formatDate = (dateStr) => {
                    if (!dateStr) {
                        console.warn('日期字段为空，使用今天的日期');
                        return getToday();
                    }
                    return dateStr;
                };

                const mappedData = {
                    record_date: formatDate(item.recordDate),
                    name: item.name || '',
                    department: item.department || '',
                    category: item.category || '',
                    facts: item.facts || '',
                    occur_date: formatDate(item.occurDate),
                    basis: item.basis || '',
                    punishment_level: item.punishmentLevel || '',
                    economic_penalty: item.economicPenalty || '',
                    safety_score: item.safetyScore || '',
                    rectification_status: item.rectificationStatus || '',
                    remark: item.remark || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                console.log(`插入第 ${i+1} 条违章违纪记录:`, item.name || item.id, mappedData);
                await supabaseRequest('POST', tableName, mappedData);
                successCount++;
            } catch (error) {
                console.error(`插入第 ${i+1} 条违章违纪记录失败:`, error, item);
            }
        }

        if (typeof commitAllPendingAuditLogs === 'function') {
            await commitAllPendingAuditLogs();
        }

        console.log(`违章违纪台账数据同步成功，共 ${successCount}/${patrolData.length} 条`);
        return true;
    } catch (error) {
        console.error('违章违纪台账同步到云端失败', error);
        return false;
    }
}

/**
 * 检查状态值是否有效（采样点异常专用）
 */
function isValidSamplingAnomalyStatus(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed !== '' && trimmed !== 'undefined' && trimmed !== 'null';
    }
    return false;
}

/**
 * 获取有效的采样点异常状态值
 */
function getSamplingAnomalyStatus(item) {
    if (isValidSamplingAnomalyStatus(item.completion_status)) {
        return item.completion_status;
    }
    if (isValidSamplingAnomalyStatus(item.completionStatus)) {
        return item.completionStatus;
    }
    return 'progress';
}

/**
 * 采样点异常排查数据同步函数
 * 逐条记录同步到云端
 */
async function syncSamplingAnomalyDataToCloud(data) {
    try {
        const tableName = supabaseConfig.tables['samplingAnomaly'];
        if (!tableName) {
            console.error('未找到采样点异常排查对应的表名');
            return false;
        }

        const samplingAnomalyData = data.data || [];
        console.log('[采样点异常云端同步] 开始同步到云端，数据条数:', samplingAnomalyData.length);
        
        // 使用 UPSERT 方式同步：存在则更新，不存在则插入
        let successCount = 0;
        for (let i = 0; i < samplingAnomalyData.length; i++) {
            const item = samplingAnomalyData[i];
            try {
                const statusToSave = getSamplingAnomalyStatus(item);
                console.log(`[采样点异常云端同步] 同步第 ${i+1} 条记录:`);
                console.log(`  - device: ${item.device}, tag: ${item.tag}`);
                console.log(`  - 原始 completion_status: ${item.completion_status}`);
                console.log(`  - 原始 completionStatus: ${item.completionStatus}`);
                console.log(`  - 将保存的状态: ${statusToSave}`);
                
                const mappedData = {
                    id: item.id || `sa_${Date.now()}_${i}`,
                    device: item.device || '',
                    tag: item.tag || '',
                    sample_name: item.sample_name || item.sampleName || '',
                    problem_desc: item.problem_desc || item.problemDesc || '',
                    report_time: item.report_time || item.reportTime || '',
                    reporter: item.reporter || '',
                    rectifier: item.rectifier || '',
                    completion_status: statusToSave,
                    completion_note: item.completion_note || item.completionNote || '',
                    confirmer: item.confirmer || '',
                    remark: item.remark || '',
                    created_at: item.created_at || new Date().toISOString(),
                    updated_at: item.updated_at || new Date().toISOString(),
                    _sync_version: item._sync_version || 1,
                    _user_id: item._user_id || '',
                    // jsonb 字段直接使用数组，不需要 JSON.stringify
                    status_history: item.status_history || item.statusHistory || [],
                    completion_records: item.completion_records || item.completionRecords || [],
                    reject_records: item.reject_records || item.rejectRecords || [],
                    escalate_records: item.escalate_records || item.escalateRecords || [],
                    confirm_records: item.confirm_records || item.confirmRecords || [],
                    protected: item.protected || false,
                    processing_report: item.processing_report || item.processingReport || '',
                    confirmed_by_leader: item.confirmed_by_leader || item.confirmedByLeader || ''
                };

                console.log(`[采样点异常云端同步] 同步第 ${i+1} 条记录: ${item.device} - ${item.tag}，状态: ${statusToSave}`);
                // 使用 UPSERT：存在则更新，不存在则插入
                await supabaseRequest('POST', tableName, mappedData, {
                    on_conflict: 'id',
                    upsert: 'true'
                });
                successCount++;
            } catch (error) {
                console.error(`[采样点异常云端同步] 同步第 ${i+1} 条记录失败:`, error, item);
            }
        }

        if (typeof commitAllPendingAuditLogs === 'function') {
            await commitAllPendingAuditLogs();
        }

        console.log(`[采样点异常云端同步] 同步成功，共 ${successCount}/${samplingAnomalyData.length} 条`);
        return true;
    } catch (error) {
        console.error('[采样点异常云端同步] 同步到云端失败', error);
        return false;
    }
}

/**
 * 解析任务时间字段
 * 处理多种时间格式：ISO 格式、本地格式等
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
            // 格式：YYYY/MM/DD HH:mm:ss（本地时间）
            // 使用 Date.UTC 将本地时间转换为 UTC 时间戳，再创建 Date 对象
            const utcTimestamp = Date.UTC(
                parseInt(parts[0]),      // 年
                parseInt(parts[1]) - 1,  // 月（0-11）
                parseInt(parts[2]),       // 日
                parseInt(parts[3]),       // 时（本地时区）
                parseInt(parts[4]),       // 分
                parseInt(parts[5] || 0)   // 秒
            );
            date = new Date(utcTimestamp);
            if (!isNaN(date.getTime())) {
                console.log(`[时间解析] 中文格式 "${timeStr}" -> UTC时间 ${date.toISOString()}`);
                return date;
            }
        }
    }
    
    // 返回默认日期（1970年）
    console.warn(`[时间解析] 无法解析时间字符串: ${timeStr}`);
    return new Date(0);
}

/**
 * 任务模块增量同步函数
 * 与其他模块不同，任务数据采用逐条记录存储的方式
 */
async function syncTaskDataIncrementally(taskData) {
    console.log('[任务增量同步] 开始同步任务数据...');
    console.log('[任务增量同步] 本地任务数量:', taskData.length);
    
    const tableName = supabaseConfig.tables['task'];
    if (!tableName) {
        console.error('[任务增量同步] 未找到任务模块对应的表名');
        return { success: false, message: '未找到任务模块对应的表名' };
    }

    try {
        // 获取云端现有的任务记录
        console.log(`[任务增量同步] 获取云端任务数据，表名: ${tableName}`);
        const cloudResponse = await supabaseRequest('GET', tableName);
        const cloudTasks = cloudResponse || [];
        
        console.log('[任务增量同步] 云端任务数量:', cloudTasks.length);
        console.log('[任务增量同步] 云端任务ID列表:', cloudTasks.map(t => t.id));
        
        // 创建云端任务的ID映射
        const cloudTaskMap = new Map();
        cloudTasks.forEach(task => {
            if (task.id) {
                cloudTaskMap.set(task.id, task);
            }
        });

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let deletedCount = 0;

        // 逐条检查本地任务
        for (const localTask of taskData) {
            if (!localTask.id) {
                skippedCount++;
                continue;
            }

            console.log(`[任务增量同步] 处理任务: ${localTask.id} - ${localTask.title}`);
            const cloudTask = cloudTaskMap.get(localTask.id);

            if (!cloudTask) {
                console.log(`[任务增量同步] 云端不存在，准备新增: ${localTask.id}`);
                console.log(`[任务增量同步] 任务 ${localTask.id} 的 rejectRecords:`, localTask.reject_records);
                console.log(`[任务增量同步] 任务 ${localTask.id} 的 completionRecords:`, localTask.completion_records);
                
                // 强制复制数组数据，防止引用问题
                const rejectRecordsCopy = Array.isArray(localTask.reject_records) 
                    ? JSON.parse(JSON.stringify(localTask.reject_records)) 
                    : [];
                const completionRecordsCopy = Array.isArray(localTask.completion_records) 
                    ? JSON.parse(JSON.stringify(localTask.completion_records)) 
                    : [];
                
                // 云端不存在，添加新记录
                // 包含所有字段，包括打回记录和完成记录
                const newTask = {
                    id: localTask.id,
                    title: localTask.title || '',
                    description: localTask.description || '',
                    assignee: localTask.assignee || '',
                    priority: localTask.priority || 'normal',
                    status: localTask.status || 'pending',
                    progress: localTask.progress || 0,
                    deadline: localTask.deadline || null,
                    notes: localTask.notes || localTask.remark || '',
                    remark: localTask.remark || localTask.notes || '',
                    completion_note: localTask.completion_note || '',
                    reject_records: rejectRecordsCopy,
                    completion_records: completionRecordsCopy,
                    confirm_records: localTask.confirm_records || localTask.confirmRecords || [],
                    created_at: localTask.created_at || new Date().toISOString(),
                    updated_at: localTask.updated_at || new Date().toISOString(),
                    _sync_version: localTask._sync_version || 1
                };
                await supabaseRequest('POST', tableName, newTask);
                addedCount++;
                console.log(`[任务增量同步] 新增任务成功: ${localTask.id}`);
            } else {
                // 云端已存在，检查是否需要更新
                const localUpdated = parseTaskTime(localTask.updated_at || localTask.created_at);
                const cloudUpdated = parseTaskTime(cloudTask.updated_at || cloudTask.created_at || cloudTask.updateTime);

                console.log(`[任务增量同步] 比较任务 ${localTask.id}:`);
                console.log(`  本地更新时间: ${localTask.updated_at} -> ${localUpdated.toISOString()}`);
                console.log(`  云端更新时间: ${cloudTask.updated_at} -> ${cloudUpdated.toISOString()}`);

                // 比较更新时间或版本号
                const localTimeMs = localUpdated.getTime();
                const cloudTimeMs = cloudUpdated.getTime();
                const isLocalNewer = localTimeMs > cloudTimeMs;
                const versionNeedsUpdate = (localTask._sync_version || 0) > (cloudTask._sync_version || 0);
                const needsUpdate = isLocalNewer || versionNeedsUpdate;

                console.log(`[任务增量同步] 时间比较结果:`);
                console.log(`  本地时间戳: ${localTimeMs}`);
                console.log(`  云端时间戳: ${cloudTimeMs}`);
                console.log(`  本地更新更晚: ${isLocalNewer}`);
                console.log(`  版本需要更新: ${versionNeedsUpdate}`);
                console.log(`  最终需要更新: ${needsUpdate}`);

                if (needsUpdate) {
                    console.log(`[任务增量同步] 需要更新任务: ${localTask.id}`);
                    console.log(`[任务增量同步] 任务 ${localTask.id} 的 rejectRecords:`, localTask.reject_records);
                    console.log(`[任务增量同步] 任务 ${localTask.id} 的 completionRecords:`, localTask.completion_records);
                    
                    // 强制复制数组数据，防止引用问题
                    const rejectRecordsCopy = Array.isArray(localTask.reject_records) 
                        ? JSON.parse(JSON.stringify(localTask.reject_records)) 
                        : [];
                    const completionRecordsCopy = Array.isArray(localTask.completion_records) 
                        ? JSON.parse(JSON.stringify(localTask.completion_records)) 
                        : [];
                    
                    // 更新现有记录 - 包含所有字段
                    const updatedTask = {
                        title: localTask.title || '',
                        description: localTask.description || '',
                        assignee: localTask.assignee || '',
                        priority: localTask.priority || 'normal',
                        status: localTask.status || 'pending',
                        progress: localTask.progress || 0,
                        deadline: localTask.deadline || null,
                        notes: localTask.notes || localTask.remark || '',
                        remark: localTask.remark || localTask.notes || '',
                        completion_note: localTask.completion_note || '',
                        reject_records: rejectRecordsCopy,
                        completion_records: completionRecordsCopy,
                        confirm_records: localTask.confirm_records || localTask.confirmRecords || [],
                        updated_at: new Date().toISOString(),
                        _sync_version: (localTask._sync_version || 0) + 1
                    };
                    await supabaseRequest('PATCH', tableName, updatedTask, { id: `eq.${localTask.id}` });
                    updatedCount++;
                    console.log(`[任务增量同步] 更新任务成功: ${localTask.id}`);
                } else {
                    skippedCount++;
                    console.log(`[任务增量同步] 跳过任务（无需更新）: ${localTask.id}`);
                }
            }
        }

        // 检查云端有但本地没有的任务，删除它们
        console.log(`[任务增量同步] 检查需要删除的云端任务...`);
        const localTaskIds = new Set(taskData.filter(t => t.id).map(t => t.id));
        
        for (const cloudTask of cloudTasks) {
            if (!localTaskIds.has(cloudTask.id)) {
                console.log(`[任务增量同步] 云端存在但本地没有，准备删除: ${cloudTask.id}`);
                try {
                    await supabaseRequest('DELETE', tableName, null, { id: `eq.${cloudTask.id}` });
                    deletedCount++;
                    console.log(`[任务增量同步] 删除任务成功: ${cloudTask.id}`);
                } catch (deleteError) {
                    console.error(`[任务增量同步] 删除任务失败: ${cloudTask.id}`, deleteError);
                }
            }
        }

        console.log(`[任务增量同步] 完成: 新增 ${addedCount} 条, 更新 ${updatedCount} 条, 删除 ${deletedCount} 条, 跳过 ${skippedCount} 条`);
        return { 
            success: true, 
            message: `同步完成: 新增 ${addedCount} 条, 更新 ${updatedCount} 条, 删除 ${deletedCount} 条`,
            added: addedCount,
            updated: updatedCount,
            deleted: deletedCount,
            skipped: skippedCount
        };

    } catch (error) {
        console.error('[任务增量同步] 失败:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 单条任务记录同步
 */
async function syncSingleTaskToCloud(task) {
    console.log(`[单任务同步] 同步任务: ${task.id}`);
    
    const tableName = supabaseConfig.tables['task'];
    if (!tableName) {
        console.error('[单任务同步] 未找到任务模块对应的表名');
        return { success: false, message: '未找到任务模块对应的表名' };
    }

    try {
        const cloudResponse = await supabaseRequest('GET', tableName, null, { id: `eq.${task.id}` });
        const existingTask = cloudResponse && cloudResponse.length > 0 ? cloudResponse[0] : null;

        const taskWithTimestamps = {
            ...task,
            _sync_version: (task._sync_version || 0) + 1,
            _last_modified: new Date().toISOString()
        };

        if (existingTask) {
            // 更新现有记录
            await supabaseRequest('PATCH', tableName, {
                ...taskWithTimestamps,
                updated_at: new Date().toISOString()
            }, { id: `eq.${task.id}` });
            console.log(`[单任务同步] 更新成功: ${task.id}`);
            return { success: true, operation: 'update' };
        } else {
            // 创建新记录
            await supabaseRequest('POST', tableName, {
                ...taskWithTimestamps,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            console.log(`[单任务同步] 创建成功: ${task.id}`);
            return { success: true, operation: 'create' };
        }
    } catch (error) {
        console.error('[单任务同步] 失败:', error);
        return { success: false, message: error.message };
    }
}

if (typeof window !== 'undefined') {
    window.cloudSyncAllData = cloudSyncAllData;
    window.syncModuleDataToCloud = syncModuleDataToCloud;
    window.syncModuleChangesToCloud = syncModuleChangesToCloud;
    window.syncSingleModule = syncSingleModule;
    window.syncTableData = syncTableData;
    window.getDatabaseStorageSize = getDatabaseStorageSize;
    window.getSupabaseBandwidthUsage = getSupabaseBandwidthUsage;
    window.syncTaskDataIncrementally = syncTaskDataIncrementally;
    window.syncSingleTaskToCloud = syncSingleTaskToCloud;
}

// 从 Supabase 获取真实的数据库存储大小（单位：MB）
async function getDatabaseStorageSize() {
    try {
        let totalBytes = 0;
        
        // 1. 获取数据库表大小（通过 pg_stat_user_tables）
        try {
            const dbResponse = await fetch(`${supabaseConfig.url}/rest/v1/rpc/get_database_size`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseConfig.key,
                    'Authorization': `Bearer ${supabaseConfig.key}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (dbResponse.ok) {
                const result = await dbResponse.json();
                if (result && result.length > 0) {
                    totalBytes += result[0].total_bytes || 0;
                    console.log(`[存储统计] 数据库表大小: ${(result[0].total_bytes / (1024 * 1024)).toFixed(2)} MB`);
                }
            }
        } catch (e) {
            console.warn('[存储统计] RPC 函数未配置，跳过数据库表统计:', e.message);
        }
        
        // 2. 获取存储桶大小
        const storageResponse = await fetch(`${supabaseConfig.url}/api/storage/v1/buckets`, {
            method: 'GET',
            headers: {
                'apikey': supabaseConfig.key,
                'Authorization': `Bearer ${supabaseConfig.key}`
            }
        });
        
        if (storageResponse.ok) {
            const buckets = await storageResponse.json();
            for (const bucket of buckets) {
                if (bucket.size) {
                    totalBytes += bucket.size;
                }
            }
        }
        
        // 转换为 MB
        const totalMB = totalBytes / (1024 * 1024);
        console.log(`[存储统计] Supabase 总存储: ${totalMB.toFixed(2)} MB`);
        return totalMB;
    } catch (error) {
        console.error('[存储统计] 获取存储大小失败:', error.message);
        return null;
    }
}

// 从 Supabase 获取真实的带宽使用数据（单位：KB）
async function getSupabaseBandwidthUsage() {
    try {
        // 获取当前月份的开始和结束日期
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // 构建查询参数
        const params = new URLSearchParams({
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
        });
        
        // 尝试多个可能的 API 端点
        const endpoints = [
            `${supabaseConfig.url}/api/v1/billing/usage?${params}`,
            `${supabaseConfig.url}/rest/v1/_/usage?${params}`,
            `${supabaseConfig.url}/v1/billing/usage?${params}`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'apikey': supabaseConfig.serviceRoleKey,
                        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`
                    }
                });
                
                if (!response.ok) {
                    console.log(`[带宽统计] 端点 ${endpoint} 返回状态: ${response.status}`);
                    continue;
                }
                
                const usage = await response.json();
                
                // 处理各种可能的响应格式
                let totalBytes = 0;
                if (usage && usage.bandwidth && usage.bandwidth.total) {
                    totalBytes = usage.bandwidth.total;
                } else if (usage && typeof usage === 'object') {
                    // 尝试其他可能的字段
                    totalBytes = usage.total_bytes || usage.bytes || usage.bandwidth;
                }
                
                if (totalBytes > 0) {
                    const bandwidthKB = totalBytes / 1024;
                    console.log(`[带宽统计] 从 Supabase 获取带宽使用: ${bandwidthKB.toFixed(2)} KB`);
                    return bandwidthKB;
                }
            } catch (e) {
                console.log(`[带宽统计] 端点 ${endpoint} 请求失败: ${e.message}`);
            }
        }
        
        console.log('[带宽统计] 所有 Supabase 端点都无法获取带宽数据');
        return null;
    } catch (error) {
        console.error('[带宽统计] 获取带宽使用失败:', error.message);
        return null;
    }
}