import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INSTANCES_CONFIG_PATH = path.join(__dirname, '../config-instances.json');

// 默认实例配置
const DEFAULT_INSTANCES_CONFIG = {
    mainPort: 7091,
    instances: []
};

/**
 * 读取实例配置文件
 */
export function getInstancesConfig() {
    try {
        if (!fs.existsSync(INSTANCES_CONFIG_PATH)) {
            // 如果配置文件不存在，创建默认配置
            fs.writeFileSync(INSTANCES_CONFIG_PATH, JSON.stringify(DEFAULT_INSTANCES_CONFIG, null, 2), 'utf-8');
            return DEFAULT_INSTANCES_CONFIG;
        }
        
        const data = fs.readFileSync(INSTANCES_CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取实例配置文件失败:', error);
        return DEFAULT_INSTANCES_CONFIG;
    }
}

/**
 * 保存实例配置文件
 */
export function saveInstancesConfig(config) {
    try {
        fs.writeFileSync(INSTANCES_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('保存实例配置文件失败:', error);
        return false;
    }
}

/**
 * 获取主转发端口
 */
export function getMainForwardPort() {
    const config = getInstancesConfig();
    return config.mainPort || 7091;
}

/**
 * 更新主转发端口
 */
export function updateMainForwardPort(port) {
    const config = getInstancesConfig();
    config.mainPort = parseInt(port) || 7091;
    return saveInstancesConfig(config);
}

/**
 * 获取所有实例
 */
export function getAllInstances() {
    const config = getInstancesConfig();
    return config.instances || [];
}

/**
 * 添加新实例
 */
export function addInstance(address) {
    if (!address || typeof address !== 'string') {
        return { success: false, error: '实例地址不能为空' };
    }
    
    // 标准化地址格式，确保以 http:// 或 https:// 开头
    if (!address.startsWith('http://') && !address.startsWith('https://')) {
        address = 'http://' + address;
    }
    
    // 去除可能的尾部斜杠
    if (address.endsWith('/')) {
        address = address.slice(0, -1);
    }

    const config = getInstancesConfig();
    
    // 检查实例是否已存在
    const exists = config.instances.some(instance => instance.address === address);
    if (exists) {
        return { success: false, error: '实例地址已存在' };
    }
    
    // 添加新实例
    const newInstance = {
        id: Date.now().toString(),
        address: address,
        addedAt: new Date().toISOString()
    };
    
    config.instances.push(newInstance);
    
    const saved = saveInstancesConfig(config);
    if (saved) {
        return { success: true, instance: newInstance };
    } else {
        return { success: false, error: '保存配置失败' };
    }
}

/**
 * 删除实例
 */
export function removeInstance(instanceId) {
    const config = getInstancesConfig();
    
    const initialLength = config.instances.length;
    config.instances = config.instances.filter(instance => instance.id !== instanceId);
    
    if (config.instances.length === initialLength) {
        return { success: false, error: '未找到指定的实例' };
    }
    
    const saved = saveInstancesConfig(config);
    if (saved) {
        return { success: true };
    } else {
        return { success: false, error: '保存配置失败' };
    }
}

/**
 * 根据ID获取实例
 */
export function getInstanceById(instanceId) {
    const instances = getAllInstances();
    return instances.find(instance => instance.id === instanceId) || null;
}

/**
 * 生成用户的实例访问URL
 */
export function generateInstanceAccessUrl(username, instanceId) {
    const mainPort = getMainForwardPort();
    const nginxConfig = getNginxConfig();
    
    if (!nginxConfig.enabled) {
        return null;
    }
    
    const portPart = nginxConfig.port === 80 ? '' : `:${nginxConfig.port}`;
    const domain = nginxConfig.domain || 'localhost';
    
    return `http://${domain}${portPart}/${username}/st/`;
}

// 动态导入避免循环依赖
async function getNginxConfig() {
    const { getNginxConfig } = await import('./config-manager.js');
    return getNginxConfig();
}
