const express = require('express');
const cors = require('cors');
const path = require('path');
const net = require('net');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// ==================== SQLite 本地数据库 ====================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(path.join(DATA_DIR, 'system.db'));

db.serialize(function() {
    db.run(`CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        real_name TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        module TEXT,
        action TEXT,
        target_id TEXT,
        target_desc TEXT,
        username TEXT,
        timestamp TEXT DEFAULT (datetime('now','localtime'))
    )`);

    db.get('SELECT id FROM users WHERE username = ?', ['lil7020'], function(err, row) {
        if (!row) {
            db.run('INSERT INTO users (id, username, password, real_name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin_' + Date.now(), 'lil7020', 'lil7020', '系统管理员', 'topadmin', 'active']);
        }
    });
});

// ==================== Storage API（通用JSON键值存储） ====================

app.get('/api/storage', function(req, res) {
    db.all('SELECT key, value, updated_at FROM storage', [], function(err, rows) {
        if (err) return res.status(500).json({ error: err.message });
        var result = {};
        rows.forEach(function(row) {
            try { result[row.key] = JSON.parse(row.value); }
            catch { result[row.key] = row.value; }
        });
        res.json({ success: true, data: result });
    });
});

app.get('/api/storage/:key', function(req, res) {
    db.get('SELECT value, updated_at FROM storage WHERE key = ?', [req.params.key], function(err, row) {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.json({ success: true, data: null });
        try {
            res.json({ success: true, data: JSON.parse(row.value), updated_at: row.updated_at });
        } catch {
            res.json({ success: true, data: row.value, updated_at: row.updated_at });
        }
    });
});

app.post('/api/storage/:key', function(req, res) {
    var value = JSON.stringify(req.body);
    var now = new Date().toISOString();
    db.run('INSERT OR REPLACE INTO storage (key, value, updated_at) VALUES (?, ?, ?)',
        [req.params.key, value, now], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, updated_at: now });
    });
});

app.delete('/api/storage/:key', function(req, res) {
    db.run('DELETE FROM storage WHERE key = ?', [req.params.key], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/storage/import', function(req, res) {
    var data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: '数据格式错误' });
    }
    var now = new Date().toISOString();
    var keys = Object.keys(data);
    var completed = 0;

    db.serialize(function() {
        db.run('BEGIN TRANSACTION');
        keys.forEach(function(key) {
            db.run('INSERT OR REPLACE INTO storage (key, value, updated_at) VALUES (?, ?, ?)',
                [key, JSON.stringify(data[key]), now], function(err) {
                if (!err) completed++;
            });
        });
        db.run('COMMIT', function() {
            res.json({ success: true, count: completed });
        });
    });
});

// ==================== 用户管理 API ====================

app.get('/api/users', function(req, res) {
    db.all('SELECT id, username, real_name, role, status, created_at FROM users ORDER BY username', [], function(err, rows) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/users', function(req, res) {
    var user = req.body;
    if (!user.username || !user.password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    var id = user.id || 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    db.run('INSERT INTO users (id, username, password, real_name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, user.username, user.password, user.real_name || '', user.role || 'user', user.status || 'active'],
        function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(409).json({ error: '用户名已存在' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: id });
    });
});

app.put('/api/users/:id', function(req, res) {
    var user = req.body;
    var fields = [];
    var values = [];
    if (user.password !== undefined) { fields.push('password = ?'); values.push(user.password); }
    if (user.real_name !== undefined) { fields.push('real_name = ?'); values.push(user.real_name); }
    if (user.role !== undefined) { fields.push('role = ?'); values.push(user.role); }
    if (user.status !== undefined) { fields.push('status = ?'); values.push(user.status); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    values.push(req.params.id);
    db.run('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', values, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/users/:id', function(req, res) {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

// ==================== 认证 API ====================

app.post('/api/auth/login', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    db.get('SELECT * FROM users WHERE username = ?', [username], function(err, user) {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.json({ success: false, message: '用户不存在' });
        if (user.password !== password) return res.json({ success: false, message: '密码错误' });
        if (user.status !== 'active') return res.json({ success: false, message: '账号已禁用' });
        res.json({
            success: true,
            user: { id: user.id, username: user.username, real_name: user.real_name, role: user.role, status: user.status }
        });
    });
});

// ==================== 审计日志 API ====================

app.get('/api/audit-logs', function(req, res) {
    var limit = parseInt(req.query.limit) || 200;
    var offset = parseInt(req.query.offset) || 0;
    db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?', [limit, offset], function(err, rows) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.post('/api/audit-logs', function(req, res) {
    var log = req.body;
    var id = log.id || 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    db.run('INSERT INTO audit_logs (id, module, action, target_id, target_desc, username, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, log.module || '', log.action || '', log.target_id || '', log.target_desc || '', log.username || '', log.timestamp || new Date().toISOString()],
        function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: id });
    });
});

// ==================== 健康检查 ====================

app.get('/api/health', function(req, res) {
    res.json({ success: true, message: '服务器运行正常', database: 'SQLite' });
});

// ==================== 静态文件服务 ====================

app.get('*', function(req, res) {
    if (req.path.startsWith('/api/')) return;
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== 端口查找与启动 ====================

function isPortAvailable(port) {
    return new Promise(function(resolve) {
        var server = net.createServer();
        server.once('error', function() { resolve(false); });
        server.once('listening', function() { server.close(); resolve(true); });
        server.listen(port);
    });
}

async function startServer() {
    var port = 8080;

    while (!(await isPortAvailable(port))) {
        console.log('端口 ' + port + ' 被占用，尝试端口 ' + (port + 1) + '...');
        port++;
        if (port > 9000) {
            console.error('找不到可用端口！');
            process.exit(1);
        }
    }

    app.listen(port, function() {
        console.log('========================================');
        console.log('  甲醇作业区人员信息管理系统');
        console.log('  [SQLite 本地数据库已启动]');
        console.log('========================================');
        console.log('');
        console.log('服务器启动成功！');
        console.log('');
        console.log('访问地址：');
        console.log('  http://localhost:' + port);
        console.log('');
        console.log('数据文件：data/system.db');
        console.log('========================================');
        console.log('提示：保持此窗口打开，关闭后无法访问系统');
        console.log('按 Ctrl+C 停止服务器');
        console.log('========================================');
    });
}

startServer();
