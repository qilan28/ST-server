import jwt from 'jsonwebtoken';
import { findUserById } from '../database.js';

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
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
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
            username: user.username
        };
        next();
    });
};

export { JWT_SECRET };
