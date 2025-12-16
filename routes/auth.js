import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUser, findUserByUsername, findUserByEmail, deleteUser, getAllUsers, updateUserLogin } from '../database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { generateNginxConfig } from '../scripts/generate-nginx-config.js';
import { reloadNginx } from '../utils/nginx-reload.js';
import { deleteInstance } from '../pm2-manager.js';
import { deleteSillyTavern } from '../git-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        // 验证输入
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // 用户名验证
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        }
        
        // 密码验证
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        // 邮箱验证
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // 检查用户名是否已存在
        if (findUserByUsername(username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // 检查邮箱是否已存在
        if (findUserByEmail(email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建用户
        const user = createUser(username, hashedPassword, email);
        
        // 🔧 自动生成并重载 Nginx 配置
        console.log(`[Register] 新用户 ${username} 注册成功，正在更新 Nginx 配置...`);
        try {
            generateNginxConfig();
            console.log('[Register] Nginx 配置文件已生成');
            
            // 尝试重载 Nginx
            const reloadResult = await reloadNginx();
            if (reloadResult.success) {
                console.log(`[Register] ✅ Nginx 配置已自动重载 (方式: ${reloadResult.method || 'unknown'})`);
            } else {
                console.error('[Register] ⚠️ Nginx 配置重载失败:', reloadResult.error);
                if (reloadResult.needGenerate) {
                    console.error('[Register] 提示：请先运行 npm run generate-nginx 生成配置文件');
                }
            }
        } catch (nginxError) {
            // Nginx 重载失败不应该影响用户注册
            console.error('[Register] Nginx 配置更新失败（不影响注册）:', nginxError.message);
        }
        
        // 生成token
        const token = generateToken(user.id, user.username);
        
        // 更新最后登录时间（注册即登录）
        try {
            updateUserLogin(user.username);
            console.log(`[Register] ✅ 用户 ${user.username} 注册成功，已记录登录时间`);
        } catch (error) {
            console.error(`[Register] ⚠️  更新登录时间失败:`, error);
        }
        
        // 设置 cookie（用于 Nginx 权限验证）
        res.cookie('st_token', token, {
            httpOnly: false, // 允许前端 JavaScript 读取（用于验证）
            secure: false, // 支持 HTTP 访问
            maxAge: 365 * 24 * 60 * 60 * 1000, // 365天
            sameSite: 'lax',
            path: '/' // 确保整个网站都能访问
        });
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                port: user.port
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        // 查找用户
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // 验证密码
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // 生成token
        const token = generateToken(user.id, user.username);
        
        // 更新最后登录时间
        try {
            updateUserLogin(user.username);
            console.log(`[Auth] ✅ 用户 ${user.username} 登录成功，已记录登录时间`);
        } catch (error) {
            console.error(`[Auth] ⚠️  更新登录时间失败:`, error);
        }
        
        // 设置 cookie（用于 Nginx 权限验证）
        res.cookie('st_token', token, {
            httpOnly: false, // 允许前端 JavaScript 读取（用于验证）
            secure: false, // 支持 HTTP 访问
            maxAge: 365 * 24 * 60 * 60 * 1000, // 365天
            sameSite: 'lax',
            path: '/' // 确保整个网站都能访问
        });
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                port: user.port,
                status: user.status
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 用户删除自己的账号
router.delete('/account', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                message: '用户不存在'
            });
        }
        
        // 防止删除管理员账号（如果是最后一个管理员）
        if (user.role === 'admin') {
            const allUsers = getAllUsers();
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            
            if (adminCount <= 1) {
                return res.status(400).json({ 
                    error: 'Cannot delete the last admin user',
                    message: '不能删除最后一个管理员用户，请先创建其他管理员'
                });
            }
        }
        
        console.log(`[Delete Account] 用户 ${username} 请求删除账号`);
        
        // 1. 停止并删除 PM2 实例
        try {
            console.log(`[Delete Account] 停止并删除 ${username} 的实例...`);
            await deleteInstance(username);
        } catch (err) {
            console.log(`[Delete Account] 没有运行的实例或已删除: ${err.message}`);
        }
        
        // 2. 删除 SillyTavern 目录
        if (user.st_dir && fs.existsSync(user.st_dir)) {
            console.log(`[Delete Account] 删除 ${username} 的 SillyTavern 目录...`);
            await deleteSillyTavern(user.st_dir);
        }
        
        // 3. 删除用户数据目录
        const userDataDir = path.join(__dirname, '..', 'data', username);
        if (fs.existsSync(userDataDir)) {
            console.log(`[Delete Account] 删除 ${username} 的数据目录...`);
            fs.rmSync(userDataDir, { recursive: true, force: true });
        }
        
        // 4. 从数据库删除用户
        deleteUser(username);
        console.log(`[Delete Account] 用户 ${username} 已从数据库删除`);
        
        // 5. 重新生成 Nginx 配置
        try {
            console.log(`[Delete Account] 重新生成 Nginx 配置...`);
            await generateNginxConfig();
            await reloadNginx();
            console.log(`[Delete Account] Nginx 配置已更新`);
        } catch (nginxError) {
            console.error(`[Delete Account] Nginx 配置更新失败:`, nginxError);
            // 不影响删除流程
        }
        
        // 6. 清除 Cookie
        res.clearCookie('st_token');
        
        console.log(`[Delete Account] ✅ 用户 ${username} 账号删除完成`);
        res.json({ 
            message: 'Account deleted successfully',
            redirect: '/'
        });
        
    } catch (error) {
        console.error('[Delete Account] 删除账号失败:', error);
        res.status(500).json({ 
            error: 'Failed to delete account',
            message: '删除账号失败: ' + error.message
        });
    }
});

export default router;
