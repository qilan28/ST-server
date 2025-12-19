#!/usr/bin/env node

/**
 * 测试替换SillyTavern登录页标题的功能
 * 使用方法: node scripts/test-title-replacement.js <ST目录>
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { replaceSillyTavernTitle } from '../git-manager.js';
import { db } from '../database.js';
import { getSiteSettings } from '../database-site-settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令行参数
const args = process.argv.slice(2);
let stDir = null;

if (args.length > 0) {
    stDir = args[0];
} else {
    // 如果没有提供目录，则使用示例目录
    stDir = path.join(__dirname, '..', 'data', 'test', 'sillytavern');
}

// 确保路径是绝对路径
if (!path.isAbsolute(stDir)) {
    stDir = path.resolve(process.cwd(), stDir);
}

// 检查目录是否存在
if (!fs.existsSync(stDir)) {
    console.error(`❌ 指定的目录不存在: ${stDir}`);
    console.log('🔍 请提供一个有效的SillyTavern目录');
    process.exit(1);
}

// 检查是否为SillyTavern目录
const publicDir = path.join(stDir, 'public');
const loginHtmlPath = path.join(publicDir, 'login.html');

if (!fs.existsSync(publicDir)) {
    console.error(`❌ 指定的目录不是SillyTavern目录，未找到 public 文件夹: ${publicDir}`);
    process.exit(1);
}

if (!fs.existsSync(loginHtmlPath)) {
    console.error(`❌ SillyTavern登录页不存在: ${loginHtmlPath}`);
    process.exit(1);
}

// 获取站点设置
const settings = getSiteSettings(db);
const siteName = settings && settings.site_name ? settings.site_name : '【管理员后台设置网站名称】';

console.log('='.repeat(60));
console.log('🔍 测试SillyTavern标题替换');
console.log('='.repeat(60));
console.log(`📂 SillyTavern目录: ${stDir}`);
console.log(`📄 登录页文件: ${loginHtmlPath}`);
console.log(`🔤 当前站点名称: ${siteName}`);

// 显示原始标题
try {
    const originalContent = fs.readFileSync(loginHtmlPath, 'utf8');
    const titleMatch = originalContent.match(/<title>(.*?)<\/title>/);
    if (titleMatch && titleMatch[1]) {
        console.log(`📌 原始标题: ${titleMatch[1]}`);
    } else {
        console.log('⚠️ 无法找到原始标题标签');
    }
} catch (error) {
    console.error('❌ 读取文件失败:', error);
    process.exit(1);
}

// 执行替换
console.log('\n🔄 开始替换标题...');
replaceSillyTavernTitle(stDir, siteName)
    .then((success) => {
        if (success) {
            console.log('✅ 标题替换成功!');

            // 显示新标题
            try {
                const updatedContent = fs.readFileSync(loginHtmlPath, 'utf8');
                const newTitleMatch = updatedContent.match(/<title>(.*?)<\/title>/);
                if (newTitleMatch && newTitleMatch[1]) {
                    console.log(`📌 新标题: ${newTitleMatch[1]}`);
                } else {
                    console.log('⚠️ 无法找到新标题标签');
                }
            } catch (error) {
                console.error('❌ 读取更新后的文件失败:', error);
            }
        } else {
            console.error('❌ 标题替换失败!');
        }
    })
    .catch((error) => {
        console.error('❌ 替换过程中出错:', error);
    });
