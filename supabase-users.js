/**
 * Supabase 用户管理模块
 * 实现用户数据的云端存储和同步
 */

class CloudUserManager {
    constructor() {
        // 使用统一的 supabaseConfig 配置（来自 cloud-sync.js）
        const config = window.supabaseConfig || {
            url: 'https://gfeoegvntxyfotvhklri.supabase.co',
            key: 'sb_publishable_rBqTlyxcWEa1lwumCvxLLQ_bnimmF06',
            tables: { users: 'users' }
        };
        
        this.url = config.url;
        this.headers = {
            'Content-Type': 'application/json',
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`
        };
        this.tableName = config.tables?.users || 'users';
        console.log(`☁️ CloudUserManager 初始化 - URL: ${this.url}, 表名: ${this.tableName}`);
        this.localCache = null;
    }

    // 获取所有用户
    async getAllUsers() {
        try {
            const response = await fetch(`${this.url}/rest/v1/${this.tableName}?select=*&order=created_at.desc`, {
                headers: this.headers
            });

            if (!response.ok) {
                console.warn(`获取用户失败: ${response.status}，将使用本地数据`);
                return this.localCache || [];
            }

            const data = await response.json();
            this.localCache = data;
            return data;
        } catch (error) {
            console.warn('获取用户列表失败，使用本地数据:', error.message);
            // 如果网络失败，返回本地缓存
            return this.localCache || [];
        }
    }

    // 获取单个用户
    async getUserByUsername(username) {
        try {
            const response = await fetch(
                `${this.url}/rest/v1/${this.tableName}?username=eq.${encodeURIComponent(username)}&select=*`,
                { headers: this.headers }
            );

            if (!response.ok) {
                console.warn(`获取用户失败: ${response.status}`);
                return null;
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                console.log('响应不是JSON格式:', e.message);
                return null;
            }

            return data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('获取用户失败:', error);
            return null;
        }
    }

    // 创建新用户
    async createUser(userData) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${this.tableName}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    username: userData.username,
                    realname: userData.realName || userData.realname || '',
                    password: userData.password,
                    role: userData.role || 'user',
                    status: userData.status || 'pending',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                let errorMessage = `创建用户失败: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.details || errorMessage;
                } catch (e) {
                    // 非JSON响应，使用默认错误信息
                    console.log('响应不是JSON格式:', e.message);
                }
                throw new Error(errorMessage);
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                // 成功响应但不是JSON，创建基本数据对象
                data = { id: null, ...userData };
            }

            // 同时保存到本地
            this.syncToLocal([data]);

            return { success: true, data };
        } catch (error) {
            console.error('创建用户失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 更新用户
    async updateUser(id, updates) {
        try {
            // 只发送数据库中存在的字段，排除 passwordHash
            const filteredUpdates = {};
            if (updates.password !== undefined) filteredUpdates.password = updates.password;
            if (updates.role !== undefined) filteredUpdates.role = updates.role;
            if (updates.status !== undefined) filteredUpdates.status = updates.status;
            if (updates.realName !== undefined) filteredUpdates.realname = updates.realName;
            if (updates.realname !== undefined) filteredUpdates.realname = updates.realname;
            if (updates.department !== undefined) filteredUpdates.department = updates.department;
            if (updates.position !== undefined) filteredUpdates.position = updates.position;

            const response = await fetch(`${this.url}/rest/v1/${this.tableName}?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    ...this.headers,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    ...filteredUpdates,
                    updated_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`更新用户失败: ${response.status}`);
            }

            const data = await response.json();

            // 同步到本地
            if (data && data.length > 0) {
                this.syncToLocal(data);
            }

            return { success: true, data };
        } catch (error) {
            console.error('更新用户失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 删除用户
    async deleteUser(id) {
        try {
            const response = await fetch(`${this.url}/rest/v1/${this.tableName}?id=eq.${id}`, {
                method: 'DELETE',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`删除用户失败: ${response.status}`);
            }

            return { success: true };
        } catch (error) {
            console.error('删除用户失败:', error);
            return { success: false, message: error.message };
        }
    }

    // 同步到本地存储
    syncToLocal(cloudData) {
        try {
            let localUsers = JSON.parse(localStorage.getItem('systemUsers') || '[]');

            cloudData.forEach(cloudUser => {
                const index = localUsers.findIndex(u => u.id === cloudUser.id);
                if (index >= 0) {
                    localUsers[index] = cloudUser;
                } else {
                    localUsers.push(cloudUser);
                }
            });

            localStorage.setItem('systemUsers', JSON.stringify(localUsers));
        } catch (error) {
            console.error('同步到本地失败:', error);
        }
    }

    // 从云端同步到本地
    async syncFromCloud() {
        try {
            const cloudUsers = await this.getAllUsers();
            if (cloudUsers && cloudUsers.length > 0) {
                localStorage.setItem('systemUsers', JSON.stringify(cloudUsers));
            }
            return cloudUsers;
        } catch (error) {
            console.error('从云端同步失败:', error);
            return [];
        }
    }
}

// 创建全局实例
const cloudUserManager = new CloudUserManager();

// 覆盖原有的用户管理函数
let cloudUsers = [];

// 加载用户数据
async function loadUsers() {
    try {
        // 优先从云端加载
        const cloudData = await cloudUserManager.getAllUsers();
        if (cloudData && cloudData.length > 0) {
            cloudUsers = cloudData;
            localStorage.setItem('systemUsers', JSON.stringify(cloudUsers));
        } else {
            // 如果云端没有数据，从本地加载
            cloudUsers = JSON.parse(localStorage.getItem('systemUsers')) || [];
        }
    } catch (error) {
        console.error('加载用户失败:', error);
        cloudUsers = JSON.parse(localStorage.getItem('systemUsers')) || [];
    }
}

// 保存用户到云端和本地
async function saveUsersToCloud(user) {
    const result = await cloudUserManager.createUser(user);
    if (result.success) {
        cloudUsers.push(result.data);
        localStorage.setItem('systemUsers', JSON.stringify(cloudUsers));
    }
    return result;
}

// 更新用户
async function updateUserInCloud(id, updates) {
    const result = await cloudUserManager.updateUser(id, updates);
    if (result.success) {
        const index = cloudUsers.findIndex(u => u.id === id);
        if (index >= 0) {
            cloudUsers[index] = { ...cloudUsers[index], ...updates };
            localStorage.setItem('systemUsers', JSON.stringify(cloudUsers));
        }
    }
    return result;
}

// 删除用户
async function deleteUserFromCloud(id) {
    const result = await cloudUserManager.deleteUser(id);
    if (result.success) {
        cloudUsers = cloudUsers.filter(u => u.id !== id);
        localStorage.setItem('systemUsers', JSON.stringify(cloudUsers));
    }
    return result;
}

// 覆盖原有的 registerUser 函数
async function registerUser(e) {
    e.preventDefault();

    const username = document.getElementById('regUsername').value.trim();
    const realName = document.getElementById('regRealName').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const roleSelect = document.getElementById('regRole');
    const role = roleSelect ? roleSelect.value : 'user';

    if (!username || !realName || !password || !confirmPassword || !role) {
        alert('请填写所有字段');
        return;
    }

    if (username.length < 3) {
        alert('用户名至少需要3个字符');
        return;
    }

    if (password.length < 6) {
        alert('密码至少需要6个字符');
        return;
    }

    if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }

    // 先检查云端是否已存在该用户名
    if (typeof cloudUserManager !== 'undefined') {
        try {
            const existingCloudUser = await cloudUserManager.getUserByUsername(username);
            if (existingCloudUser) {
                alert('该用户名已存在');
                return;
            }
        } catch (error) {
            console.log('检查云端用户失败:', error.message);
        }
    }

    // 检查本地是否已存在
    const existingUser = cloudUsers.find(u => u.username === username);
    if (existingUser) {
        alert('用户名已存在，请选择其他用户名');
        return;
    }

    try {
        // 显示加载提示
        const submitBtn = document.querySelector('#registerForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '注册中...';
        }

        // 创建新用户对象
        const newUser = {
            username,
            realName,
            password: password,
            role: role,
            status: 'pending'
        };

        // 保存到云端
        const result = await saveUsersToCloud(newUser);

        if (result.success) {
            alert('注册成功！请等待管理员审核，审核通过后即可登录');
            closeRegisterModal();

            // 如果当前是管理员页面，刷新用户列表
            if (typeof renderUserList === 'function') {
                renderUserList();
            }
        } else {
            alert(result.message || '注册失败，请重试');
        }
    } catch (error) {
        console.error('注册失败:', error);
        alert('注册失败: ' + error.message);
    } finally {
        const submitBtn = document.querySelector('#registerForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '注册';
        }
    }
}

// 页面加载时初始化用户数据
document.addEventListener('DOMContentLoaded', async function() {
    await loadUsers();
});
