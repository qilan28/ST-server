import { generateNginxConfig } from './generate-nginx-config.js';
import { testNginxConfig } from '../utils/nginx-reload.js';
import { getNginxConfigPath } from '../utils/nginx-reload.js';

/**
 * 生成并测试Nginx配置
 */
async function generateAndTestConfig() {
    try {
        console.log('正在生成Nginx配置...');
        await generateNginxConfig();
        
        console.log('正在测试Nginx配置语法...');
        const configPath = getNginxConfigPath();
        const testResult = await testNginxConfig(configPath);
        
        if (testResult.success) {
            console.log('✅ Nginx配置语法正确');
        } else {
            console.error('❌ Nginx配置语法错误:');
            console.error(testResult.error);
        }
    } catch (error) {
        console.error('错误:', error.message);
    }
}

// 直接运行
generateAndTestConfig();
