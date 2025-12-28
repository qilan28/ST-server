import pm2 from 'pm2';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { updateUserStatus, updateUserPort } from './database.js';
import { getSafeRandomPort } from './utils/port-helper.js';
import { recordInstanceStart, removeInstanceStartTime } from './runtime-limiter.js';
import { generateNginxConfig } from './scripts/generate-nginx-config.js';
import { reloadNginx, startNginx, getNginxConfigPath } from './utils/nginx-reload.js';
import { promisify } from 'util';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PM2 连接状态
let pm2Connected = false;

// 连接到PM2
const connectPM2 = () => {
    console.log('[PM2] 尝试连接到 PM2...');
    return new Promise((resolve, reject) => {
        try {
            // 如果已经连接，直接返回
            if (pm2Connected) {
                console.log('[PM2] 已存在连接，直接使用');
                resolve();
                return;
            }
            
            // 如果之前断开连接但标志未重置，强制重设
            pm2Connected = false;
            
            // 使用超时保护
            const timeoutId = setTimeout(() => {
                console.error('[PM2] 连接超时');
                reject(new Error('PM2 connection timeout'));
            }, 5000);
            
            // console.log('[PM2] 尝试连接到 PM2...');
            try {
                pm2.connect((err) => {
                    clearTimeout(timeoutId);
                    
                    if (err) {
                        console.error('[PM2] 连接错误:', err);
                        pm2Connected = false;
                        reject(new Error(`无法连接到 PM2: ${err.message || '未知错误'}`));
                    } else {
                        // console.log('[PM2] 连接成功');
                        pm2Connected = true;
                        resolve();
                    }
                });
            } catch (connectErr) {
                clearTimeout(timeoutId);
                console.error('[PM2] 连接异常:', connectErr);
                pm2Connected = false;
                reject(new Error(`PM2 连接异常: ${connectErr.message || '未知错误'}`));
            }
        } catch (error) {
            console.error('[PM2] 连接异常:', error);
            pm2Connected = false;
            reject(error);
        }
    });
};

// 断开PM2连接
const disconnectPM2 = () => {
    try {
        if (pm2Connected) {
            // console.log('[PM2] 断开连接');
            pm2.disconnect();
            pm2Connected = false;
            return true;
        }
        return false;
    } catch (error) {
        console.error('[PM2] 断开连接错误:', error);
        // 即使出错，也将连接状态标记为断开
        pm2Connected = false;
        return false;
    }
};

// 启动SillyTavern实例
export const startInstance = async (username, originalPort, stDir, dataDir) => {
    console.log(`[Instance] 开始启动用户 ${username} 的实例...`);
    
    // 检查目录是否存在
    if (!fs.existsSync(stDir)) {
        throw new Error(`SillyTavern directory does not exist: ${stDir}`);
    }
    
    // 检查server.js是否存在
    const stServerPath = path.join(stDir, 'server.js');
    if (!fs.existsSync(stServerPath)) {
        throw new Error(`SillyTavern server script not found: ${stServerPath}`);
    }
    
    // 检查文件是否有执行权限
    try {
        // 检查文件权限
        const stats = fs.statSync(stServerPath);
        console.log(`[Instance] server.js 文件权限: ${stats.mode.toString(8)}`);
    } catch (error) {
        console.warn(`[Instance] 无法检查文件权限: ${error.message}`);
    }
    
    // 先检查实例是否已存在，如果存在则先停止
    try {
        const status = await getInstanceStatus(username);
        if (status && status.status === 'online') {
            console.log(`[Instance] 实例 ${username} 已经在运行，先停止再重启`);
            await stopInstance(username);
            // 等待两秒确保进程完全停止
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.log(`[Instance] 检查实例状态时出错，忽略并继续:`, error);
        
        // 尝试强制删除可能存在的进程 
        try {
            await forcefullyDeleteProcess(`st-${username}`);
        } catch (deleteError) {
            console.log(`[Instance] 强制删除进程失败，继续: ${deleteError.message}`);
        }
    }
    
    // 启动尝试次数
    let startAttempts = 0;
    const maxStartAttempts = 2;
    
    while (startAttempts <= maxStartAttempts) {
        startAttempts++;
        console.log(`[Instance] 启动尝试 ${startAttempts}/${maxStartAttempts + 1}`);
        
        try {
            // 连接PM2
            try {
                console.log(`[Instance] 连接PM2...`);
                await connectPM2();
                console.log(`[Instance] PM2连接成功`);
            } catch (error) {
                console.error(`[Instance] PM2连接失败:`, error);
                
                if (startAttempts <= maxStartAttempts) {
                    console.log(`[Instance] 等待 3 秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue;
                }
                
                throw new Error(`Failed to connect to PM2: ${error.message}`);
            }
            
            // 获取随机可用端口
            console.log(`[Instance] 为用户 ${username} 分配随机端口...`);
            const port = await getSafeRandomPort(originalPort, 3001, 9000);
            console.log(`[Instance] 用户 ${username} 分配到端口: ${port} (原端口: ${originalPort})`);
            
            // 更新数据库中的端口
            if (port !== originalPort) {
                await updateUserPort(username, port);
                console.log(`[Instance] 已更新用户 ${username} 的端口为 ${port}`);
                
                // 重新生成 Nginx 配置并重载
                try {
                    console.log(`[Instance] 由于端口变更，重新生成 Nginx 配置...`);
                    await generateNginxConfig();
                    console.log(`[Instance] 尝试重载 Nginx...`);
                    
                    // 获取正确的配置路径
                    const configPath = getNginxConfigPath();
                    
                    // 尝试先停止 Nginx
                    try {
                        await execPromise('nginx -s stop');
                        console.log(`[Instance] Nginx 已停止`);
                    } catch (stopError) {
                        console.log(`[Instance] Nginx 可能未运行: ${stopError.message}`);
                    }
                    
                    // 等待一秒确保完全停止
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 使用自定义配置启动 Nginx
                    try {
                        await execPromise(`nginx -c "${configPath}"`);
                        console.log(`[Instance] Nginx 配置重载成功，使用配置文件: ${configPath}`);
                    } catch (startError) {
                        console.error(`[Instance] Nginx 启动失败: ${startError.message}`);
                        // 尝试标准重载方法作为备份
                        const reloadResult = await reloadNginx();
                        if (reloadResult.success) {
                            console.log(`[Instance] Nginx 配置重载成功，方法: ${reloadResult.method}`);
                        } else {
                            console.warn(`[Instance] Nginx 重载失败: ${reloadResult.error}，可能需要手动重载`);
                        }
                    }
                } catch (nginxError) {
                    console.error(`[Instance] Nginx 配置更新失败:`, nginxError);
                    // 继续启动实例，不要因为 Nginx 问题中断
                }
            } else {
                // 即使端口没变，也确保 Nginx 使用正确配置
                try {
                    // 获取正确的配置路径
                    const configPath = getNginxConfigPath();
                    
                    // 尝试重新加载 Nginx 配置
                    console.log(`[Instance] 确保 Nginx 使用正确配置...`);
                    try {
                        await execPromise(`nginx -s reload`);
                        console.log(`[Instance] Nginx 配置重载成功（信号方式）`);
                    } catch (reloadError) {
                        console.log(`[Instance] 尝试使用配置文件重启 Nginx...`);
                        try {
                            await execPromise('nginx -s stop').catch(() => {});
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            await execPromise(`nginx -c "${configPath}"`);
                            console.log(`[Instance] Nginx 已使用正确配置启动`);
                        } catch (startError) {
                            console.warn(`[Instance] Nginx 配置加载警告: ${startError.message}`);
                        }
                    }
                } catch (nginxError) {
                    console.warn(`[Instance] Nginx 操作警告:`, nginxError.message);
                }
            }
            
            // 创建数据目录（如果不存在）
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log(`[Instance] 创建数据目录: ${dataDir}`);
                
                // 设置数据目录权限
                try {
                    fs.chmodSync(dataDir, 0o755);
                } catch (chmodError) {
                    console.warn(`[Instance] 设置数据目录权限失败: ${chmodError.message}`);
                }
            }
            
            // 确保SillyTavern所需的关键子目录都存在
            const requiredDirs = [
                path.join(dataDir, 'User Avatars'),
                path.join(dataDir, 'backgrounds'),
                path.join(dataDir, 'group chats'),
                path.join(dataDir, 'chats'),
                path.join(dataDir, 'characters'),
                path.join(dataDir, 'groups'),
                path.join(dataDir, 'settings'),
                path.join(dataDir, 'worlds'),
                path.join(dataDir, 'themes'),
                path.join(dataDir, 'NovelAI Settings'),
                path.join(dataDir, 'uploads')
            ];
            
            for (const dir of requiredDirs) {
                if (!fs.existsSync(dir)) {
                    try {
                        fs.mkdirSync(dir, { recursive: true });
                        console.log(`[Instance] 创建必要子目录: ${dir}`);
                    } catch (mkdirError) {
                        console.warn(`[Instance] 创建子目录失败: ${dir} - ${mkdirError.message}`);
                    }
                }
            }
            
            // 确保设置文件存在
            const settingsFile = path.join(dataDir, 'settings.json');
            if (!fs.existsSync(settingsFile)) {
                try {
                    fs.writeFileSync(settingsFile, JSON.stringify({
                        "theme": "Default",
                        "fast_ui_mode": true,
                        "chat_display": "bubbles",
                        "last_migration": 0
                    }, null, 4));
                    console.log(`[Instance] 创建基本设置文件: ${settingsFile}`);
                } catch (writeError) {
                    console.warn(`[Instance] 创建设置文件失败: ${writeError.message}`);
                }
            }
            
            // 获取 Node.js 可执行文件路径
            const nodePath = process.execPath || 'node';
            console.log(`[Instance] 使用 Node.js 路径: ${nodePath}`);
            
            return new Promise((resolve, reject) => {
                console.log(`[Instance] 准备启动 SillyTavern 实例，端口 ${port}`);
                
                // 使用超时保护
                const timeoutId = setTimeout(() => {
                    disconnectPM2();
                    reject(new Error('PM2 start operation timed out'));
                }, 15000); // 增加到15秒超时
                
                // 构建启动配置
                const startConfig = {
                    name: `st-${username}`,
                    script: stServerPath,
                    args: `--port ${port} --dataRoot ${dataDir}`,
                    cwd: stDir,
                    interpreter: nodePath, // 使用完整路径
                    env: {
                        NODE_ENV: 'production',
                        PORT: port.toString()
                    },
                    max_memory_restart: '500M',
                    error_file: path.join(__dirname, 'logs', `${username}-error.log`),
                    out_file: path.join(__dirname, 'logs', `${username}-out.log`),
                    time: true,
                    autorestart: true,
                    restart_delay: 3000, // 重启延迟
                    kill_timeout: 5000,  // 等待进程退出的时间
                    wait_ready: false    // 不等待ready信号
                };
                
                // 记录完整的启动配置
                console.log(`[Instance] PM2 启动配置:`, JSON.stringify(startConfig, null, 2));
                
                // 启动实例
                pm2.start(startConfig, (err, apps) => {
                    clearTimeout(timeoutId);
                    
                    if (err) {
                        console.error(`[Instance] 启动实例 ${username} 失败:`, err);
                        disconnectPM2();
                        
                        if (startAttempts <= maxStartAttempts) {
                            console.log(`[Instance] 启动失败，将在下一次循环重试`);
                            reject(err);
                        } else {
                            reject(err);
                        }
                    } else {
                        console.log(`[Instance] 成功启动实例 ${username}`);
                        // 更新状态并记录启动时间
                        updateUserStatus(username, 'running');
                        recordInstanceStart(username);
                        console.log(`[Instance] 已记录用户 ${username} 的实例启动时间`);
                        
                        // 不要立即断开连接，先检查实例状态
                        setTimeout(() => {
                            pm2.describe(`st-${username}`, (descErr, procDesc) => {
                                disconnectPM2();
                                
                                if (descErr || !procDesc || procDesc.length === 0) {
                                    console.warn(`[Instance] 无法验证实例启动状态: ${descErr?.message}`);
                                } else {
                                    const proc = procDesc[0];
                                    console.log(`[Instance] 实例状态检查: ${proc.pm2_env.status}, 进程ID: ${proc.pid}`);
                                }
                                
                                resolve({ apps, port });
                            });
                        }, 2000);
                    }
                });
            });
        } catch (error) {
            console.error(`[Instance] 启动实例 ${username} 尝试 ${startAttempts} 失败:`, error);
            disconnectPM2();
            
            if (startAttempts <= maxStartAttempts) {
                console.log(`[Instance] 等待 3 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                throw new Error(`无法启动实例 (已尝试 ${startAttempts} 次): ${error.message}`);
            }
        }
    }
    
    throw new Error(`启动实例失败，已达到最大重试次数 (${maxStartAttempts + 1})`);
};

// 停止实例
export const stopInstance = async (username) => {
    if (!username) {
        throw new Error('Username is required');
    }
    
    console.log(`[Instance] 开始停止用户 ${username} 的实例...`);
    
    try {
        try {
            console.log(`[Instance] 连接PM2...`);
            await connectPM2();
            console.log(`[Instance] PM2连接成功`);
        } catch (error) {
            console.error(`[Instance] PM2连接失败:`, error);
            throw new Error(`Failed to connect to PM2: ${error.message}`);
        }
        
        return new Promise((resolve, reject) => {
            // 使用超时保护
            const timeoutId = setTimeout(() => {
                disconnectPM2();
                reject(new Error('PM2 stop operation timed out'));
            }, 8000); // 8秒超时
            
            console.log(`[Instance] 发送停止命令: st-${username}`);
            
            // 先检查实例是否存在
            pm2.describe(`st-${username}`, (descErr, processDescription) => {
                if (descErr) {
                    clearTimeout(timeoutId);
                    disconnectPM2();
                    console.error(`[Instance] 检查实例状态时出错:`, descErr);
                    updateUserStatus(username, 'stopped');
                    removeInstanceStartTime(username);
                    resolve({message: 'Error checking instance, status updated to stopped'});
                    return;
                }
                
                if (!processDescription || processDescription.length === 0) {
                    clearTimeout(timeoutId);
                    disconnectPM2();
                    console.log(`[Instance] 实例 ${username} 不存在，更新状态为停止`);
                    updateUserStatus(username, 'stopped');
                    removeInstanceStartTime(username);
                    console.log(`[Instance] 已移除用户 ${username} 的实例启动时间记录`);
                    resolve({message: 'Instance was not running'});
                    return;
                }
                
                // 如果实例存在，停止它
                pm2.stop(`st-${username}`, (err, proc) => {
                    clearTimeout(timeoutId);
                    disconnectPM2();
                    
                    if (err) {
                        console.error(`[Instance] 停止实例 ${username} 失败:`, err);
                        reject(err);
                    } else {
                        console.log(`[Instance] 成功停止实例 ${username}`);
                        updateUserStatus(username, 'stopped');
                        removeInstanceStartTime(username);
                        console.log(`[Instance] 已移除用户 ${username} 的实例启动时间记录`);
                        resolve(proc);
                    }
                });
            });
        });
    } catch (error) {
        console.error(`[Instance] 停止实例 ${username} 时出错:`, error);
        disconnectPM2(); // 确保断开连接
        throw new Error(`Failed to stop instance: ${error.message}`);
    }
};

// 重启实例
export const restartInstance = async (username) => {
    if (!username) {
        throw new Error('Username is required');
    }
    
    console.log(`[Instance] 开始重启用户 ${username} 的实例...`);
    
    try {
        // 获取用户信息，用于后续启动实例
        const { findUserByUsername } = await import('./database.js');
        const user = findUserByUsername(username);
        
        if (!user) {
            throw new Error(`User not found: ${username}`);
        }
        
        if (!user.st_dir || !fs.existsSync(user.st_dir)) {
            throw new Error(`SillyTavern directory not found for user: ${username}`);
        }
        
        // 记录当前的状态
        console.log(`[Instance] 获取当前实例状态...`);
        let currentStatus;
        try {
            currentStatus = await getInstanceStatus(username);
            console.log(`[Instance] 当前状态:`, currentStatus ? currentStatus.status : 'not running');
        } catch (statusError) {
            console.log(`[Instance] 获取状态失败:`, statusError);
            // 继续执行，即使状态检查失败
        }
        
        // 先停止实例，即使它可能没有运行
        console.log(`[Instance] 停止实例 ${username}...`);
        try {
            await stopInstance(username);
            console.log(`[Instance] 实例 ${username} 停止成功`);
        } catch (stopError) {
            // 处理不同的错误类型
            if (stopError.message && stopError.message.includes('not found') || stopError.message.includes('不存在')) {
                console.log(`[Instance] 实例 ${username} 不存在，继续启动新实例`);
                // 更新用户状态为停止
                updateUserStatus(username, 'stopped');
            } else if (stopError.message && stopError.message.includes('PM2')) {
                console.log(`[Instance] PM2 连接错误，尝试继续:`, stopError.message);
            } else {
                // 其他错误
                console.log(`[Instance] 停止实例失败，但仍将继续:`, stopError.message || stopError);
            }
        }
        
        // 等待短暂停确保实例完全停止
        console.log(`[Instance] 等待短暂停确保实例完全停止...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 获取数据目录
        const dataDir = path.join(user.data_dir, 'st-data');
        console.log(`[Instance] 数据目录: ${dataDir}`);
        
        // 使用原始端口重新启动实例
        console.log(`[Instance] 开始启动实例 ${username}, 原端口: ${user.port}...`);
        const result = await startInstance(username, user.port, user.st_dir, dataDir);
        console.log(`[Instance] 实例 ${username} 启动成功，端口: ${result.port}`);
        
        // 检查端口是否变更，如果未在 startInstance 中重载 Nginx，这里再次确认
        if (result.port !== user.port) {
            try {
                console.log(`[Instance] 确保端口变更后的 Nginx 配置已更新...`);
                // 再次尝试重载 Nginx，以保证配置生效
                const reloadResult = await reloadNginx();
                if (reloadResult.success) {
                    console.log(`[Instance] Nginx 配置再次重载成功，方法: ${reloadResult.method}`);
                }
            } catch (nginxError) {
                console.warn(`[Instance] 重启后重载 Nginx 失败:`, nginxError.message);
                // 不影响实例重启结果
            }
        }
        
        return result;
    } catch (error) {
        console.error(`[Instance] 重启实例 ${username} 失败:`, error);
        throw new Error(`Failed to restart instance: ${error.message}`);
    }
};

// 删除实例
// 强制删除进程
async function forcefullyDeleteProcess(processName) {
    try {
        console.log(`[Instance] 尝试强制删除进程: ${processName}`);
        
        // 连接到PM2
        await connectPM2();
        
        return new Promise((resolve, reject) => {
            // 先尝试正常删除
            pm2.delete(processName, (err) => {
                if (err) {
                    console.warn(`[Instance] 正常删除进程 ${processName} 失败:`, err.message);
                    
                    // 使用 pm2 jlist 获取所有进程详情
                    exec('pm2 jlist', (jlistErr, stdout) => {
                        if (jlistErr) {
                            disconnectPM2();
                            return reject(new Error(`无法获取进程列表: ${jlistErr.message}`));
                        }
                        
                        try {
                            const processes = JSON.parse(stdout);
                            const targetProcess = processes.find(p => p.name === processName);
                            
                            if (targetProcess) {
                                console.log(`[Instance] 找到目标进程 ${processName}, PID=${targetProcess.pid}`);
                                
                                // 在Windows上使用 taskkill 命令强制终止进程
                                if (process.platform === 'win32' && targetProcess.pid) {
                                    exec(`taskkill /F /PID ${targetProcess.pid}`, (killErr) => {
                                        if (killErr) {
                                            console.warn(`[Instance] 强制终止进程失败: ${killErr.message}`);
                                        } else {
                                            console.log(`[Instance] 已强制终止进程 PID=${targetProcess.pid}`);
                                        }
                                        
                                        // 再次尝试删除
                                        pm2.delete(processName, (deleteErr) => {
                                            disconnectPM2();
                                            if (deleteErr) {
                                                console.warn(`[Instance] 二次删除失败: ${deleteErr.message}`);
                                                reject(new Error(`无法完全清理进程: ${deleteErr.message}`));
                                            } else {
                                                console.log(`[Instance] 已成功删除进程 ${processName}`);
                                                resolve(true);
                                            }
                                        });
                                    });
                                } else {
                                    // 非Windows或无PID，直接尝试再次删除
                                    pm2.delete(processName, (deleteErr) => {
                                        disconnectPM2();
                                        if (deleteErr) {
                                            console.warn(`[Instance] 二次删除失败: ${deleteErr.message}`);
                                            reject(new Error(`无法完全清理进程: ${deleteErr.message}`));
                                        } else {
                                            console.log(`[Instance] 已成功删除进程 ${processName}`);
                                            resolve(true);
                                        }
                                    });
                                }
                            } else {
                                disconnectPM2();
                                console.log(`[Instance] 未找到进程 ${processName}，可能已不存在`);
                                resolve(true);
                            }
                        } catch (parseErr) {
                            disconnectPM2();
                            reject(new Error(`解析进程列表失败: ${parseErr.message}`));
                        }
                    });
                } else {
                    disconnectPM2();
                    console.log(`[Instance] 已成功删除进程 ${processName}`);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        disconnectPM2();
        throw error;
    }
}

export const deleteInstance = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.delete(`st-${username}`, (err, proc) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                resolve(proc);
            }
        });
    });
};

// 获取实例状态
export const getInstanceStatus = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.describe(`st-${username}`, (err, processDescription) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else if (processDescription.length === 0) {
                resolve(null);
            } else {
                const proc = processDescription[0];
                // 计算运行时长：当前时间 - 启动时间
                const uptime = proc.pm2_env.status === 'online' 
                    ? Date.now() - proc.pm2_env.pm_uptime 
                    : 0;
                resolve({
                    status: proc.pm2_env.status,
                    cpu: proc.monit.cpu,
                    memory: proc.monit.memory,
                    uptime: uptime,
                    restarts: proc.pm2_env.restart_time
                });
            }
        });
    });
};

// 获取所有实例列表
export const listAllInstances = async () => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.list((err, processDescriptionList) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                const stInstances = processDescriptionList
                    .filter(proc => proc.name.startsWith('st-'))
                    .map(proc => {
                        // 计算运行时长：当前时间 - 启动时间
                        const uptime = proc.pm2_env.status === 'online' 
                            ? Date.now() - proc.pm2_env.pm_uptime 
                            : 0;
                        return {
                            name: proc.name,
                            username: proc.name.replace('st-', ''),
                            status: proc.pm2_env.status,
                            cpu: proc.monit.cpu,
                            memory: proc.monit.memory,
                            uptime: uptime,
                            restarts: proc.pm2_env.restart_time
                        };
                    });
                resolve(stInstances);
            }
        });
    });
};

// 获取日志内容
export const getInstanceLogs = (username, logType = 'out', lines = 100) => {
    const logFileName = logType === 'error' 
        ? `${username}-error.log` 
        : `${username}-out.log`;
    const logFilePath = path.join(__dirname, 'logs', logFileName);
    
    return new Promise((resolve, reject) => {
        // 检查日志文件是否存在
        if (!fs.existsSync(logFilePath)) {
            resolve({ logs: [], exists: false });
            return;
        }
        
        try {
            // 读取文件内容
            const content = fs.readFileSync(logFilePath, 'utf-8');
            const allLines = content.split('\n').filter(line => line.trim());
            
            // 获取最后N行
            const lastLines = allLines.slice(-lines);
            
            resolve({
                logs: lastLines,
                exists: true,
                totalLines: allLines.length
            });
        } catch (error) {
            reject(error);
        }
    });
};

// 获取日志文件路径
export const getLogFilePath = (username, logType = 'out') => {
    const logFileName = logType === 'error' 
        ? `${username}-error.log` 
        : `${username}-out.log`;
    return path.join(__dirname, 'logs', logFileName);
};
