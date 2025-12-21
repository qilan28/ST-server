import pm2 from 'pm2';
import { promisify } from 'util';

/**
 * PM2 连接测试脚本
 * 此脚本用于测试 PM2 连接和状态，可用于修复 PM2 连接问题
 */

// 测试 PM2 连接
async function testPM2Connection() {
    return new Promise((resolve, reject) => {
        console.log('[测试] 正在连接 PM2...');
        pm2.connect((err) => {
            if (err) {
                console.error('[测试] PM2 连接失败:', err);
                reject(err);
            } else {
                console.log('[测试] PM2 连接成功！');
                resolve(true);
            }
        });
    });
}

// 列出所有 PM2 进程
async function listProcesses() {
    return new Promise((resolve, reject) => {
        pm2.list((err, list) => {
            if (err) {
                console.error('[测试] 获取进程列表失败:', err);
                reject(err);
            } else {
                console.log('[测试] 当前运行的进程:');
                list.forEach(proc => {
                    console.log(`- ${proc.name} (${proc.pm_id}): ${proc.pm2_env.status}`);
                });
                resolve(list);
            }
        });
    });
}

// 重置 PM2 守护进程
async function resetDaemon() {
    try {
        console.log('[修复] 正在重置 PM2 守护进程...');
        
        // 使用 execPromise 执行命令
        const { exec } = require('child_process');
        const execPromise = promisify(exec);
        
        // 先杀死所有进程
        console.log('[修复] 停止所有 PM2 进程...');
        await execPromise('pm2 kill', { timeout: 30000 });
        console.log('[修复] 所有 PM2 进程已停止');
        
        // 清理 PM2 日志和缓存
        console.log('[修复] 清理 PM2 日志和缓存...');
        await execPromise('pm2 cleardump');
        console.log('[修复] PM2 日志和缓存已清理');
        
        // 重启 PM2 守护进程
        console.log('[修复] 重启 PM2 守护进程...');
        await execPromise('pm2 ping');
        
        console.log('[修复] PM2 守护进程已重置成功！');
        return true;
    } catch (error) {
        console.error('[修复] 重置 PM2 守护进程失败:', error);
        return false;
    }
}

// 主函数
async function main() {
    try {
        console.log('==================================');
        console.log('PM2 连接诊断和修复工具');
        console.log('==================================');
        
        // 测试连接
        try {
            await testPM2Connection();
            
            // 测试列出进程
            await listProcesses();
            
            console.log('[结果] PM2 连接正常！');
        } catch (error) {
            console.error('[结果] PM2 连接异常，尝试修复...');
            
            // 尝试重置守护进程
            const fixed = await resetDaemon();
            
            if (fixed) {
                try {
                    // 再次测试连接
                    await testPM2Connection();
                    await listProcesses();
                    console.log('[结果] 修复成功！PM2 现在可以正常连接');
                } catch (retryError) {
                    console.error('[结果] 修复失败，请手动执行以下命令：');
                    console.error('1. pm2 kill');
                    console.error('2. 重启服务器');
                }
            } else {
                console.error('[结果] 自动修复失败，请手动重启服务器');
            }
        }
        
        // 断开连接
        pm2.disconnect();
        console.log('==================================');
        
    } catch (error) {
        console.error('[错误] 执行过程中发生错误:', error);
        pm2.disconnect();
    }
}

// 执行主函数
main();
