import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../config.json');
const CONFIG_EXAMPLE_PATH = path.join(__dirname, '../config.json.example');

console.log('='.repeat(60));
console.log('配置文件检查工具');
console.log('='.repeat(60));

// 检查配置文件是否存在
console.log('\n1. 检查配置文件:');
const configExists = fs.existsSync(CONFIG_PATH);
const exampleExists = fs.existsSync(CONFIG_EXAMPLE_PATH);

console.log(`   config.json: ${configExists ? '✅ 存在' : '❌ 不存在'}`);
console.log(`   config.json.example: ${exampleExists ? '✅ 存在' : '❌ 不存在'}`);

if (!configExists) {
    console.log('\n❌ 配置文件不存在！');
    console.log('   请执行以下命令创建配置文件：');
    console.log('   cp config.json.example config.json');
    console.log('='.repeat(60));
    process.exit(1);
}

// 读取配置文件
console.log('\n2. 读取配置内容:');
try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    
    console.log('\n   配置文件内容：');
    console.log(JSON.stringify(config, null, 2));
    
    // 检查各个配置项
    console.log('\n3. 配置项检查:');
    
    // Nginx 配置
    console.log('\n   📌 Nginx 配置:');
    if (config.nginx) {
        console.log(`      enabled: ${config.nginx.enabled ? '✅ 启用' : '⚪ 禁用'}`);
        console.log(`      domain: ${config.nginx.domain || '❌ 未配置'}`);
        console.log(`      port: ${config.nginx.port || '❌ 未配置'}`);
        console.log(`      enableAccessControl: ${config.nginx.enableAccessControl ? '✅ 启用' : '⚪ 禁用'}`);
    } else {
        console.log('      ❌ Nginx 配置缺失');
    }
    
    // System 配置
    console.log('\n   📌 System 配置:');
    if (config.system) {
        console.log(`      port: ${config.system.port || '❌ 未配置'}`);
        console.log(`      allowRegistration: ${config.system.allowRegistration ? '✅ 允许' : '⚪ 禁止'}`);
        console.log(`      maxUsers: ${config.system.maxUsers || '❌ 未配置'}`);
    } else {
        console.log('      ❌ System 配置缺失');
    }
    
    // Admin 配置
    console.log('\n   📌 Admin 配置 (自动创建管理员):');
    if (config.admin) {
        console.log(`      autoCreate: ${config.admin.autoCreate ? '✅ 启用' : '⚪ 禁用'}`);
        console.log(`      username: ${config.admin.username ? `"${config.admin.username}"` : '❌ 未配置'}`);
        console.log(`      email: ${config.admin.email ? `"${config.admin.email}"` : '❌ 未配置'}`);
        console.log(`      password: ${config.admin.password ? '✅ 已配置' : '⚪ 未配置（或已清除）'}`);
        
        // 检查配置完整性
        if (config.admin.autoCreate) {
            const isComplete = config.admin.username && config.admin.email;
            const hasPassword = !!config.admin.password;
            
            if (isComplete && hasPassword) {
                console.log('\n   ✅ 管理员自动创建配置完整！');
                console.log('      重启服务器后将自动创建管理员账号');
            } else if (isComplete && !hasPassword) {
                console.log('\n   ℹ️  管理员配置完整但密码已清除');
                console.log('      这通常意味着管理员已经创建成功');
            } else {
                console.log('\n   ⚠️  管理员配置不完整！');
                console.log('      请配置 username, password, email');
            }
        }
    } else {
        console.log('      ⚪ Admin 配置缺失（将使用默认值）');
    }
    
    // 配置文件权限检查
    console.log('\n4. 文件权限检查:');
    try {
        const stats = fs.statSync(CONFIG_PATH);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        console.log(`   文件权限: ${mode}`);
        
        if (mode === '600' || mode === '400') {
            console.log('   ✅ 权限安全');
        } else {
            console.log('   ⚠️  建议设置权限为 600 (仅所有者可读写)');
            console.log('   执行命令: chmod 600 config.json');
        }
    } catch (error) {
        console.log('   ⚠️  无法检查文件权限:', error.message);
    }
    
} catch (error) {
    console.error('\n❌ 读取配置文件失败:', error.message);
    
    if (error instanceof SyntaxError) {
        console.log('\n💡 配置文件格式错误，可能的原因：');
        console.log('   - JSON 格式不正确（缺少逗号、引号等）');
        console.log('   - 有多余的逗号');
        console.log('   - 注释未正确处理（JSON 不支持注释）');
        console.log('\n   请检查配置文件格式是否正确');
    }
    
    console.log('='.repeat(60));
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('检查完成！');
console.log('='.repeat(60));
console.log('\n💡 提示：');
console.log('   - 如需修改配置，请编辑 config.json 文件');
console.log('   - 修改后需要重启服务器: pm2 restart st-manager');
console.log('   - 查看启动日志: pm2 logs st-manager --lines 50');
console.log('');
