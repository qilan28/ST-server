import http from 'http';
import net from 'net';
import { promisify } from 'util';

/**
 * 检查指定端口上的服务是否可用
 * @param {number} port - 要检查的端口
 * @param {string} host - 主机地址，默认localhost 
 * @param {number} timeout - 超时时间，默认5000ms
 * @returns {Promise<boolean>} 服务是否可用
 */
export async function checkServiceHealth(port, host = 'localhost', timeout = 5000) {
    return new Promise((resolve) => {
        // 尝试多个可能的端点
        const endpoints = ['/', '/api/health', '/health', '/status'];
        let currentEndpointIndex = 0;
        
        const tryEndpoint = () => {
            if (currentEndpointIndex >= endpoints.length) {
                console.log(`[健康检查] 端口 ${port} 所有端点都无响应`);
                resolve(false);
                return;
            }
            
            const endpoint = endpoints[currentEndpointIndex];
            const request = http.get({
                host: host,
                port: port,
                path: endpoint,
                timeout: timeout
            }, (res) => {
                console.log(`[健康检查] 端口 ${port} 端点 ${endpoint} 返回状态: ${res.statusCode}`);
                // 对于SillyTavern，200-299或者404都表示服务在运行（404可能是正常的API响应）
                if (res.statusCode >= 200 && res.statusCode < 500) {
                    resolve(true);
                } else {
                    currentEndpointIndex++;
                    tryEndpoint();
                }
            });

            request.on('error', (err) => {
                console.log(`[健康检查] 端口 ${port} 端点 ${endpoint} 连接失败: ${err.message}`);
                currentEndpointIndex++;
                tryEndpoint();
            });

            request.on('timeout', () => {
                console.log(`[健康检查] 端口 ${port} 端点 ${endpoint} 连接超时`);
                request.destroy();
                currentEndpointIndex++;
                tryEndpoint();
            });
        };
        
        tryEndpoint();
    });
}

/**
 * 等待服务启动并可用
 * @param {number} port - 要检查的端口
 * @param {number} maxRetries - 最大重试次数，默认30
 * @param {number} interval - 重试间隔，默认2000ms
 * @returns {Promise<boolean>} 服务是否最终可用
 */
export async function waitForServiceReady(port, maxRetries = 30, interval = 2000) {
    console.log(`[健康检查] 等待端口 ${port} 上的服务启动...`);
    
    for (let i = 0; i < maxRetries; i++) {
        const isHealthy = await checkServiceHealth(port);
        
        if (isHealthy) {
            console.log(`[健康检查] 端口 ${port} 服务已就绪 (尝试 ${i + 1}/${maxRetries})`);
            return true;
        }
        
        if (i < maxRetries - 1) {
            console.log(`[健康检查] 端口 ${port} 服务未就绪，等待 ${interval}ms 后重试... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    console.error(`[健康检查] 端口 ${port} 服务在 ${maxRetries} 次尝试后仍未就绪`);
    return false;
}

/**
 * 简单的TCP端口检查
 * @param {number} port - 要检查的端口
 * @param {string} host - 主机地址
 * @returns {Promise<boolean>} 端口是否开放
 */
export async function checkPortOpen(port, host = 'localhost') {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        
        const timeout = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, 3000);
        
        socket.connect(port, host, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}
