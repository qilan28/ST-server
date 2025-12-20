import pm2 from 'pm2';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { updateUserStatus, updateUserPort } from './database.js';
import { getSafeRandomPort } from './utils/port-helper.js';
import { recordInstanceStart, removeInstanceStartTime } from './runtime-limiter.js';
import { generateNginxConfig } from './scripts/generate-nginx-config.js';
import { reloadNginx } from './utils/nginx-reload.js';
import { waitForServiceReady, checkPortOpen } from './utils/health-check.js';
import { waitForPort, quickPortCheck } from './utils/simple-health-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PM2 连接状态
let pm2Connected = false;

// 连接到PM2
const connectPM2 = () => {
    return new Promise((resolve, reject) => {
        try {
            // 如果已经连接，直接返回
            if (pm2Connected) {
                // console.log('[PM2] 已存在连接，直接使用');
                resolve();
                return;
            }
            
            // 如果之前断开连接但标志未重置，强制重设
            pm2Connected = false;
            
            // 使用超时保护
            const timeoutId = setTimeout(() => {
                // console.error('[PM2] 连接超时');
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
    
    // 先检查实例是否已存在，如果存在则先停止
    try {
        const status = await getInstanceStatus(username);
        if (status && status.status === 'online') {
            console.log(`[Instance] 实例 ${username} 已经在运行，先停止再重启`);
            await stopInstance(username);
            // 等待一秒确保进程完全停止
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.log(`[Instance] 检查实例状态时出错，忽略并继续:`, error);
    }
    
    try {
        // 连接PM2
        try {
            // console.log(`[Instance] 连接PM2...`);
            await connectPM2();
            // console.log(`[Instance] PM2连接成功`);
        } catch (error) {
            console.error(`[Instance] PM2连接失败:`, error);
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
                const reloadResult = await reloadNginx();
                if (reloadResult.success) {
                    console.log(`[Instance] Nginx 配置重载成功，方法: ${reloadResult.method}`);
                } else {
                    console.warn(`[Instance] Nginx 重载失败: ${reloadResult.error}，可能需要手动重载`);
                }
            } catch (nginxError) {
                console.error(`[Instance] Nginx 配置更新失败:`, nginxError);
                // 继续启动实例，不要因为 Nginx 问题中断
            }
        }
        
        // 创建数据目录（如果不存在）
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[Instance] 创建数据目录: ${dataDir}`);
        }
        
        return new Promise((resolve, reject) => {
            console.log(`[Instance] 准备启动 SillyTavern 实例，端口 ${port}`);
            
            // 使用超时保护
            const timeoutId = setTimeout(() => {
                disconnectPM2();
                reject(new Error('PM2 start operation timed out'));
            }, 15000); // 15秒超时
            
            pm2.start({
                name: `st-${username}`,
                script: stServerPath,
                args: `--port ${port} --dataRoot ${dataDir}`,
                cwd: stDir,
                interpreter: 'node',
                env: {
                    NODE_ENV: 'production'
                },
                max_memory_restart: '500M',
                error_file: path.join(__dirname, 'logs', `${username}-error.log`),
                out_file: path.join(__dirname, 'logs', `${username}-out.log`),
                time: true
            }, (err, apps) => {
                clearTimeout(timeoutId);
                disconnectPM2();
                
                if (err) {
                    console.error(`[Instance] 启动实例 ${username} 失败:`, err);
                    reject(err);
                } else {
                    console.log(`[Instance] PM2 报告实例 ${username} 启动成功，正在验证服务可用性...`);
                    
                    // 等待服务真正可用
                    setTimeout(async () => {
                        try {
                            console.log(`[Instance] 等待端口 ${port} 上的服务启动...`);
                            // 使用简单快速的端口检查
                            const portReady = await waitForPort(port, 10, 1500); // 10次重试，每次等待1.5秒
                            
                            if (portReady) {
                                console.log(`[Instance] 实例 ${username} 在端口 ${port} 已启动`);
                                updateUserStatus(username, 'running');
                                recordInstanceStart(username);
                                console.log(`[Instance] 已记录用户 ${username} 的实例启动时间`);
                                resolve({ apps, port });
                            } else {
                                console.error(`[Instance] 实例 ${username} 启动失败，端口 ${port} 未开放`);
                                updateUserStatus(username, 'error');
                                reject(new Error(`实例启动失败：端口 ${port} 不可用`));
                            }
                        } catch (healthError) {
                            console.error(`[Instance] 健康检查出错:`, healthError);
                            // 即使健康检查出错，也尝试继续
                            updateUserStatus(username, 'running');
                            recordInstanceStart(username);
                            resolve({ apps, port });
                        }
                    }, 2000); // 给PM2一点时间来真正启动进程
                }
            });
        });
    } catch (error) {
        console.error(`[Instance] 启动实例 ${username} 时出错:`, error);
        disconnectPM2();
        throw new Error(`Failed to start instance: ${error.message}`);
    }
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
    
    // 引入重启前检查工具
    let performRestartHealthCheck;
    try {
        const restartChecks = await import('./utils/restart-checks.js');
        performRestartHealthCheck = restartChecks.performRestartHealthCheck;
        
        // 如果成功加载，执行重启前检查
        if (typeof performRestartHealthCheck === 'function') {
            console.log(`[Instance] 执行重启前检查...`);
            const checkResult = await performRestartHealthCheck();
            if (!checkResult.success) {
                console.warn(`[Instance] 重启前检查发现问题: ${checkResult.issues.join('; ')}`);
                // 不阻止重启，但记录问题
            }
        }
    } catch (error) {
        // 如果加载失败或检查失败，不阻止重启
        console.warn(`[Instance] 重启前检查失败: ${error.message}`);
    }
    
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
        
        // 等待足够的时间确保实例完全停止并释放资源
        console.log(`[Instance] 等待足够时间确保实例完全停止并释放资源...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 获取数据目录
        const dataDir = path.join(user.data_dir, 'st-data');
        console.log(`[Instance] 数据目录: ${dataDir}`);
        
        // 使用原始端口重新启动实例
        console.log(`[Instance] 开始启动实例 ${username}, 原端口: ${user.port}...`);
        const result = await startInstance(username, user.port, user.st_dir, dataDir);
        console.log(`[Instance] 实例 ${username} 启动成功，端口: ${result.port}`);
        
        // 额外确认实例真正可用
        console.log(`[Instance] 最终确认实例 ${username} 在端口 ${result.port} 是否可用...`);
        try {
            const finalCheck = await quickPortCheck(result.port); // 快速端口检查
            if (!finalCheck) {
                console.warn(`[Instance] 警告：实例 ${username} 可能还未完全启动`);
                // 再给一些时间
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                console.log(`[Instance] 确认：实例 ${username} 已完全可用`);
            }
        } catch (checkError) {
            console.warn(`[Instance] 最终检查出错，继续:`, checkError.message);
        }
        
        // 总是在实例重启后重新生成和重载 Nginx 配置，确保路由正确
        try {
            console.log(`[Instance] 重启后重新生成 Nginx 配置以确保路由正确...`);
            const { generateNginxConfig } = await import('./scripts/generate-nginx-config.js');
            await generateNginxConfig();
            
            console.log(`[Instance] 强制重载 Nginx 以应用新配置...`);
            // 使用强制模式重载 Nginx，跳过配置测试和其他检查
            const reloadResult = await reloadNginx(null, true);
            if (reloadResult.success) {
                console.log(`[Instance] Nginx 配置重载成功，方法: ${reloadResult.method}`);
            } else {
                console.warn(`[Instance] Nginx 重载返回错误: ${reloadResult.error}`);
                console.log(`[Instance] 尝试备用方法重载 Nginx...`);
                
                try {
                    // 如果失败，尝试直接调用命令重载
                    const { exec } = await import('child_process');
                    exec('nginx -s reload', (err, stdout, stderr) => {
                        if (err) {
                            console.warn(`[Instance] 备用方法也失败:`, err);
                        } else {
                            console.log(`[Instance] 备用方法重载成功`);
                        }
                    });
                } catch (directError) {
                    console.warn(`[Instance] 备用重载失败:`, directError.message);
                }
            }
            
            // 给 Nginx 一点时间来应用新配置
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 执行重启后验证
            try {
                const restartChecks = await import('./utils/restart-checks.js');
                if (typeof restartChecks.performRestartVerification === 'function') {
                    console.log(`[Instance] 执行重启后验证...`);
                    const verifyResult = await restartChecks.performRestartVerification();
                    if (!verifyResult.success) {
                        console.warn(`[Instance] 重启后验证发现问题: ${verifyResult.issues.join('; ')}`);
                        // 在日志中记录问题，但仍然继续
                    }
                }
            } catch (verifyError) {
                console.warn(`[Instance] 重启后验证失败:`, verifyError.message);
            }
        } catch (nginxError) {
            console.warn(`[Instance] 重启后更新 Nginx 配置失败:`, nginxError.message);
            // 不影响实例重启结果
        }
        
        return result;
    } catch (error) {
        console.error(`[Instance] 重启实例 ${username} 失败:`, error);
        throw new Error(`Failed to restart instance: ${error.message}`);
    }
};

// 删除实例
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
