import { getConfig, saveConfig } from '../utils/config-manager.js';

console.log('禁用访问控制...\n');

// 读取当前配置
const config = getConfig();

// 修改访问控制设置
if (config.nginx) {
    const oldValue = config.nginx.enableAccessControl;
    config.nginx.enableAccessControl = false;
    
    // 保存配置
    if (saveConfig(config)) {
        console.log('✅ 配置已更新');
        console.log(`   访问控制: ${oldValue ? '启用' : '禁用'} → 禁用`);
        console.log('');
        console.log('📝 下一步：');
        console.log('   1. 重新生成 Nginx 配置: npm run generate-nginx');
        console.log('   2. 重载 Nginx: sudo nginx -s reload');
        console.log('');
        console.log('⚠️  注意：禁用访问控制后，任何人都能访问所有用户的实例！');
    } else {
        console.error('❌ 保存配置失败');
        process.exit(1);
    }
} else {
    console.error('❌ Nginx 配置不存在');
    process.exit(1);
}
