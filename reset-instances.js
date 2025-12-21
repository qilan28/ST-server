import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pm2 from 'pm2';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PM2 连接状态
let pm2Connected = false;

/**
 * 实例管理修复工具
 * 用于修复用户面板的实例启动问题
 */

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
            
            try {
                pm2.connect((err) => {
                    clearTimeout(timeoutId);
                    
                    if (err) {
                        console.error('[PM2] 连接错误:', err);
                        pm2Connected = false;
                        reject(new Error(`无法连接到 PM2: ${err.message || '未知错误'}`));
                    } else {
                        console.log('[PM2] 连接成功');
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
            console.log('[PM2] 断开连接');
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

// 获取所有 PM2 进程
const getAllProcesses = async () => {
    try {
        await connectPM2();
        
        return new Promise((resolve, reject) => {
            pm2.list((err, list) => {
                if (err) {
                    disconnectPM2();
                    reject(err);
                } else {
                    disconnectPM2();
                    resolve(list);
                }
            });
        });
    } catch (error) {
        disconnectPM2();
        throw error;
    }
};

// 删除所有 ST 实例
const deleteAllSTInstances = async () => {
    try {
        console.log('开始删除所有 SillyTavern 实例...');
        
        const processes = await getAllProcesses();
        const stProcesses = processes.filter(p => p.name.startsWith('st-'));
        
        if (stProcesses.length === 0) {
            console.log('没有发现 SillyTavern 实例');
            return true;
        }
        
        console.log(`发现 ${stProcesses.length} 个 SillyTavern 实例：`);
        stProcesses.forEach(p => {
            console.log(`- ${p.name} (${p.pid || 'no pid'}) 状态：${p.pm2_env.status}`);
        });
        
        await connectPM2();
        
        for (const proc of stProcesses) {
            try {
                console.log(`正在停止实例 ${proc.name}...`);
                
                await new Promise((resolve, reject) => {
                    pm2.stop(proc.name, (err) => {
                        if (err) {
                            console.warn(`- 警告: 停止 ${proc.name} 时发生错误: ${err.message}`);
                        } else {
                            console.log(`- 已停止 ${proc.name}`);
                        }
                        resolve(); // 即使有错误也继续
                    });
                });
                
                await new Promise((resolve, reject) => {
                    pm2.delete(proc.name, (err) => {
                        if (err) {
                            console.warn(`- 警告: 删除 ${proc.name} 时发生错误: ${err.message}`);
                        } else {
                            console.log(`- 已删除 ${proc.name}`);
                        }
                        resolve(); // 即使有错误也继续
                    });
                });
                
                // 如果进程有 PID，尝试用系统命令结束
                if (proc.pid && proc.pid > 0) {
                    try {
                        if (process.platform === 'win32') {
                            await execPromise(`taskkill /F /PID ${proc.pid}`);
                            console.log(`- 已强制结束进程 PID=${proc.pid}`);
                        } else {
                            await execPromise(`kill -9 ${proc.pid}`);
                            console.log(`- 已强制结束进程 PID=${proc.pid}`);
                        }
                    } catch (killErr) {
                        console.warn(`- 警告: 结束进程 PID=${proc.pid} 时出错: ${killErr.message}`);
                    }
                }
                
            } catch (procError) {
                console.error(`处理实例 ${proc.name} 时出错:`, procError);
            }
        }
        
        disconnectPM2();
        console.log('所有 SillyTavern 实例已清理');
        return true;
    } catch (error) {
        console.error('删除所有实例时发生错误:', error);
        disconnectPM2();
        return false;
    }
};

// 重置 PM2 守护进程
const resetPM2Daemon = async () => {
    try {
        console.log('正在重置 PM2 守护进程...');
        
        // 1. 杀死所有 PM2 进程
        console.log('1. 停止所有 PM2 进程...');
        try {
            await execPromise('pm2 kill');
            console.log('- PM2 守护进程已停止');
        } catch (killError) {
            console.warn('- 警告: PM2 守护进程停止时出错:', killError.message);
        }
        
        // 2. 清理 PM2 日志和缓存
        console.log('2. 清理 PM2 日志和缓存...');
        try {
            await execPromise('pm2 cleardump');
            console.log('- PM2 日志和缓存已清理');
        } catch (clearError) {
            console.warn('- 警告: PM2 日志清理时出错:', clearError.message);
        }
        
        // 3. 启动 PM2 守护进程
        console.log('3. 重启 PM2 守护进程...');
        try {
            await execPromise('pm2 ping');
            console.log('- PM2 守护进程已重启');
        } catch (pingError) {
            console.error('- 错误: PM2 守护进程重启失败:', pingError.message);
            return false;
        }
        
        console.log('PM2 守护进程重置完成');
        return true;
    } catch (error) {
        console.error('重置 PM2 守护进程时出错:', error);
        return false;
    }
};

// 更新数据库中所有实例状态
const updateAllInstanceStatus = async () => {
    try {
        console.log('正在更新数据库中的实例状态...');
        
        const { db } = await import('./database.js');
        
        // 将所有实例状态设为停止
        const stmt = db.prepare('UPDATE users SET status = ? WHERE role = ?');
        const result = stmt.run('stopped', 'user');
        
        console.log(`已更新 ${result.changes} 个用户的状态为已停止`);
        return true;
    } catch (error) {
        console.error('更新数据库状态时出错:', error);
        return false;
    }
};

// 清理日志文件
const cleanupLogFiles = () => {
    try {
        console.log('正在清理日志文件...');
        
        const logsDir = path.join(__dirname, 'logs');
        
        if (!fs.existsSync(logsDir)) {
            console.log('日志目录不存在，跳过清理');
            return true;
        }
        
        // 读取日志目录
        const files = fs.readdirSync(logsDir);
        console.log(`找到 ${files.length} 个日志文件`);
        
        // 清空每个日志文件
        for (const file of files) {
            const filePath = path.join(logsDir, file);
            try {
                fs.writeFileSync(filePath, '');
                console.log(`- 已清空日志文件: ${file}`);
            } catch (fileErr) {
                console.warn(`- 警告: 清空日志文件 ${file} 时出错: ${fileErr.message}`);
            }
        }
        
        console.log('日志文件清理完成');
        return true;
    } catch (error) {
        console.error('清理日志文件时出错:', error);
        return false;
    }
};

// 检查 Node.js 版本
const checkNodeVersion = () => {
    const requiredVersion = '20.11.0';
    const currentVersion = process.versions.node;
    
    const [reqMajor, reqMinor, reqPatch] = requiredVersion.split('.').map(Number);
    const [curMajor, curMinor, curPatch] = currentVersion.split('.').map(Number);
    
    if (curMajor < reqMajor || 
        (curMajor === reqMajor && curMinor < reqMinor) ||
        (curMajor === reqMajor && curMinor === reqMinor && curPatch < reqPatch)) {
        console.warn('警告: Node.js 版本低于推荐版本');
        console.warn(`当前版本: v${currentVersion}, 推荐版本: v${requiredVersion}`);
        console.warn('建议升级 Node.js 版本以确保兼容性');
        return false;
    }
    
    console.log(`Node.js 版本检查通过: v${currentVersion} (满足要求 v${requiredVersion})`);
    return true;
};

// 主函数
const main = async () => {
    console.log('================================');
    console.log('实例管理修复工具');
    console.log('用于修复用户面板的实例启动问题');
    console.log('================================');
    
    try {
        // 1. 检查 Node.js 版本
        console.log('\n步骤 1: 检查 Node.js 版本');
        checkNodeVersion();
        
        // 2. 删除所有 ST 实例
        console.log('\n步骤 2: 删除所有 SillyTavern 实例');
        await deleteAllSTInstances();
        
        // 3. 重置 PM2 守护进程
        console.log('\n步骤 3: 重置 PM2 守护进程');
        await resetPM2Daemon();
        
        // 4. 更新数据库中的实例状态
        console.log('\n步骤 4: 更新数据库状态');
        await updateAllInstanceStatus();
        
        // 5. 清理日志文件
        console.log('\n步骤 5: 清理日志文件');
        cleanupLogFiles();
        
        console.log('\n================================');
        console.log('修复完成！');
        console.log('现在您可以重启服务器，然后尝试启动实例');
        console.log('运行命令: npm start');
        console.log('================================');
        
    } catch (error) {
        console.error('修复过程中发生错误:', error);
        console.error('请尝试手动执行以下步骤:');
        console.error('1. 运行: pm2 kill');
        console.error('2. 运行: pm2 cleardump');
        console.error('3. 重启服务器: npm start');
    }
};

// 执行主函数
main();
