#!/usr/bin/env node

/**
 * Nginx 端口更新修复工具
 * 此脚本用于修复实例重启后 Nginx 502 Bad Gateway 问题
 */

import { generateNginxConfig } from '../scripts/generate-nginx-config.js';
import { reloadNginx } from '../utils/nginx-reload.js';
import { getAllUsers } from '../database.js';

async function fixNginxConfig() {
    console.log('🔧 开始修复 Nginx 配置...');
    
    // 获取所有用户并显示信息
    const users = getAllUsers().filter(user => user.role !== 'admin' && user.port && user.port > 0);
    console.log(`📋 找到 ${users.length} 个普通用户实例配置`);
    
    if (users.length === 0) {
        console.log('⚠️ 没有找到任何需要配置的用户实例');
        return;
    }
    
    // 显示用户和端口信息
    console.log('\n当前用户和端口配置:');
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} - 端口: ${user.port}`);
    });
    
    // 重新生成 Nginx 配置
    console.log('\n🔄 重新生成 Nginx 配置...');
    try {
        generateNginxConfig();
        console.log('✅ Nginx 配置文件已重新生成');
        
        // 尝试重载 Nginx
        console.log('\n🔄 尝试重载 Nginx...');
        const reloadResult = await reloadNginx();
        
        if (reloadResult.success) {
            console.log(`✅ Nginx 重载成功，使用方法: ${reloadResult.method}`);
        } else {
            console.error(`❌ Nginx 重载失败: ${reloadResult.error}`);
            console.log('\n💡 尝试手动执行以下命令:');
            console.log('   sudo nginx -s reload');
            console.log('   或');
            console.log('   sudo systemctl reload nginx');
        }
        
    } catch (error) {
        console.error('❌ 处理过程中出错:', error);
        process.exit(1);
    }
    
    console.log('\n🔍 故障排查提示:');
    console.log('1. 确认 Nginx 正在运行');
    console.log('2. 确认所有用户端口都已正确分配');
    console.log('3. 确认 Nginx 配置文件中的端口与数据库一致');
    console.log('4. 尝试重启 Nginx: sudo systemctl restart nginx');
    console.log('5. 检查 Nginx 错误日志: sudo tail -f /var/log/nginx/error.log');
    console.log('\n✅ 修复过程完成！');
}

fixNginxConfig().catch(console.error);
