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
const indexHtmlPath = path.join(publicDir, 'index.html');

if (!fs.existsSync(publicDir)) {
    console.error(`❌ 指定的目录不是SillyTavern目录，未找到 public 文件夹: ${publicDir}`);
    process.exit(1);
}

let htmlFilesFound = false;

// 检查 login.html 和 index.html
if (fs.existsSync(loginHtmlPath)) {
    console.log(`✅ 找到 login.html: ${loginHtmlPath}`);
    htmlFilesFound = true;
} else {
    console.warn(`⚠️ SillyTavern login.html 不存在: ${loginHtmlPath}`);
}

if (fs.existsSync(indexHtmlPath)) {
    console.log(`✅ 找到 index.html: ${indexHtmlPath}`);
    htmlFilesFound = true;
} else {
    console.warn(`⚠️ SillyTavern index.html 不存在: ${indexHtmlPath}`);
}

if (!htmlFilesFound) {
    console.error('❌ 未找到任何要替换的HTML文件');
    process.exit(1);
}

// 获取站点设置
const settings = getSiteSettings(db);
const siteName = settings && settings.site_name ? settings.site_name : '【管理员后台设置网站名称】';

console.log('='.repeat(60));
console.log('🔍 测试SillyTavern标题替换');
console.log('='.repeat(60));
console.log(`📂 SillyTavern目录: ${stDir}`);
console.log(`🔤 当前站点名称: ${siteName}`);

// 显示所有文件的原始标题
console.log('\n原始标题信息:');

// 检查并显示 login.html 的标题
if (fs.existsSync(loginHtmlPath)) {
    try {
        const loginContent = fs.readFileSync(loginHtmlPath, 'utf8');
        const loginTitleMatch = loginContent.match(/<title>(.*?)<\/title>/);
        if (loginTitleMatch && loginTitleMatch[1]) {
            console.log(`  登录页(login.html): ${loginTitleMatch[1]}`);
        } else {
            console.log('  登录页(login.html): ⚠️ 无法找到标题标签');
        }
    } catch (error) {
        console.error(`  登录页(login.html): ❌ 读取失败 - ${error.message}`);
    }
}

// 检查并显示 index.html 的标题
if (fs.existsSync(indexHtmlPath)) {
    try {
        const indexContent = fs.readFileSync(indexHtmlPath, 'utf8');
        const indexTitleMatch = indexContent.match(/<title>(.*?)<\/title>/);
        if (indexTitleMatch && indexTitleMatch[1]) {
            console.log(`  主页面(index.html): ${indexTitleMatch[1]}`);
        } else {
            console.log('  主页面(index.html): ⚠️ 无法找到标题标签');
        }
    } catch (error) {
        console.error(`  主页面(index.html): ❌ 读取失败 - ${error.message}`);
    }
}

// 执行替换
console.log('\n🔄 开始替换标题...');
replaceSillyTavernTitle(stDir, siteName)
    .then((success) => {
        if (success) {
            console.log('✅ 标题替换成功!');

            // 显示更新后的标题
            console.log('\n更新后的标题信息:');
            
            // 检查并显示 login.html 的更新标题
            if (fs.existsSync(loginHtmlPath)) {
                try {
                    const updatedLoginContent = fs.readFileSync(loginHtmlPath, 'utf8');
                    const updatedLoginTitleMatch = updatedLoginContent.match(/<title>(.*?)<\/title>/);
                    if (updatedLoginTitleMatch && updatedLoginTitleMatch[1]) {
                        console.log(`  登录页(login.html): ${updatedLoginTitleMatch[1]}`);
                    } else {
                        console.log('  登录页(login.html): ⚠️ 无法找到标题标签');
                    }
                } catch (error) {
                    console.error(`  登录页(login.html): ❌ 读取失败 - ${error.message}`);
                }
            }

            // 检查并显示 index.html 的更新标题
            if (fs.existsSync(indexHtmlPath)) {
                try {
                    const updatedIndexContent = fs.readFileSync(indexHtmlPath, 'utf8');
                    const updatedIndexTitleMatch = updatedIndexContent.match(/<title>(.*?)<\/title>/);
                    if (updatedIndexTitleMatch && updatedIndexTitleMatch[1]) {
                        console.log(`  主页面(index.html): ${updatedIndexTitleMatch[1]}`);
                    } else {
                        console.log('  主页面(index.html): ⚠️ 无法找到标题标签');
                    }
                } catch (error) {
                    console.error(`  主页面(index.html): ❌ 读取失败 - ${error.message}`);
                }
            }
        } else {
            console.error('❌ 标题替换失败!');
        }
    })
    .catch((error) => {
        console.error('❌ 替换过程中出错:', error);
    });
