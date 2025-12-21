import { getNginxConfig } from './config-manager.js';
import { getForwardingConfig, getActiveForwardingServers } from '../database-instance-forwarding.js';

/**
 * 生成用户的 SillyTavern 访问地址
 * @param {string} username - 用户名
 * @param {number} port - 用户端口
 * @returns {Object} 包含主访问地址和备用访问地址列表
 */
export function generateAccessUrl(username, port) {
    let mainUrl = ''; // 主访问地址
    let alternativeUrls = []; // 备用访问地址列表
    
    // 优先检查转发配置
    try {
        const forwardingConfig = getForwardingConfig();
        
        // 如果启用了转发
        if (forwardingConfig.enabled === 1) {
            // 获取活跃的转发服务器
            const servers = getActiveForwardingServers();
            
            // 生成所有服务器的访问地址
            if (servers && servers.length > 0) {
                servers.forEach((server, index) => {
                    const hasProtocol = /^https?:\/\//i.test(server.address);
                    const address = hasProtocol ? server.address : `http://${server.address}`;
                    const url = `${address}:${forwardingConfig.main_port}/${username}/st/`;
                    
                    if (index === 0) {
                        mainUrl = url; // 第一个作为主地址
                    } else {
                        alternativeUrls.push(url); // 其余作为备用地址
                    }
                });
                
                // 如果有转发服务器，直接返回结果
                if (mainUrl) {
                    return {
                        mainUrl,
                        alternativeUrls
                    };
                }
            }
        }
    } catch (error) {
        console.error('获取转发配置失败:', error.message);
    }
    
    // 默认回退到原有的 Nginx 配置
    const nginxConfig = getNginxConfig();
    
    if (nginxConfig.enabled) {
        // Nginx 路径转发模式：http://域名:端口/用户名/st/
        const portPart = nginxConfig.port === 80 ? '' : `:${nginxConfig.port}`;
        mainUrl = `http://${nginxConfig.domain}${portPart}/${username}/st/`;
    } else {
        // 直接端口模式：http://localhost:端口
        mainUrl = `http://localhost:${port}`;
    }
    
    return {
        mainUrl,
        alternativeUrls
    };
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
