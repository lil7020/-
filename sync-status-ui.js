/**
 * 同步状态指示器 - 按设计规范实现
 */

class SyncStatusIndicator {
    constructor() {
        this.element = null;
        this.isInitialized = false;
        this.tooltipVisible = false;
    }
    
    /**
     * 初始化
     */
    init() {
        if (this.isInitialized) return;

        // ✅ 已禁用右上角悬浮同步状态指示器：
        // - 避免悬浮窗遮挡页面内容；
        // - 避免重复显示（底部状态栏已包含同步状态）；
        // 保留函数签名以便其他模块调用 updateStatus / showNotification 时不会崩溃。
        this.isInitialized = true;
        console.log('[同步指示器] 已禁用悬浮显示（仅保留API接口）');
    }
    
    /**
     * 获取HTML
     */
    getHTML() {
        return `
            <div class="sync-status-content">
                <div class="sync-status-icon">
                    <span class="status-indicator"></span>
                </div>
                <div class="sync-status-info">
                    <div class="sync-status-text">同步状态</div>
                    <div class="sync-status-detail">已同步</div>
                </div>
                <div class="sync-status-badge" style="display: none;">0</div>
            </div>
            <div class="sync-status-tooltip" style="display: none;">
                <div class="tooltip-title">🔄 同步详情</div>
                <div class="tooltip-content">
                    <div class="tooltip-section">
                        <div class="section-title">📡 网络状态</div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">连接状态：</span>
                            <span class="tooltip-value network-status synced">在线</span>
                        </div>
                    </div>
                    <div class="tooltip-section">
                        <div class="section-title">⏱️ 同步时间</div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">上次同步：</span>
                            <span class="tooltip-value last-sync-time">刚刚</span>
                        </div>
                    </div>
                    <div class="tooltip-section">
                        <div class="section-title">📊 同步统计</div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">待同步：</span>
                            <span class="tooltip-value pending-count">0</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">同步失败：</span>
                            <span class="tooltip-value failed-count">0</span>
                        </div>
                    </div>
                    <div class="tooltip-section">
                        <div class="section-title">💡 提示</div>
                        <div class="tooltip-tip">• 数据操作后会自动增量同步到云端</div>
                        <div class="tooltip-tip">• 离线时数据暂存本地，联网后自动同步</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 添加样式
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .sync-status-indicator {
                position: fixed;
                top: 100px;
                right: 20px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .sync-status-content {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: white;
                border-radius: 20px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                cursor: move;
                transition: all 0.3s ease;
                user-select: none;
                min-width: 120px;
            }
            
            .sync-status-content:active {
                cursor: grabbing;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            }
            
            .sync-status-icon {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .status-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #4CAF50;
                transition: all 0.3s ease;
            }
            
            .sync-status-indicator.synced .status-indicator {
                background: #4CAF50;
                border-radius: 50%;
            }
            
            .sync-status-indicator.pending .status-indicator {
                background: #FF9800;
                border-radius: 2px;
            }
            
            .sync-status-indicator.syncing .status-indicator {
                background: #2196F3;
                border-radius: 2px;
                animation: spin 1s linear infinite;
            }
            
            .sync-status-indicator.failed .status-indicator {
                background: #F44336;
                border-radius: 0;
                clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                animation: shake 0.5s ease-in-out infinite;
            }
            
            .sync-status-indicator.offline .status-indicator {
                background: #9E9E9E;
                border-radius: 2px;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-2px); }
                75% { transform: translateX(2px); }
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.8; }
            }
            
            .sync-status-text {
                font-size: 12px;
                color: #666;
            }
            
            .sync-status-detail {
                font-size: 11px;
                color: #4CAF50;
            }
            
            .sync-status-indicator.pending .sync-status-detail {
                color: #FF9800;
            }
            
            .sync-status-indicator.syncing .sync-status-detail {
                color: #2196F3;
            }
            
            .sync-status-indicator.failed .sync-status-detail {
                color: #F44336;
            }
            
            .sync-status-indicator.offline .sync-status-detail {
                color: #9E9E9E;
            }
            
            .sync-status-badge {
                min-width: 20px;
                height: 20px;
                background: #F44336;
                color: white;
                border-radius: 10px;
                font-size: 12px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
                animation: pulse 1s ease-in-out infinite;
            }
            
            .sync-status-tooltip {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 8px;
                padding: 12px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                min-width: 220px;
            }
            
            .tooltip-title {
                font-size: 13px;
                font-weight: bold;
                color: #333;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #eee;
            }
            
            .tooltip-section {
                margin-bottom: 12px;
            }
            
            .tooltip-section:last-child {
                margin-bottom: 0;
            }
            
            .section-title {
                font-size: 11px;
                font-weight: bold;
                color: #999;
                margin-bottom: 6px;
                padding-bottom: 4px;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .tooltip-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 12px;
            }
            
            .tooltip-label {
                color: #666;
            }
            
            .tooltip-value {
                color: #333;
                font-weight: 500;
            }
            
            .tooltip-value.synced, .tooltip-value.online {
                color: #4CAF50;
            }
            
            .tooltip-value.pending {
                color: #FF9800;
            }
            
            .tooltip-value.syncing {
                color: #2196F3;
            }
            
            .tooltip-value.failed, .tooltip-value.offline {
                color: #F44336;
            }
            
            .tooltip-tip {
                font-size: 11px;
                color: #666;
                padding: 2px 0;
                line-height: 1.4;
            }
            
            .sync-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10001;
                display: flex;
                align-items: center;
                gap: 10px;
                animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .sync-notification.success {
                border-left: 4px solid #4CAF50;
            }
            
            .sync-notification.error {
                border-left: 4px solid #F44336;
            }
            
            .sync-notification.info {
                border-left: 4px solid #2196F3;
            }
            
            .sync-notification.warning {
                border-left: 4px solid #FF9800;
            }
            
            .notification-icon {
                font-size: 20px;
            }
            
            .notification-message {
                font-size: 13px;
                color: #333;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 设置拖动功能
     */
    setupDrag() {
        const content = this.element.querySelector('.sync-status-content');
        if (!content) return;
        
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        
        content.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            isDragging = true;
            const rect = this.element.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            this.element.style.cursor = 'grabbing';
            this.element.style.zIndex = '10001';
            this.element.style.transition = 'none';
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const elementWidth = this.element.offsetWidth;
            const elementHeight = this.element.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
            newY = Math.max(0, Math.min(newY, windowHeight - elementHeight));
            
            this.element.style.left = newX + 'px';
            this.element.style.top = newY + 'px';
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
        };
        
        const onMouseUp = () => {
            isDragging = false;
            this.element.style.cursor = 'move';
            this.element.style.zIndex = '10000';
            this.element.style.transition = 'all 0.3s ease';
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }
    
    /**
     * 设置事件监听
     */
    setupEventListeners() {
        this.element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleClick();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target)) {
                const tooltip = this.element.querySelector('.sync-status-tooltip');
                tooltip.style.display = 'none';
                this.tooltipVisible = false;
            }
        });
        
        if (window.OfflineQueue) {
            window.OfflineQueue.addListener((status) => this.updateStatus(status));
        }
        
        window.addEventListener('online', () => {
            this.updateStatus();
            this.showNotification('网络已恢复，正在同步数据...', 'info');
        });
        
        window.addEventListener('offline', () => {
            this.updateStatus();
            this.showNotification('网络已断开，数据将暂存到本地', 'warning');
        });
        
        this.updateStatus();
    }
    
    /**
     * 处理点击事件
     */
    handleClick() {
        const status = window.OfflineQueue?.getStatus() || { status: 'synced', pending: 0, failed: 0 };
        
        if (status.failed > 0) {
            this.showFailedItemsModal();
        } else {
            const tooltip = this.element.querySelector('.sync-status-tooltip');
            this.tooltipVisible = !this.tooltipVisible;
            tooltip.style.display = this.tooltipVisible ? 'block' : 'none';
        }
    }
    
    /**
     * 更新状态
     */
    updateStatus(customStatus) {
        const isOnline = navigator.onLine;
        const queueStatus = window.OfflineQueue?.getStatus() || { status: 'synced', pending: 0, failed: 0 };
        
        const status = customStatus || queueStatus;
        
        this.element.classList.remove('synced', 'pending', 'syncing', 'failed', 'offline');
        
        let currentStatus = 'synced';
        
        if (!isOnline) {
            currentStatus = 'offline';
        } else if (status.status === 'syncing') {
            currentStatus = 'syncing';
        } else if (status.failed > 0) {
            currentStatus = 'failed';
        } else if (status.pending > 0) {
            currentStatus = 'pending';
        }
        
        this.element.classList.add(currentStatus);
        
        const networkStatus = this.element.querySelector('.network-status');
        if (networkStatus) {
            networkStatus.textContent = isOnline ? '在线' : '离线';
            networkStatus.className = 'tooltip-value network-status ' + (isOnline ? 'synced' : 'offline');
        }
        
        const lastSyncTime = this.element.querySelector('.last-sync-time');
        if (lastSyncTime) {
            const lastSync = window.lastSyncTime || Date.now();
            const now = Date.now();
            const diff = now - lastSync;
            if (diff < 60000) {
                lastSyncTime.textContent = '刚刚';
            } else if (diff < 3600000) {
                lastSyncTime.textContent = `${Math.floor(diff / 60000)}分钟前`;
            } else if (diff < 86400000) {
                lastSyncTime.textContent = `${Math.floor(diff / 3600000)}小时前`;
            } else {
                lastSyncTime.textContent = new Date(lastSync).toLocaleDateString();
            }
        }
        
        const pendingCount = this.element.querySelector('.pending-count');
        if (pendingCount) {
            pendingCount.textContent = status.pending || 0;
            pendingCount.className = 'tooltip-value pending-count' + ((status.pending || 0) > 0 ? ' pending' : '');
        }
        
        const failedCount = this.element.querySelector('.failed-count');
        if (failedCount) {
            failedCount.textContent = status.failed || 0;
            failedCount.className = 'tooltip-value failed-count' + ((status.failed || 0) > 0 ? ' failed' : '');
        }
        
        const badge = this.element.querySelector('.sync-status-badge');
        const totalPending = (status.pending || 0) + (status.failed || 0);
        if (badge) {
            if (totalPending > 0) {
                badge.textContent = totalPending;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        
        const statusText = this.element.querySelector('.sync-status-detail');
        if (statusText) {
            const statusLabels = {
                synced: '已同步',
                pending: `${status.pending} 条待同步`,
                syncing: '同步中...',
                failed: `${status.failed} 条失败`,
                offline: '离线'
            };
            statusText.textContent = statusLabels[currentStatus] || '已同步';
        }
    }
    
    /**
     * 显示失败项处理弹窗
     */
    showFailedItemsModal() {
        const queue = window.OfflineQueue?.getQueue() || [];
        const failedItems = queue.filter(i => i.status === 'failed');
        
        if (failedItems.length === 0) {
            this.showNotification('没有失败的同步项', 'info');
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = 'syncFailedModal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
            z-index: 10001;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white; border-radius: 12px;
            width: 90%; max-width: 500px; max-height: 80vh;
            overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;
        
        content.innerHTML = `
            <div style="padding: 20px; background: #fee2e2; border-bottom: 1px solid #fecaca;">
                <h3 style="margin: 0; color: #dc2626; display: flex; align-items: center; gap: 8px;">
                    ⚠️ 同步失败项 (${failedItems.length})
                </h3>
                <p style="margin: 8px 0 0; font-size: 12px; color: #991b1b;">
                    以下数据未能同步到云端，请选择处理方式
                </p>
            </div>
            <div style="max-height: 300px; overflow-y: auto; padding: 16px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 8px; text-align: left;">模块</th>
                            <th style="padding: 8px; text-align: left;">记录</th>
                            <th style="padding: 8px; text-align: left;">错误</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${failedItems.map(item => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">${this.getModuleName(item.module)}</td>
                                <td style="padding: 8px;">${item.recordId || '-'}</td>
                                <td style="padding: 8px; color: #dc2626;">${item.lastError || '未知错误'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="padding: 16px; display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid #eee;">
                <button id="clearFailedBtn" style="padding: 8px 16px; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer;">清除记录</button>
                <button id="retryFailedBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">重新同步</button>
                <button id="closeFailedModal" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer;">关闭</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        document.getElementById('closeFailedModal').onclick = () => modal.remove();
        document.getElementById('clearFailedBtn').onclick = () => {
            if (confirm('确定要清除这些失败记录吗？数据将保留在本地。')) {
                window.OfflineQueue?.clearFailed();
                modal.remove();
                this.updateStatus();
            }
        };
        document.getElementById('retryFailedBtn').onclick = async () => {
            document.getElementById('retryFailedBtn').textContent = '同步中...';
            document.getElementById('retryFailedBtn').disabled = true;
            
            await window.OfflineQueue?.retryFailed();
            
            modal.remove();
            this.updateStatus();
            
            const newStatus = window.OfflineQueue?.getStatus();
            if (newStatus?.failed === 0) {
                this.showNotification('同步成功！', 'success');
            } else {
                this.showNotification('仍有失败项，请检查网络', 'warning');
            }
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }
    
    /**
     * 获取模块名称
     */
    getModuleName(module) {
        const names = {
            personnel: '👥 人员信息',
            training: '📚 培训成绩',
            task: '✅ 任务',
            hazard: '🔍 隐患',
            inspection: '📋 检查问题',
            honor: '🏅 荣誉',
            patrol: '⚠️ 违章违纪',
            samplingCar: '🚛 采样车',
            instrument: '🔧 仪器'
        };
        return names[module] || module;
    }
    
    /**
     * 显示通知
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `sync-notification ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${icons[type]}</span>
            <span class="notification-message">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

let syncStatusIndicator = null;

function initSyncStatusUI() {
    if (!syncStatusIndicator) {
        syncStatusIndicator = new SyncStatusIndicator();
    }
    syncStatusIndicator.init();
    return syncStatusIndicator;
}

function updateSyncStatusUI(status) {
    if (syncStatusIndicator) {
        syncStatusIndicator.updateStatus(status);
    }
}

function showSyncNotification(message, type) {
    if (syncStatusIndicator) {
        syncStatusIndicator.showNotification(message, type);
    }
}

window.syncStatusIndicator = syncStatusIndicator;
window.initSyncStatusUI = initSyncStatusUI;
window.updateSyncStatusUI = updateSyncStatusUI;
window.showSyncNotification = showSyncNotification;

if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(initSyncStatusUI, 500);
    });
}

console.log('[同步状态UI] 模块已加载');