import { getNginxConfig } from './config-manager.js';

/**
 * 生成用户的 SillyTavern 访问地址
 * @param {string} username - 用户名
 * @param {number} port - 用户端口
 * @returns {string} 访问地址
 */
export function generateAccessUrl(username, port) {
    const nginxConfig = getNginxConfig();
    
    // 重要提示：SillyTavern 不支持子路径运行
    // 因此无论是否启用 Nginx，都使用直接端口访问
    // 如果需要使用 Nginx，应该配置子域名而不是路径
    
    if (nginxConfig.enabled) {
        // 使用 Nginx 域名但直接访问端口（不使用路径转发）
        return `http://${nginxConfig.domain}:${port}/`;
    } else {
        // 直接端口模式：http://localhost:端口
        return `http://localhost:${port}`;
    }
}

/**
 * 获取管理平台访问地址
 * @returns {string} 访问地址
 */
export function getManagerUrl() {
    const PORT = process.env.PORT || 3000;
    const nginxConfig = getNginxConfig();
    
    if (nginxConfig.enabled) {
        const portPart = nginxConfig.port === 80 ? '' : `:${nginxConfig.port}`;
        return `http://${nginxConfig.domain}${portPart}`;
    } else {
        return `http://localhost:${PORT}`;
    }
}

/**
 * 检查是否使用 Nginx 模式
 * @returns {boolean}
 */
export function isUsingNginx() {
    const nginxConfig = getNginxConfig();
    return nginxConfig.enabled;
}
