import { getNginxConfig } from './config-manager.js';

/**
 * 生成用户的 SillyTavern 访问地址
 * @param {string} username - 用户名
 * @param {number} port - 用户端口
 * @returns {string} 访问地址
 */
export function generateAccessUrl(username, port) {
    const nginxConfig = getNginxConfig();
    
    if (nginxConfig.enabled) {
        // 检查是否配置了 cloudflare 隧道域名
        if (nginxConfig.cloudflare_tunnel_domain && nginxConfig.cloudflare_tunnel_domain.trim() !== '') {
            // 使用 Cloudflare 隧道域名：https://隧道域名/用户名/st/
            // Cloudflare Tunnels 总是使用 HTTPS 且不需要端口号
            return `https://${nginxConfig.cloudflare_tunnel_domain}/${username}/st/`;
        } else {
            // 标准 Nginx 路径转发模式：http://域名:端口/用户名/st/
            const protocol = nginxConfig.https ? 'https' : 'http';
            // 只有非标准端口才会显示端口号 (HTTP:80 或 HTTPS:443)
            const portPart = (nginxConfig.port === 80 && !nginxConfig.https) || (nginxConfig.port === 443 && nginxConfig.https) 
                ? '' : `:${nginxConfig.port}`;
            return `${protocol}://${nginxConfig.domain}${portPart}/${username}/st/`;
        }
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
        // 检查是否配置了 cloudflare 隧道域名
        if (nginxConfig.cloudflare_tunnel_domain && nginxConfig.cloudflare_tunnel_domain.trim() !== '') {
            // 使用 Cloudflare 隧道域名：https://隧道域名/
            // Cloudflare Tunnels 总是使用 HTTPS 且不显示端口号
            return `https://${nginxConfig.cloudflare_tunnel_domain}/`;
        } else {
            // 标准 Nginx 配置
            const protocol = nginxConfig.https ? 'https' : 'http';
            // 只有非标准端口才会显示端口号 (HTTP:80 或 HTTPS:443)
            const portPart = (nginxConfig.port === 80 && !nginxConfig.https) || (nginxConfig.port === 443 && nginxConfig.https) 
                ? '' : `:${nginxConfig.port}`;
            return `${protocol}://${nginxConfig.domain}${portPart}`;
        }
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
