import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取当前使用的 Nginx 配置文件路径
 */
export function getNginxConfigPath() {
    const projectDir = path.join(__dirname, '..');
    return path.join(projectDir, 'nginx', 'nginx.conf');
}

/**
 * 测试 Nginx 配置是否正确
 * @param {string} configPath - Nginx 配置文件路径
 */
export async function testNginxConfig(configPath) {
    // 检测操作系统
    const isWindows = os.platform() === 'win32';
    
    if (isWindows) {
        console.log('[Nginx] Windows环境下模拟配置测试');
        // Windows环境下只检查文件是否存在和可读
        if (fs.existsSync(configPath)) {
            try {
                // 检查是否可读
                fs.accessSync(configPath, fs.constants.R_OK);
                console.log('[Nginx] 配置文件存在且可读');
                return { success: true, output: '配置文件检查完成', simulated: true };
            } catch (error) {
                console.error('[Nginx] 配置文件无法访问:', error.message);
                return { success: false, error: '无法访问配置文件: ' + error.message, simulated: true };
            }
        } else {
            return { success: false, error: '配置文件不存在: ' + configPath, simulated: true };
        }
    }
    
    // Linux环境下执行实际的测试
    try {
        const { stdout, stderr } = await execPromise(`nginx -t -c "${configPath}"`);
        console.log('[Nginx] 配置测试通过');
        return { success: true, output: stdout || stderr };
    } catch (error) {
        console.error('[Nginx] 配置测试失败:', error.stderr || error.message);
        return { success: false, error: error.stderr || error.message };
    }
}

/**
 * 重载 Nginx 配置
 * @param {string} configPath - Nginx 配置文件路径（可选）
 */
export async function reloadNginx(configPath = null) {
    try {
        const confPath = configPath || getNginxConfigPath();
        
        // 检查配置文件是否存在
        if (!fs.existsSync(confPath)) {
            console.error('[Nginx] 配置文件不存在:', confPath);
            return { 
                success: false, 
                error: `配置文件不存在: ${confPath}`,
                needGenerate: true 
            };
        }
        
        // 检测操作系统
        const isWindows = os.platform() === 'win32';
        
        // Windows环境下模拟重载
        if (isWindows) {
            console.log('[Nginx] Windows环境下模拟重载操作');
            console.log('[Nginx] 配置文件已生成: ' + confPath);
            
            // Windows下仅生成配置文件，不进行实际重载
            return {
                success: true,
                method: 'windows_simulation',
                message: '在Windows环境下生成了Nginx配置文件，但没有进行实际重载操作'
            };
        }
        
        // Linux环境下继续尝试测试配置
        try {
            const testResult = await testNginxConfig(confPath);
            if (!testResult.success) {
                return { 
                    success: false, 
                    error: '配置测试失败: ' + testResult.error 
                };
            }
        } catch (testError) {
            console.log('[Nginx] 配置测试跳过: ' + testError.message);
        }
        
        console.log('[Nginx] 正在重载配置...');
        
        // 尝试使用信号重载（推荐方式，不需要指定配置文件）
        try {
            await execPromise('nginx -s reload');
            console.log('[Nginx] ✅ 配置重载成功（使用信号）');
            return { success: true, method: 'signal' };
        } catch (signalError) {
            console.log('[Nginx] 信号重载失败，尝试使用 systemctl...');
            
            // 尝试使用 systemctl
            try {
                await execPromise('systemctl reload nginx');
                console.log('[Nginx] ✅ 配置重载成功（使用 systemctl）');
                return { success: true, method: 'systemctl' };
            } catch (systemctlError) {
                console.error('[Nginx] systemctl 重载失败，尝试重启...');
                
                // 最后尝试重启
                try {
                    // 先停止
                    await execPromise('nginx -s stop').catch(() => {});
                    // 等待一下
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    // 使用指定配置启动
                    await execPromise(`nginx -c "${confPath}"`);
                    console.log('[Nginx] ✅ 配置重载成功（使用重启）');
                    return { success: true, method: 'restart' };
                } catch (restartError) {
                    console.error('[Nginx] 重启失败:', restartError.message);
                    return { 
                        success: false, 
                        error: '重载和重启都失败: ' + restartError.message,
                        message: '配置文件已生成，但需要手动重启nginx'
                    };
                }
            }
        }
    } catch (error) {
        console.error('[Nginx] 重载过程出错:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 检查 Nginx 是否正在运行
 */
export async function isNginxRunning() {
    try {
        const { stdout } = await execPromise('ps aux | grep nginx | grep -v grep');
        return stdout.trim().length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * 启动 Nginx（如果未运行）
 * @param {string} configPath - Nginx 配置文件路径（可选）
 */
export async function startNginx(configPath = null) {
    try {
        const running = await isNginxRunning();
        if (running) {
            console.log('[Nginx] 已在运行中');
            return { success: true, message: 'Already running' };
        }
        
        const confPath = configPath || getNginxConfigPath();
        
        if (!fs.existsSync(confPath)) {
            return { 
                success: false, 
                error: `配置文件不存在: ${confPath}`,
                needGenerate: true 
            };
        }
        
        console.log('[Nginx] 正在启动...');
        await execPromise(`nginx -c "${confPath}"`);
        console.log('[Nginx] ✅ 启动成功');
        return { success: true, message: 'Started' };
    } catch (error) {
        console.error('[Nginx] 启动失败:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 停止 Nginx
 */
export async function stopNginx() {
    try {
        console.log('[Nginx] 正在停止...');
        await execPromise('nginx -s stop');
        console.log('[Nginx] ✅ 停止成功');
        return { success: true };
    } catch (error) {
        console.error('[Nginx] 停止失败:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 获取 Nginx 状态信息
 */
export async function getNginxStatus() {
    try {
        const running = await isNginxRunning();
        
        if (!running) {
            return {
                running: false,
                message: 'Nginx 未运行'
            };
        }
        
        // 获取进程信息
        const { stdout } = await execPromise('ps aux | grep nginx | grep -v grep');
        const processes = stdout.trim().split('\n').length;
        
        // 获取配置文件路径（从主进程）
        let configFile = 'unknown';
        try {
            const { stdout: confOutput } = await execPromise('nginx -V 2>&1 | grep "configure arguments"');
            const match = confOutput.match(/--conf-path=([^\s]+)/);
            if (match) {
                configFile = match[1];
            }
        } catch (err) {
            // 忽略错误
        }
        
        return {
            running: true,
            processes,
            configFile,
            message: 'Nginx 正在运行'
        };
    } catch (error) {
        return {
            running: false,
            error: error.message
        };
    }
}
