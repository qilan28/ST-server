import dotenv from 'dotenv';

dotenv.config();

// Nginx 配置
const USE_NGINX = process.env.USE_NGINX === 'true';
const NGINX_DOMAIN = process.env.NGINX_DOMAIN || 'localhost';
const NGINX_PORT = process.env.NGINX_PORT || '80';

/**
 * 生成用户的 SillyTavern 访问地址
 * @param {string} username - 用户名
 * @param {number} port - 用户端口
 * @returns {string} 访问地址
 */
export function generateAccessUrl(username, port) {
    if (USE_NGINX) {
        // Nginx 模式：http://域名:端口/用户名/st
        const portPart = NGINX_PORT === '80' ? '' : `:${NGINX_PORT}`;
        return `http://${NGINX_DOMAIN}${portPart}/${username}/st`;
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
    
    if (USE_NGINX) {
        const portPart = NGINX_PORT === '80' ? '' : `:${NGINX_PORT}`;
        return `http://${NGINX_DOMAIN}${portPart}`;
    } else {
        return `http://localhost:${PORT}`;
    }
}

/**
 * 检查是否使用 Nginx 模式
 * @returns {boolean}
 */
export function isUsingNginx() {
    return USE_NGINX;
}

/**
 * 获取 Nginx 配置信息
 * @returns {object}
 */
export function getNginxConfig() {
    return {
        useNginx: USE_NGINX,
        domain: NGINX_DOMAIN,
        port: NGINX_PORT
    };
}
