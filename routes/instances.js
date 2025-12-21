import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    getMainForwardPort, 
    updateMainForwardPort, 
    getAllInstances, 
    addInstance, 
    removeInstance, 
    getInstanceById 
} from '../utils/instance-manager.js';

const router = express.Router();

// 所有路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取实例配置
router.get('/', (req, res) => {
    try {
        const mainPort = getMainForwardPort();
        const instances = getAllInstances();
        
        res.json({
            success: true,
            mainPort,
            instances
        });
    } catch (error) {
        console.error('获取实例配置失败:', error);
        res.status(500).json({ success: false, error: '获取实例配置失败' });
    }
});

// 更新主转发端口
router.put('/main-port', (req, res) => {
    try {
        const { port } = req.body;
        
        // 验证端口号
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return res.status(400).json({ 
                success: false, 
                error: '端口必须是1-65535之间的有效数字' 
            });
        }
        
        const result = updateMainForwardPort(portNum);
        
        if (result) {
            res.json({
                success: true,
                message: '主转发端口已更新',
                mainPort: portNum
            });
        } else {
            res.status(500).json({ success: false, error: '更新主转发端口失败' });
        }
    } catch (error) {
        console.error('更新主转发端口失败:', error);
        res.status(500).json({ success: false, error: '更新主转发端口失败' });
    }
});

// 添加新实例
router.post('/', (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address || typeof address !== 'string') {
            return res.status(400).json({ success: false, error: '实例地址不能为空' });
        }
        
        const result = addInstance(address);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                message: '实例已添加',
                instance: result.instance
            });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('添加实例失败:', error);
        res.status(500).json({ success: false, error: '添加实例失败' });
    }
});

// 删除实例
router.delete('/:instanceId', (req, res) => {
    try {
        const { instanceId } = req.params;
        
        const instance = getInstanceById(instanceId);
        if (!instance) {
            return res.status(404).json({ success: false, error: '实例不存在' });
        }
        
        const result = removeInstance(instanceId);
        
        if (result.success) {
            res.json({
                success: true,
                message: '实例已删除'
            });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('删除实例失败:', error);
        res.status(500).json({ success: false, error: '删除实例失败' });
    }
});

export default router;
