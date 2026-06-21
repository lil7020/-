// incremental-sync.js
// 增量同步工具 - 带宽优化方案

// 使用 cloud-sync.js 中定义的 supabaseConfig

const incrementalConfig = {
    cacheExpireMinutes: 60,  // 缓存最大有效期1小时
    syncIntervalMinutes: 5,
    maxRetries: 3,
    debounceDelay: 2000
};

const moduleSyncConfig = {
    personnel: {
        loginSync: true,
        firstEntrySync: true,
        cacheEnabled: true
    },
    teamPersonnel: {
        loginSync: true,
        firstEntrySync: true,
        cacheEnabled: true
    },
    training: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    inspection: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    centerInspection: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    workshopInspection: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    honor: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    patrol: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    samplingCar: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    instrument: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    },
    team: {
        loginSync: false,
        firstEntrySync: true,
        cacheEnabled: true
    }
};

function getModuleConfig(moduleKey) {
    const configs = {
        personnel: { key: 'personnel', storageKey: 'personnelData', arrayRef: 'allPersonnelData', isObject: false },
        teamPersonnel: { key: 'teamPersonnel', storageKey: 'teamPersonnelData', arrayRef: 'currentTeamPersonnelData', isObject: true },
        training: { key: 'training', storageKey: 'trainingData', arrayRef: 'allTrainingData', isObject: false },
        inspection: { key: 'inspection', storageKey: 'inspectionData', arrayRef: 'centerInspectionData', isObject: false },
        centerInspection: { key: 'centerInspection', storageKey: 'centerInspectionData', arrayRef: 'centerInspectionData', isObject: false },
        workshopInspection: { key: 'workshopInspection', storageKey: 'workshopInspectionData', arrayRef: 'workshopInspectionData', isObject: false },
        honor: { key: 'honor', storageKey: 'honorData', arrayRef: 'honorData', isObject: false },
        patrol: { key: 'patrol', storageKey: 'violationDisciplineLedger', arrayRef: null, isObject: true },
        samplingCar: { key: 'samplingCar', storageKey: 'samplingCarData', arrayRef: 'samplingCarData', isObject: true },
        instrument: { key: 'instrument', storageKey: 'instrumentData', arrayRef: 'instrumentData', isObject: true },
        team: { key: 'team', storageKey: 'teamCompetitionLedger', arrayRef: null, isObject: true }
    };
    return configs[moduleKey];
}

function getCacheStatus(moduleKey) {
    const lastSync = localStorage.getItem(`lastSync_${moduleKey}`);
    if (!lastSync) {
        return { hasCache: false, isFresh: false };
    }
    const syncTime = new Date(lastSync);
    const now = new Date();
    const minutesSinceSync = (now - syncTime) / (1000 * 60);
    return {
        hasCache: true,
        isFresh: minutesSinceSync < incrementalConfig.cacheExpireMinutes,
        lastSyncTime: syncTime
    };
}

async function fetchCloudMetadata(moduleKey) {
    const config = window.supabaseConfig;
    if (!config) {
        console.warn('supabaseConfig 未找到');
        return null;
    }
    
    const tableName = config.tables[moduleKey];
    if (!tableName) {
        console.warn(`未找到模块 ${moduleKey} 的表名映射`);
        return null;
    }
    try {
        const url = new URL(`${config.url}/rest/v1/${tableName}`);
        url.searchParams.append('select', 'id,created_at,updated_at');
        url.searchParams.append('order', 'updated_at.desc');
        url.searchParams.append('limit', '1');
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': config.key,
                'Authorization': `Bearer ${config.key}`
            }
        });
        if (!response.ok) {
            console.error(`获取 ${moduleKey} 元数据失败: HTTP ${response.status}`);
            return null;
        }
        const data = await response.json();
        if (!data || data.length === 0) return null;
        return {
            updatedAt: data[0].updated_at || data[0].created_at,
            recordCount: data.length,
            etag: response.headers.get('etag')
        };
    } catch (error) {
        console.error(`获取 ${moduleKey} 元数据失败:`, error);
        return null;
    }
}

function loadFromLocalStorage(storageKey, arrayRef, isObject) {
    const data = JSON.parse(localStorage.getItem(storageKey) || (isObject ? '{}' : '[]'));
    if (arrayRef && typeof window[arrayRef] !== 'undefined') {
        window[arrayRef] = data;
    }
    return data;
}

function updateSyncTimestamp(moduleKey) {
    const now = new Date().toISOString();
    localStorage.setItem(`lastSync_${moduleKey}`, now);
}

function generateKey(obj) {
    if (!obj) return null;
    const keys = Object.keys(obj).sort();
    return keys.map(k => `${k}:${obj[k]}`).join('|');
}

async function mergeIncrementalData(moduleKey, storageKey, updates, isObject) {
    const localData = JSON.parse(localStorage.getItem(storageKey) || (isObject ? '{}' : '[]'));
    if (isObject) {
        const result = { ...localData };
        updates.forEach(update => {
            if (update.data) {
                const updateData = typeof update.data === 'string' ? JSON.parse(update.data) : update.data;
                Object.assign(result, updateData);
            }
        });
        return result;
    }
    const result = [...localData];
    const idMap = new Map();
    result.forEach(item => {
        const id = item.id || item.personnelId || item.idCardNumber || generateKey(item);
        if (id) idMap.set(id, item);
    });
    updates.forEach(update => {
        const updateData = typeof update.data === 'string' ? JSON.parse(update.data) : update.data;
        if (Array.isArray(updateData)) {
            updateData.forEach(item => {
                const id = item.id || item.personnelId || item.idCardNumber || generateKey(item);
                if (id) idMap.set(id, item);
            });
        } else if (updateData) {
            const id = updateData.id || updateData.personnelId || updateData.idCardNumber || generateKey(updateData);
            if (id) idMap.set(id, updateData);
        }
    });
    return Array.from(idMap.values());
}

async function performIncrementalSync(moduleKey, tableName, storageKey, arrayRef, isObject, cloudMeta) {
    console.log(`${moduleKey} 执行全量同步（简化版）`);
    const config = window.supabaseConfig;
    if (!config) {
        console.warn('supabaseConfig 未找到');
        return { success: false, changes: 0 };
    }
    
    const url = new URL(`${config.url}/rest/v1/${tableName}`);
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'apikey': config.key,
                'Authorization': `Bearer ${config.key}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        const contentLength = text.length * 2;
        
        recordBandwidthUsage(contentLength, 'download');
        
        const data = JSON.parse(text);
        
        let finalData;
        if (Array.isArray(data) && data.length > 0) {
            if (data[0].data) {
                finalData = data.map(item => {
                    if (typeof item.data === 'string') {
                        return JSON.parse(item.data);
                    }
                    return item.data;
                });
            } else {
                finalData = data;
            }
        } else {
            finalData = data;
        }
        
        if (Array.isArray(finalData)) {
            localStorage.setItem(storageKey, JSON.stringify(finalData));
        } else if (isObject && finalData) {
            localStorage.setItem(storageKey, JSON.stringify(finalData));
        }
        
        if (arrayRef && typeof window[arrayRef] !== 'undefined') {
            window[arrayRef] = Array.isArray(finalData) ? finalData : [];
        }
        
        updateSyncTimestamp(moduleKey);
        console.log(`${moduleKey} 同步完成，共 ${finalData?.length || 0} 条，消耗带宽: ${(contentLength / 1024).toFixed(2)} KB`);
        
        return { 
            success: true, 
            changes: finalData?.length || 0, 
            direction: 'download',
            bandwidthBytes: contentLength
        };
    } catch (error) {
        console.error(`${moduleKey} 同步失败:`, error);
        throw error;
    }
}

async function syncModuleWithTimestamp(moduleKey, storageKey, arrayRef, isObject = false) {
    const config = window.supabaseConfig;
    if (!config) {
        console.warn('supabaseConfig 未找到');
        loadFromLocalStorage(storageKey, arrayRef, isObject);
        return { success: false, changes: 0 };
    }
    
    const tableName = config.tables[moduleKey];
    const cloudMeta = await fetchCloudMetadata(moduleKey);
    if (!cloudMeta) {
        loadFromLocalStorage(storageKey, arrayRef, isObject);
        return { success: true, changes: 0 };
    }
    const lastSync = localStorage.getItem(`lastSync_${moduleKey}`);
    if (lastSync) {
        const cloudTime = new Date(cloudMeta.updatedAt);
        const localTime = new Date(lastSync);
        if (cloudTime <= localTime) {
            loadFromLocalStorage(storageKey, arrayRef, isObject);
            return { success: true, changes: 0, direction: 'cache' };
        }
    }
    return await performIncrementalSync(moduleKey, tableName, storageKey, arrayRef, isObject, cloudMeta);
}

async function safeSyncModule(moduleKey, storageKey, arrayRef, isObject) {
    try {
        const result = await syncModuleWithTimestamp(moduleKey, storageKey, arrayRef, isObject);
        if (!result.success) {
            console.log(`${moduleKey} 增量同步失败，尝试全量同步`);
            await syncModuleFromCloud(moduleKey, storageKey, arrayRef, isObject);
        }
        return true;
    } catch (error) {
        console.log(`${moduleKey} 同步失败，使用本地数据:`, error.message);
        loadFromLocalStorage(storageKey, arrayRef, isObject);
        return false;
    }
}

async function syncCoreDataOnLogin() {
    console.log('登录后同步核心数据...');
    const results = {
        personnel: false,
        teamPersonnel: false
    };
    try {
        const config = getModuleConfig('personnel');
        if (config) {
            await syncModuleFromCloud('personnel', config.storageKey, config.arrayRef, config.isObject);
            results.personnel = true;
            console.log('人员信息同步完成');
        }
    } catch (e) {
        console.log('人员信息同步失败:', e);
    }
    try {
        const config = getModuleConfig('teamPersonnel');
        if (config) {
            await syncModuleFromCloud('teamPersonnel', config.storageKey, config.arrayRef, config.isObject);
            results.teamPersonnel = true;
            console.log('班组人员同步完成');
        }
    } catch (e) {
        console.log('班组人员同步失败:', e);
    }
    console.log('核心数据同步结果:', results);
    return results;
}

// 清理所有刷新按钮
function clearAllRefreshButtons() {
    const allBtns = document.querySelectorAll('[id^="refreshBtn_"]');
    console.log(`[刷新按钮] 清理所有刷新按钮，共 ${allBtns.length} 个`);
    allBtns.forEach(btn => {
        btn.remove();
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: fadeInUp 0.3s ease;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    if (!document.getElementById('toast-styles')) {
        style.id = 'toast-styles';
        document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// incremental-sync.js 中的 addModuleRefreshButton 已移除，使用 script.js 中的版本

// 备用方案：添加浮动刷新按钮
function addFloatingRefreshButton(button) {
    const floatingDiv = document.createElement('div');
    floatingDiv.id = 'floatingRefreshContainer';
    floatingDiv.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
    `;
    button.style.cssText += `
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        padding: 12px 20px;
        border-radius: 8px;
    `;
    floatingDiv.appendChild(button);
    document.body.appendChild(floatingDiv);
    console.log('[刷新按钮] 已添加为浮动按钮');
}

// 添加全局浮动刷新按钮（总是可见）
function addGlobalFloatingRefreshButton() {
    if (document.getElementById('globalFloatingRefreshBtn')) {
        return;
    }
    
    const floatingDiv = document.createElement('div');
    floatingDiv.id = 'globalFloatingRefreshDiv';
    floatingDiv.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        z-index: 9998;
        background: #10b981;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(16,185,129,0.4);
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    `;
    
    floatingDiv.innerHTML = '<span style="font-size: 28px;">🔄</span>';
    floatingDiv.title = '点击刷新当前页面数据';
    
    floatingDiv.onmouseover = () => {
        floatingDiv.style.transform = 'scale(1.1)';
        floatingDiv.style.boxShadow = '0 6px 20px rgba(16,185,129,0.6)';
    };
    
    floatingDiv.onmouseout = () => {
        floatingDiv.style.transform = 'scale(1)';
        floatingDiv.style.boxShadow = '0 4px 15px rgba(16,185,129,0.4)';
    };
    
    floatingDiv.onclick = () => {
        // 获取当前显示的页面
        const pages = ['personnelPage', 'trainingPage', 'teamPage', 'teamPersonnelPage', 
                      'inspectionPage', 'honorPage', 'patrolPage', 'samplingCarPage', 
                      'instrumentPage'];
        
        let currentModule = null;
        for (const page of pages) {
            const el = document.getElementById(page);
            if (el && el.style.display !== 'none') {
                currentModule = page.replace('Page', '');
                break;
            }
        }
        
        if (currentModule) {
            showToast(`🔄 正在刷新 ${getModuleChineseName(currentModule)}...`);
            // 触发对应模块的刷新
            const moduleKeyMap = {
                'personnel': 'personnel',
                'training': 'training',
                'team': 'team',
                'teamPersonnel': 'teamPersonnel',
                'inspection': 'inspection',
                'honor': 'honor',
                'patrol': 'patrol',
                'samplingCar': 'samplingCar',
                'instrument': 'instrument'
            };
            
            const moduleKey = moduleKeyMap[currentModule];
            if (moduleKey && typeof addModuleRefreshButton === 'function') {
                // 点击按钮
                const btn = document.getElementById(`refreshBtn_${moduleKey}`);
                if (btn) {
                    btn.click();
                } else {
                    showToast('⚠️ 请先进入具体模块页面');
                }
            }
        } else {
            showToast('⚠️ 请先进入具体模块页面');
        }
    };
    
    document.body.appendChild(floatingDiv);
    console.log('[刷新按钮] 已添加全局浮动刷新按钮');
}

// 获取模块中文名称
function getModuleChineseName(key) {
    const names = {
        'personnel': '人员信息管理',
        'training': '副班培训成绩',
        'team': '红旗班组名次',
        'teamPersonnel': '班组人员管理',
        'inspection': '检查问题台账',
        'honor': '获得荣誉台账',
        'patrol': '违章违纪台账',
        'samplingCar': '采样车维修台账',
        'instrument': '仪器维修台账'
    };
    return names[key] || key;
}

function renderModulePage(moduleKey) {
    switch (moduleKey) {
        case 'personnel':
            if (typeof renderPersonnelTable === 'function') renderPersonnelTable();
            if (typeof renderPersonnelPagination === 'function') renderPersonnelPagination();
            break;
        case 'training':
            if (typeof renderTrainingTable === 'function') renderTrainingTable();
            break;
        case 'inspection':
            if (typeof renderInspectionTable === 'function') renderInspectionTable();
            break;
        case 'teamPersonnel':
            if (typeof renderTeamPersonnelTable === 'function') renderTeamPersonnelTable();
            break;
        case 'honor':
            if (typeof renderHonorTable === 'function') renderHonorTable();
            break;
        default:
            location.reload();
    }
}

// window 导出 - 移到文件末尾，在所有函数定义之后
// if (typeof window !== 'undefined') {
//     window.syncModuleWithTimestamp = syncModuleWithTimestamp;
//     window.syncCoreDataOnLogin = syncCoreDataOnLogin;
//     window.safeSyncModule = safeSyncModule;
//     window.loadFromLocalStorage = loadFromLocalStorage;
//     window.updateSyncTimestamp = updateSyncTimestamp;
//     window.getModuleConfig = getModuleConfig;
//     window.addModuleRefreshButton = addModuleRefreshButton;
//     window.clearAllRefreshButtons = clearAllRefreshButtons;
//     window.showToast = showToast;
//     window.getCacheStatus = getCacheStatus;
//     window.getCurrentPeriod = getCurrentPeriod;
//     window.recordBandwidthUsage = recordBandwidthUsage;
//     window.getBandwidthUsage = getBandwidthUsage;
//     window.getBandwidthUsageDetail = getBandwidthUsageDetail;
//     window.getUsageWarningLevel = getUsageWarningLevel;
//     window.getWarningColor = getWarningColor;
//     window.updateBottomBarStats = updateBottomBarStats;
//     window.addBottomStatsBar = addBottomStatsBar;
//     window.initBottomStatsBarOnNav = initBottomStatsBarOnNav;
// }

// addBottomStatsBar 已移除，使用 script.js 中的版本

function updateBottomBarStats() {
    const storageSize = calculateLocalStorageSize();
    const bandwidthDetail = getBandwidthUsageDetail();
    const bandwidthUsage = bandwidthDetail ? bandwidthDetail.totalKB : getBandwidthUsage();
    
    const storageEl = document.getElementById('storageStatsValue');
    const bandwidthEl = document.getElementById('bandwidthStatsValue');
    const periodEl = document.getElementById('bandwidthPeriod');
    
    const storageLevel = getUsageWarningLevel(storageSize, 'storage');
    const bandwidthLevel = getUsageWarningLevel(bandwidthUsage, 'bandwidth');
    
    const storageColor = getWarningColor(storageLevel);
    const bandwidthColor = getWarningColor(bandwidthLevel);
    
    if (storageEl) {
        storageEl.textContent = `${storageSize} MB`;
        storageEl.style.color = storageColor;
        
        let warningText = '';
        if (storageLevel === 'danger') warningText = ' ⚠️ 即将超限';
        else if (storageLevel === 'warning') warningText = ' ⚡ 偏高';
        storageEl.title = `本地存储: ${storageSize} MB${warningText}`;
    }
    
    if (bandwidthEl) {
        const displayValue = bandwidthUsage >= 1024 
            ? `${(bandwidthUsage / 1024).toFixed(2)} MB` 
            : `${bandwidthUsage} KB`;
        bandwidthEl.textContent = displayValue;
        bandwidthEl.style.color = bandwidthColor;
        
        let warningText = '';
        if (bandwidthLevel === 'danger') warningText = ' ⚠️ 即将超过120MB限额';
        else if (bandwidthLevel === 'warning') warningText = ' ⚡ 超过50MB';
        bandwidthEl.title = `本月带宽: ${bandwidthUsage} KB${warningText}`;
    }
    
    if (periodEl) {
        const period = getCurrentPeriod();
        periodEl.textContent = `${period.label}`;
    }
}

function calculateLocalStorageSize() {
    try {
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (value) {
                totalSize += value.length * 2;
            }
        }
        const mbSize = (totalSize / (1024 * 1024)).toFixed(2);
        return parseFloat(mbSize);
    } catch (e) {
        return 0;
    }
}

function getCurrentPeriod() {
    const now = new Date();
    let startDate, endDate, key;
    
    if (now.getDate() >= 13) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 13);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 12);
        key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 13);
        endDate = new Date(now.getFullYear(), now.getMonth(), 12);
        key = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    }
    
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        key: key,
        label: `${startDate.getFullYear()}年${startDate.getMonth() + 1}月13日 - ${endDate.getFullYear()}年${endDate.getMonth() + 1}月12日`
    };
}

function recordBandwidthUsage(bytes, operationType) {
    const period = getCurrentPeriod();
    const statsKey = `bandwidthStats_${period.key}`;
    
    const existing = localStorage.getItem(statsKey);
    let data = existing ? JSON.parse(existing) : {
        totalBytes: 0,
        uploadBytes: 0,
        downloadBytes: 0,
        period: period,
        records: []
    };
    
    data.totalBytes += bytes;
    if (operationType === 'upload') {
        data.uploadBytes += bytes;
    } else {
        data.downloadBytes += bytes;
    }
    
    data.records.push({
        timestamp: new Date().toISOString(),
        bytes: bytes,
        type: operationType,
        period: period.key
    });
    
    localStorage.setItem(statsKey, JSON.stringify(data));
}

function getBandwidthUsage() {
    const period = getCurrentPeriod();
    const statsKey = `bandwidthStats_${period.key}`;
    const stats = localStorage.getItem(statsKey);
    
    if (stats) {
        try {
            const data = JSON.parse(stats);
            return Math.round(data.totalBytes / 1024);
        } catch (e) {
            return 0;
        }
    }
    return 0;
}

function getBandwidthUsageDetail() {
    const period = getCurrentPeriod();
    const statsKey = `bandwidthStats_${period.key}`;
    const stats = localStorage.getItem(statsKey);
    
    if (stats) {
        try {
            const data = JSON.parse(stats);
            return {
                totalKB: Math.round(data.totalBytes / 1024),
                uploadKB: Math.round(data.uploadBytes / 1024),
                downloadKB: Math.round(data.downloadBytes / 1024),
                period: period
            };
        } catch (e) {
            return null;
        }
    }
    return null;
}

function getUsageWarningLevel(usageKB, type) {
    const thresholds = {
        bandwidth: {
            warning: 50000,
            danger: 100000,
            limit: 120000
        },
        storage: {
            warning: 50,
            danger: 80,
            limit: 100
        }
    };
    
    const t = thresholds[type];
    if (usageKB >= t.danger) return 'danger';
    if (usageKB >= t.warning) return 'warning';
    return 'normal';
}

function getWarningColor(level) {
    const colors = {
        normal: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
    };
    return colors[level] || colors.normal;
}

// 添加测试日志，确认函数加载成功
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ incremental-sync.js 已加载');
    console.log('✅ addModuleRefreshButton 函数:', typeof addModuleRefreshButton);
    console.log('✅ getModuleConfig 函数:', typeof getModuleConfig);
    console.log('✅ supabaseConfig.tables:', typeof window.supabaseConfig !== 'undefined' ? Object.keys(window.supabaseConfig.tables) : 'undefined');
});

// 在window对象上暴露addBottomStatsBarInit函数，用于在导航页面显示时调用
function initBottomStatsBarOnNav() {
    console.log('========== initBottomStatsBarOnNav 被调用 ==========');
    console.log('addBottomStatsBar 函数存在:', typeof addBottomStatsBar === 'function');
    
    // 延迟添加状态栏，确保在导航页面完全加载后再添加
    setTimeout(() => {
        console.log('========== 开始调用 addBottomStatsBar ==========');
        addBottomStatsBar();
    }, 100);
}

// ========== window 导出 - 所有函数定义之后 ==========
// 注意：以下函数在 script.js 中已有定义，此处不再重复导出
// addModuleRefreshButton, addBottomStatsBar 在 script.js 中定义
if (typeof window !== 'undefined') {
    window.syncModuleWithTimestamp = syncModuleWithTimestamp;
    window.syncCoreDataOnLogin = syncCoreDataOnLogin;
    window.safeSyncModule = safeSyncModule;
    window.loadFromLocalStorage = loadFromLocalStorage;
    window.updateSyncTimestamp = updateSyncTimestamp;
    window.getModuleConfig = getModuleConfig;
    window.clearAllRefreshButtons = clearAllRefreshButtons;
    window.showToast = showToast;
    window.getCacheStatus = getCacheStatus;
    window.getCurrentPeriod = getCurrentPeriod;
    window.recordBandwidthUsage = recordBandwidthUsage;
    window.getBandwidthUsage = getBandwidthUsage;
    window.getBandwidthUsageDetail = getBandwidthUsageDetail;
    window.getUsageWarningLevel = getUsageWarningLevel;
    window.getWarningColor = getWarningColor;
    window.updateBottomBarStats = updateBottomBarStats;
    window.initBottomStatsBarOnNav = initBottomStatsBarOnNav;
}
