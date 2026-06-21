/**
 * SQLite 本地数据库同步层
 * 桥接浏览器 localStorage <-> 后端 SQLite
 *
 * 1. 启动时从 SQLite 加载数据到 localStorage
 * 2. 拦截 localStorage.setItem，同时写入 SQLite
 * 3. localStorage 作为读写缓存，SQLite 作为持久化存储
 */

var SQLITE_SYNC_KEYS = [
    'personnelData', 'trainingData', 'teamPersonnelData', 'teamPersonnelVersionHistory',
    'centerInspectionData', 'workshopInspectionData', 'honorData',
    'violationDisciplineLedger', 'teamCompetitionLedger',
    'samplingCarData', 'instrumentData',
    'hazardData', 'taskData', 'samplingAnomalyData',
    'systemUsers', 'currentUser', 'auditLogData'
];

var sqliteInitialized = false;
var sqliteSaveTimers = {};

function sqliteApiGet(path) {
    return fetch(path, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
}

function sqliteApiPost(path, data) {
    return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
}

function loadFromSqlite() {
    console.log('[SQLite] 正在从数据库加载数据...');
    return sqliteApiGet('/api/storage').then(function(result) {
        if (!result || !result.success || !result.data) {
            console.log('[SQLite] 数据库为空或无数据，将进行初始迁移');
            return migrateToSqlite();
        }
        var cloudData = result.data;
        var loadedCount = 0;

        SQLITE_SYNC_KEYS.forEach(function(key) {
            if (cloudData[key] !== undefined && cloudData[key] !== null) {
                try {
                    var existing = localStorage.getItem(key);
                    if (!existing || existing === 'null' || existing === 'undefined') {
                        localStorage.setItem(key, JSON.stringify(cloudData[key]));
                        loadedCount++;
                    }
                } catch (e) {
                    console.warn('[SQLite] 载入 ' + key + ' 失败:', e);
                }
            }
        });

        console.log('[SQLite] 从数据库加载了 ' + loadedCount + ' 个模块的数据');
        sqliteInitialized = true;
        hookLocalStorage();
        migrateToSqlite();
        return true;
    });
}

function migrateToSqlite() {
    var data = {};
    var count = 0;
    SQLITE_SYNC_KEYS.forEach(function(key) {
        try {
            var value = localStorage.getItem(key);
            if (value && value !== 'null' && value !== 'undefined') {
                data[key] = JSON.parse(value);
                count++;
            }
        } catch (e) {}
    });
    if (count === 0) return Promise.resolve(false);
    console.log('[SQLite] 正在迁移 ' + count + ' 个模块数据到数据库...');
    return sqliteApiPost('/api/storage/import', data).then(function(result) {
        if (result && result.success) {
            console.log('[SQLite] 迁移完成：' + result.count + ' 个键已保存');
        }
        return true;
    });
}

function saveKeyToSqlite(key) {
    if (sqliteSaveTimers[key]) {
        clearTimeout(sqliteSaveTimers[key]);
    }
    sqliteSaveTimers[key] = setTimeout(function() {
        try {
            var value = localStorage.getItem(key);
            if (value && value !== 'null' && value !== 'undefined') {
                var parsed;
                try { parsed = JSON.parse(value); } catch (e) { parsed = value; }
                sqliteApiPost('/api/storage/' + encodeURIComponent(key), parsed);
            }
        } catch (e) {
            console.warn('[SQLite] 保存 ' + key + ' 失败:', e);
        }
        delete sqliteSaveTimers[key];
    }, 500);
}

var originalSetItem = localStorage.setItem.bind(localStorage);

function hookLocalStorage() {
    localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (SQLITE_SYNC_KEYS.indexOf(key) !== -1) {
            saveKeyToSqlite(key);
        }
    };
    console.log('[SQLite] localStorage 拦截已启用');
}

(function init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(loadFromSqlite, 100);
        });
    } else {
        setTimeout(loadFromSqlite, 100);
    }
    console.log('[SQLite] 同步层已加载');
})();
