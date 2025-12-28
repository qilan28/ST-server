import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../config.json');

// 默认配置
const DEFAULT_CONFIG = {
    nginx: {
        enabled: false,
        domain: 'localhost',
        port: 80,
        enableAccessControl: false  // 默认禁用访问控制，任何人都能访问
    },
    system: {
        port: 3000,
        allowRegistration: true,
        maxUsers: 100
    },
    admin: {
        username: '',
        password: '',
        email: '',
        autoCreate: false  // 默认不自动创建管理员
    }
};

/**
 * 读取配置文件
 */
export function getConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            // 如果配置文件不存在，创建默认配置
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
            return DEFAULT_CONFIG;
        }
        
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * 保存配置文件
 */
export function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('保存配置文件失败:', error);
        return false;
    }
}

/**
 * 获取 Nginx 配置
 */
export function getNginxConfig() {
    const config = getConfig();
    return config.nginx;
}

/**
 * 更新 Nginx 配置
 */
export function updateNginxConfig(nginxConfig) {
    const config = getConfig();
    config.nginx = { ...config.nginx, ...nginxConfig };
    return saveConfig(config);
}

/**
 * 获取系统配置
 */
export function getSystemConfig() {
    const config = getConfig();
    return config.system;
}

/**
 * 更新系统配置
 */
export function updateSystemConfig(systemConfig) {
    const config = getConfig();
    config.system = { ...config.system, ...systemConfig };
    return saveConfig(config);
}

/**
 * 获取管理员配置
 */
export function getAdminConfig() {
    const config = getConfig();
    return config.admin || DEFAULT_CONFIG.admin;
}

/**
 * 清除管理员密码（创建管理员后调用，提高安全性）
 */
export function clearAdminPassword() {
    const config = getConfig();
    if (config.admin) {
        config.admin.password = '';
        return saveConfig(config);
    }
    return false;
}
