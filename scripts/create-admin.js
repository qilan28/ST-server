import bcrypt from 'bcrypt';
import readline from 'readline';
import { createAdminUser, findUserByUsername, findUserByEmail } from '../database.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function createAdmin() {
    console.log('='.repeat(60));
    console.log('创建管理员账户');
    console.log('='.repeat(60));
    console.log();
    
    try {
        // 获取用户名
        const username = await question('请输入管理员用户名: ');
        if (!username || username.trim().length < 3) {
            console.error('❌ 用户名至少需要3个字符');
            rl.close();
            return;
        }
        
        // 检查用户名是否已存在
        const existingUser = findUserByUsername(username.trim());
        if (existingUser) {
            console.error('❌ 用户名已存在');
            rl.close();
            return;
        }
        
        // 获取邮箱
        const email = await question('请输入管理员邮箱: ');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('❌ 邮箱格式无效');
            rl.close();
            return;
        }
        
        // 检查邮箱是否已存在
        const existingEmail = findUserByEmail(email.trim());
        if (existingEmail) {
            console.error('❌ 邮箱已存在');
            rl.close();
            return;
        }
        
        // 获取密码
        const password = await question('请输入管理员密码 (至少6个字符): ');
        if (!password || password.length < 6) {
            console.error('❌ 密码至少需要6个字符');
            rl.close();
            return;
        }
        
        // 确认密码
        const passwordConfirm = await question('请再次输入密码确认: ');
        if (password !== passwordConfirm) {
            console.error('❌ 两次输入的密码不一致');
            rl.close();
            return;
        }
        
        console.log();
        console.log('正在创建管理员账户...');
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建管理员用户
        const admin = createAdminUser(username.trim(), hashedPassword, email.trim());
        
        console.log();
        console.log('✅ 管理员账户创建成功！');
        console.log();
        console.log('账户信息：');
        console.log(`  用户名: ${admin.username}`);
        console.log(`  邮箱: ${admin.email}`);
        console.log(`  角色: 管理员`);
        console.log(`  端口: ${admin.port}`);
        console.log();
        console.log('您现在可以使用此账户登录并访问管理员面板。');
        console.log('登录地址: http://localhost:3000/login.html');
        console.log('管理面板: http://localhost:3000/admin.html');
        console.log();
        
    } catch (error) {
        console.error('❌ 创建管理员账户失败:', error.message);
    } finally {
        rl.close();
    }
}

createAdmin();
