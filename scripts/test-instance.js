import { checkServiceHealth, checkPortOpen } from '../utils/health-check.js';
import { getAllUsers } from '../database.js';

/**
 * 测试所有实例的连通性
 */
async function testAllInstances() {
    console.log('开始测试所有实例的连通性...');
    
    try {
        const users = getAllUsers();
        const activeUsers = users.filter(user => user.port && user.role !== 'admin');
        
        console.log(`找到 ${activeUsers.length} 个需要测试的用户实例`);
        
        for (const user of activeUsers) {
            console.log(`\n测试用户 ${user.username} (端口 ${user.port}):`);
            
            // 测试端口开放
            const portOpen = await checkPortOpen(user.port);
            console.log(`  端口开放: ${portOpen ? '✅' : '❌'}`);
            
            if (portOpen) {
                // 测试HTTP响应
                const healthCheck = await checkServiceHealth(user.port);
                console.log(`  HTTP响应: ${healthCheck ? '✅' : '❌'}`);
            }
        }
        
        console.log('\n连通性测试完成');
    } catch (error) {
        console.error('测试出错:', error);
    }
}

// 如果直接运行此脚本
if (process.argv[1].includes('test-instance.js')) {
    testAllInstances();
}

export { testAllInstances };
