# Supabase 数据库配置说明

## 步骤 1: 访问 Supabase
1. 访问 https://supabase.com
2. 登录或注册账号
3. 创建一个新项目（如果还没有的话）

## 步骤 2: 打开 SQL Editor
1. 在项目面板左侧选择 "SQL Editor"
2. 点击 "New query" 创建新查询

## 步骤 3: 执行建表脚本
1. 复制 `supabase-schema.sql` 文件中的所有内容
2. 粘贴到 SQL Editor 中
3. 点击 "Run" 执行脚本

## 步骤 4: 检查项目 URL 和密钥
1. 在项目面板左侧选择 "Project Settings" -> "API"
2. 确认以下信息：
   - `Project URL`: https://gfeoegvntxyfotvhklri.supabase.co (已在代码中配置)
   - `anon public`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (已在代码中配置)

## 步骤 5: 检查 Row Level Security (RLS)
1. 进入 "Table Editor"
2. 选择每一个表
3. 点击 "RLS Policies"
4. 确认有允许所有操作的策略（脚本中已创建）

## 常见问题

### 同步时显示错误
1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签页
3. 根据错误信息排查问题

### 表不存在
确保在 SQL Editor 中成功执行了 `supabase-schema.sql`

### 权限问题
检查 RLS 策略是否正确配置，允许所有用户读写
