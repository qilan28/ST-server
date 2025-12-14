import express from 'express';
import bcrypt from 'bcrypt';
import { createUser, findUserByUsername, findUserByEmail } from '../database.js';
import { generateToken } from '../middleware/auth.js';

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
        
        // 生成token
        const token = generateToken(user.id, user.username);
        
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

export default router;
