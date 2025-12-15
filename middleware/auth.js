import jwt from 'jsonwebtoken';
import { findUserById, isAdmin } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 生成JWT token
export const generateToken = (userId, username) => {
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// 验证JWT token中间件
export const authenticateToken = (req, res, next) => {
    // 优先从 Cookie 获取 token，其次从 Authorization header
    let token = req.cookies?.st_token;
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        const user = findUserById(decoded.userId);
        if (!user) {
            return res.status(403).json({ error: 'User not found' });
        }
        
        req.user = {
            userId: user.id,
            username: user.username,
            role: user.role || 'user'
        };
        next();
    });
};

// 验证管理员权限中间件
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const adminStatus = isAdmin(req.user.username);
    
    if (!adminStatus) {
        return res.status(403).json({ 
            error: 'Admin access required',
            message: '需要管理员权限才能访问此功能'
        });
    }
    
    next();
};

export { JWT_SECRET };
