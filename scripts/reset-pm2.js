#!/usr/bin/env node

/**
 * PM2 重置脚本
 * 用于清理 PM2 进程和守护进程，解决连接问题
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 开始重置 PM2...\n');

async function resetPM2() {
    try {
        // 1. 停止所有进程
        console.log('📋 步骤 1: 停止所有 PM2 进程...');
        try {
            await execAsync('pm2 stop all');
            console.log('✅ 已停止所有进程\n');
        } catch (error) {
            console.log('⚠️  没有运行的进程\n');
        }

        // 2. 删除所有进程
        console.log('📋 步骤 2: 删除所有 PM2 进程配置...');
        try {
            await execAsync('pm2 delete all');
            console.log('✅ 已删除所有进程配置\n');
        } catch (error) {
            console.log('⚠️  没有进程配置需要删除\n');
        }

        // 3. 杀死 PM2 守护进程
        console.log('📋 步骤 3: 停止 PM2 守护进程...');
        try {
            await execAsync('pm2 kill');
            console.log('✅ PM2 守护进程已停止\n');
        } catch (error) {
            console.log('⚠️  守护进程未运行\n');
        }

        // 4. 等待一秒
        console.log('⏳ 等待清理完成...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n✅ PM2 重置完成！\n');
        console.log('💡 建议操作：');
        console.log('   1. 运行 npm start 重新启动服务器');
        console.log('   2. 在用户面板手动启动各个实例');
        console.log('   3. 如果问题仍然存在，请检查日志文件\n');

    } catch (error) {
        console.error('❌ 重置过程中发生错误:', error.message);
        console.error('\n💡 手动清理步骤：');
        console.error('   1. 运行: pm2 kill');
        console.error('   2. 删除 PM2 配置目录（可选）: rm -rf ~/.pm2');
        console.error('   3. 重启系统（如果问题严重）\n');
        process.exit(1);
    }
}

resetPM2();
