import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsersAdmin } from '../database.js';

// 获取当前目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 修复用户数据目录结构，确保所有必要的子目录都存在
 */
async function fixUserDataDirectories() {
    console.log('开始修复用户数据目录结构...');
    
    // 获取所有用户
    const users = getAllUsersAdmin();
    console.log(`找到 ${users.length} 个用户`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    // 为每个用户创建必要的目录
    for (const user of users) {
        // 跳过管理员账户（没有数据目录）
        if (user.role === 'admin' || user.data_dir === 'N/A') {
            skippedCount++;
            continue;
        }
        
        // 构建数据目录路径
        const dataDir = path.join(user.data_dir, 'st-data');
        
        console.log(`\n[${user.username}] 检查数据目录: ${dataDir}`);
        
        // 如果数据目录不存在，创建它
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
                console.log(`[${user.username}] 创建数据目录: ${dataDir}`);
            } catch (error) {
                console.error(`[${user.username}] 创建数据目录失败: ${error.message}`);
                continue;
            }
        }
        
        // 检查并创建必要的子目录
        const requiredDirs = [
            path.join(dataDir, 'User Avatars'),
            path.join(dataDir, 'backgrounds'),
            path.join(dataDir, 'group chats'),
            path.join(dataDir, 'chats'),
            path.join(dataDir, 'characters'),
            path.join(dataDir, 'groups'),
            path.join(dataDir, 'settings'),
            path.join(dataDir, 'worlds'),
            path.join(dataDir, 'themes'),
            path.join(dataDir, 'NovelAI Settings'),
            path.join(dataDir, 'uploads')
        ];
        
        let dirCreated = false;
        
        for (const dir of requiredDirs) {
            if (!fs.existsSync(dir)) {
                try {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`[${user.username}] 创建必要子目录: ${dir}`);
                    dirCreated = true;
                } catch (error) {
                    console.error(`[${user.username}] 创建子目录失败: ${dir} - ${error.message}`);
                }
            }
        }
        
        // 检查并创建基本设置文件
        const settingsFile = path.join(dataDir, 'settings.json');
        let settingsCreated = false;
        
        if (!fs.existsSync(settingsFile)) {
            try {
                fs.writeFileSync(settingsFile, JSON.stringify({
                    "theme": "Default",
                    "fast_ui_mode": true,
                    "chat_display": "bubbles",
                    "last_migration": 0
                }, null, 4));
                console.log(`[${user.username}] 创建基本设置文件`);
                settingsCreated = true;
            } catch (error) {
                console.error(`[${user.username}] 创建设置文件失败: ${error.message}`);
            }
        }
        
        if (dirCreated || settingsCreated) {
            fixedCount++;
        } else {
            console.log(`[${user.username}] 数据目录结构已完整，无需修复`);
        }
    }
    
    console.log('\n====== 修复完成 ======');
    console.log(`总用户数: ${users.length}`);
    console.log(`已修复用户: ${fixedCount}`);
    console.log(`跳过用户（管理员）: ${skippedCount}`);
    console.log(`未处理用户: ${users.length - fixedCount - skippedCount}`);
}

// 执行修复
fixUserDataDirectories().catch(error => {
    console.error('修复过程出错:', error);
    process.exit(1);
});
