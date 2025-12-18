import net from 'net';

/**
 * 检查端口是否可用（未被占用）
 * @param {number} port - 要检查的端口号
 * @returns {Promise<boolean>} 如果端口可用返回 true，否则返回 false
 */
export function checkPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                // 端口被占用
                resolve(false);
            } else {
                // 其他错误也视为不可用
                console.error(`[Port] 检查端口 ${port} 时出错:`, err);
                resolve(false);
            }
        });
        
        server.once('listening', () => {
            // 端口可用，关闭服务器并返回 true
            server.close(() => {
                resolve(true);
            });
        });
        
        // 尝试监听指定端口
        server.listen(port, '127.0.0.1');
    });
}

/**
 * 生成随机端口号
 * @param {number} min - 最小端口号（包含）
 * @param {number} max - 最大端口号（包含）
 * @returns {number} 随机生成的端口号
 */
export function generateRandomPort(min = 3001, max = 9000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 获取可用的随机端口
 * @param {number} min - 最小端口号（包含）
 * @param {number} max - 最大端口号（包含）
 * @param {number} attempts - 尝试次数
 * @returns {Promise<number|null>} 找到可用端口则返回端口号，否则返回 null
 */
export async function getAvailableRandomPort(min = 3001, max = 9000, attempts = 10) {
    for (let i = 0; i < attempts; i++) {
        const port = generateRandomPort(min, max);
        const available = await checkPortAvailable(port);
        
        if (available) {
            console.log(`[Port] 找到可用端口: ${port}`);
            return port;
        }
        
        console.log(`[Port] 端口 ${port} 不可用，尝试下一个...`);
    }
    
    console.error(`[Port] 无法找到可用端口，已尝试 ${attempts} 次`);
    return null;
}

/**
 * 获取指定范围内的随机可用端口
 * 如果所有端口都被占用，则返回原始端口
 * @param {number} originalPort - 原始端口，如果没有找到可用端口则返回此值
 * @param {number} min - 最小端口号
 * @param {number} max - 最大端口号
 * @returns {Promise<number>} 可用端口号
 */
export async function getSafeRandomPort(originalPort, min = 3001, max = 9000) {
    const availablePort = await getAvailableRandomPort(min, max, 20);
    
    if (availablePort) {
        return availablePort;
    }
    
    // 如果没有找到可用的随机端口，检查原始端口是否可用
    const originalPortAvailable = await checkPortAvailable(originalPort);
    if (originalPortAvailable) {
        console.log(`[Port] 所有随机端口均不可用，原始端口 ${originalPort} 可用`);
        return originalPort;
    }
    
    // 如果原始端口也不可用，找一个默认端口
    console.error(`[Port] 所有端口不可用，包括原始端口 ${originalPort}`);
    throw new Error(`无法找到可用端口`);
}
