import { getAllUsers } from './database.js';

console.log('=== 调试用户信息 ===');

const users = getAllUsers();
console.log(`总用户数: ${users.length}`);

users.forEach(user => {
    console.log(`用户: ${user.username}`);
    console.log(`  角色: ${user.role}`);
    console.log(`  端口: ${user.port}`);
    console.log(`  ST目录: ${user.st_dir || '未设置'}`);
    console.log(`  数据目录: ${user.data_dir || '未设置'}`);
    console.log('---');
});

const activeUsers = users.filter(user => {
    if (user.role === 'admin') return false;
    if (!user.port || user.port === 0) return false;
    return true;
});

console.log(`需要配置的活跃用户数: ${activeUsers.length}`);
activeUsers.forEach(user => {
    console.log(`- ${user.username}: 端口 ${user.port}`);
});
