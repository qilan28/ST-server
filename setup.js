import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(60));
console.log('SillyTavern 多开管理平台 - 初始化设置');
console.log('='.repeat(60));
console.log('');

// 创建必要的目录
const dirs = ['data', 'logs', 'public/css', 'public/js', 'middleware', 'routes'];
console.log('📁 创建必要的目录...');
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✓ 创建目录: ${dir}`);
    } else {
        console.log(`   - 目录已存在: ${dir}`);
    }
});
console.log('');

// 创建 .env 文件
console.log('🔐 配置环境变量...');
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const envContent = `# 服务器端口
PORT=3000

# JWT密钥（自动生成）
JWT_SECRET=${jwtSecret}

# Node环境
NODE_ENV=production
`;
    fs.writeFileSync(envPath, envContent);
    console.log('   ✓ 创建 .env 文件并生成随机 JWT 密钥');
} else {
    console.log('   - .env 文件已存在');
}
console.log('');

// 检查 SillyTavern 是否存在
console.log('🔍 检查 SillyTavern 安装...');
const stPath = path.join(__dirname, '..', 'SillyTavern', 'server.js');
if (fs.existsSync(stPath)) {
    console.log('   ✓ SillyTavern 已安装');
} else {
    console.log('   ⚠️  警告: 未找到 SillyTavern');
    console.log('   请确保 SillyTavern 安装在: ../SillyTavern/');
}
console.log('');

// 显示下一步操作
console.log('='.repeat(60));
console.log('✨ 设置完成！');
console.log('='.repeat(60));
console.log('');
console.log('下一步操作：');
console.log('');
console.log('1. 安装依赖:');
console.log('   npm install');
console.log('');
console.log('2. 启动服务器:');
console.log('   npm start');
console.log('');
console.log('3. 访问管理平台:');
console.log('   http://localhost:3000');
console.log('');
console.log('='.repeat(60));
console.log('');
