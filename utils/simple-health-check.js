import net from 'net';

/**
 * 超简单的端口检查，用于快速诊断
 * @param {number} port - 要检查的端口
 * @param {string} host - 主机地址
 * @param {number} timeout - 超时时间
 * @returns {Promise<boolean>} 端口是否开放
 */
export async function quickPortCheck(port, host = 'localhost', timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;
        
        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
            }
        };
        
        const timer = setTimeout(() => {
            console.log(`[快速检查] 端口 ${port} 连接超时`);
            cleanup();
            resolve(false);
        }, timeout);
        
        socket.connect(port, host, () => {
            console.log(`[快速检查] 端口 ${port} 连接成功`);
            clearTimeout(timer);
            cleanup();
            resolve(true);
        });
        
        socket.on('error', (err) => {
            console.log(`[快速检查] 端口 ${port} 连接失败: ${err.code}`);
            clearTimeout(timer);
            cleanup();
            resolve(false);
        });
    });
}

/**
 * 等待端口开放
 * @param {number} port - 要等待的端口
 * @param {number} maxRetries - 最大重试次数
 * @param {number} interval - 重试间隔
 * @returns {Promise<boolean>} 端口是否最终开放
 */
export async function waitForPort(port, maxRetries = 15, interval = 1000) {
    console.log(`[快速检查] 等待端口 ${port} 开放...`);
    
    for (let i = 0; i < maxRetries; i++) {
        const isOpen = await quickPortCheck(port);
        
        if (isOpen) {
            console.log(`[快速检查] 端口 ${port} 已开放 (尝试 ${i + 1}/${maxRetries})`);
            return true;
        }
        
        if (i < maxRetries - 1) {
            console.log(`[快速检查] 端口 ${port} 未开放，等待 ${interval}ms 后重试... (${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    console.error(`[快速检查] 端口 ${port} 在 ${maxRetries} 次尝试后仍未开放`);
    return false;
}
