import cron from 'node-cron';
import path from 'path';
import { 
    getAutoBackupConfig, 
    getUsersForAutoBackup, 
    updateAutoBackupLastRun 
} from '../database.js';
import { backupToHuggingFace } from '../utils/hf-backup.js';

let cronJob = null;
let isBackupRunning = false;

// 执行自动备份
async function executeAutoBackup() {
    if (isBackupRunning) {
        console.log('[自动备份] ⚠️  上一次备份还在运行中，跳过本次');
        return;
    }
    
    try {
        isBackupRunning = true;
        console.log('\n========== [自动备份] 开始执行 ==========');
        
        const config = getAutoBackupConfig();
        if (!config || !config.enabled) {
            console.log('[自动备份] ℹ️  自动备份未启用');
            return;
        }
        
        // 获取需要备份的用户列表
        const users = getUsersForAutoBackup(config.backup_type);
        console.log(`[自动备份] 📋 备份类型: ${config.backup_type}`);
        console.log(`[自动备份] 👥 找到 ${users.length} 个符合条件的用户`);
        
        if (users.length === 0) {
            console.log('[自动备份] ℹ️  没有需要备份的用户');
            updateAutoBackupLastRun();
            return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // 逐个备份用户
        for (const user of users) {
            try {
                console.log(`\n[自动备份] 🔄 正在备份用户: ${user.username}`);
                
                // 只备份 st-data 目录
                const stDataDir = path.join(user.data_dir, 'st-data');
                console.log(`[自动备份] 📁 备份目录: ${stDataDir}`);
                
                // 创建备份
                await backupToHuggingFace(
                    stDataDir,
                    user.username,
                    user.hf_token,
                    user.hf_repo,
                    user.hf_email,
                    (message) => {
                        // 日志回调
                        console.log(`  ${message}`);
                    }
                );
                
                successCount++;
                console.log(`[自动备份] ✅ ${user.username} 备份成功`);
                
            } catch (error) {
                failCount++;
                console.error(`[自动备份] ❌ ${user.username} 备份失败:`, error.message);
            }
            
            // 每个用户之间间隔2秒，避免过载
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // 更新最后运行时间
        updateAutoBackupLastRun();
        
        console.log('\n========== [自动备份] 执行完成 ==========');
        console.log(`✅ 成功: ${successCount} 个用户`);
        console.log(`❌ 失败: ${failCount} 个用户`);
        console.log('==========================================\n');
        
    } catch (error) {
        console.error('[自动备份] ❌ 执行失败:', error);
    } finally {
        isBackupRunning = false;
    }
}

// 启动定时任务
export function startAutoBackupScheduler() {
    const config = getAutoBackupConfig();
    
    if (!config || !config.enabled) {
        console.log('[自动备份] ℹ️  自动备份未启用');
        return;
    }
    
    // 停止现有任务
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
    
    // 创建 cron 表达式：每N小时执行一次
    // 格式: 分 时 日 月 周
    // 示例: '0 */24 * * *' 表示每24小时的第0分钟执行
    const cronExpression = `0 */${config.interval_hours} * * *`;
    
    console.log(`[自动备份] 🕐 启动定时任务: 每 ${config.interval_hours} 小时执行一次`);
    console.log(`[自动备份] 📝 Cron 表达式: ${cronExpression}`);
    console.log(`[自动备份] 📋 备份类型: ${config.backup_type}`);
    
    cronJob = cron.schedule(cronExpression, () => {
        console.log('[自动备份] ⏰ 定时任务触发');
        executeAutoBackup();
    }, {
        timezone: "Asia/Shanghai"
    });
    
    console.log('[自动备份] ✅ 定时任务已启动');
}

// 停止定时任务
export function stopAutoBackupScheduler() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        console.log('[自动备份] 🛑 定时任务已停止');
    }
}

// 重新加载配置并重启任务
export function reloadAutoBackupScheduler() {
    stopAutoBackupScheduler();
    
    const config = getAutoBackupConfig();
    if (config && config.enabled) {
        startAutoBackupScheduler();
    }
}

// 手动触发备份（用于测试）
export async function triggerManualBackup() {
    console.log('[自动备份] 🎯 手动触发备份');
    await executeAutoBackup();
}

// 获取当前状态
export function getAutoBackupStatus() {
    const config = getAutoBackupConfig();
    return {
        enabled: config ? config.enabled : false,
        isRunning: isBackupRunning,
        hasScheduler: cronJob !== null,
        config: config
    };
}
