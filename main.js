const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');

// 引入 Express 服务器
const express = require('express');
const cors = require('cors');

let mainWindow;
let server = null;
const PORT = 8080;

function startServer() {
    return new Promise((resolve) => {
        const app = express();
        
        app.use(cors());
        app.use(express.json({ limit: '50mb' }));
        app.use(express.static('.'));

        app.get('/api/health', (req, res) => {
            res.json({ success: true, message: '服务器运行正常' });
        });

        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'index-cloud.html'));
        });

        server = app.listen(PORT, () => {
            console.log(`服务器已启动在 http://localhost:${PORT}`);
            resolve();
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: '甲醇作业区人员信息管理系统',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    const startUrl = `http://localhost:${PORT}`;
    mainWindow.loadURL(startUrl);

    Menu.setApplicationMenu(null);

    mainWindow.on('closed', function () {
        mainWindow = null;
        if (server) {
            server.close();
        }
    });
}

async function initApp() {
    console.log('正在启动甲醇作业区人员信息管理系统...');
    
    try {
        await startServer();
        createWindow();
    } catch (error) {
        console.error('启动失败:', error);
        app.quit();
    }
}

app.whenReady().then(initApp);

app.on('window-all-closed', function () {
    if (server) {
        server.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        initApp();
    }
});