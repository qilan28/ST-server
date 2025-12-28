#!/usr/bin/env node

/**
 * 确保 Nginx 配置正确加载脚本
 * 在启动实例前自动加载正确的 Nginx 配置
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { getNginxConfigPath, testNginxConfig, startNginx } from '../utils/nginx-reload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

async function ensureNginxConfig() {
  console.log('====================================');
  console.log('确保 Nginx 正确配置已加载');
  console.log('====================================');

  try {
    // 获取正确的配置路径
    const configPath = getNginxConfigPath();
    console.log(`[Nginx] 使用配置文件: ${configPath}`);

    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      console.error(`[Nginx] ❌ 错误: 配置文件不存在: ${configPath}`);
      console.log('[Nginx] 尝试生成配置文件...');
      
      try {
        // 尝试生成配置文件
        const generateScript = path.join(__dirname, 'generate-nginx-config.js');
        if (fs.existsSync(generateScript)) {
          console.log('[Nginx] 执行配置生成脚本...');
          await execAsync(`node "${generateScript}"`);
          console.log('[Nginx] ✅ 配置文件已生成');
        } else {
          throw new Error('配置生成脚本不存在');
        }
      } catch (genError) {
        console.error(`[Nginx] ❌ 生成配置失败: ${genError.message}`);
        process.exit(1);
      }
    }

    // 再次检查配置文件
    if (!fs.existsSync(configPath)) {
      console.error(`[Nginx] ❌ 致命错误: 无法找到或生成配置文件`);
      process.exit(1);
    }

    // 测试配置是否正确
    console.log('[Nginx] 测试配置...');
    const testResult = await testNginxConfig(configPath);
    
    if (!testResult.success && !testResult.simulated) {
      console.error(`[Nginx] ❌ 配置测试失败: ${testResult.error}`);
      process.exit(1);
    }
    
    console.log('[Nginx] 配置测试通过');

    // 检查 Nginx 状态并确保使用正确的配置文件
    console.log('[Nginx] 正在检查 Nginx 状态...');
    
    try {
      // 首先尝试停止 Nginx
      try {
        await execAsync('nginx -s stop');
        console.log('[Nginx] Nginx 已停止');
      } catch (stopError) {
        // 如果没有运行，会有错误，忽略它
        console.log('[Nginx] Nginx 可能未运行');
      }

      // 等待一秒确保完全停止
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 使用我们的配置启动 Nginx
      console.log('[Nginx] 使用自定义配置启动 Nginx...');
      await execAsync(`nginx -c "${configPath}"`);
      console.log('[Nginx] ✅ Nginx 已使用正确配置启动');
      
      // 验证 Nginx 是否运行
      const { stdout } = await execAsync('ps aux | grep nginx | grep -v grep');
      if (stdout.trim().length > 0) {
        console.log('[Nginx] ✅ 确认 Nginx 正在运行');
      } else {
        throw new Error('启动后无法检测到 Nginx 进程');
      }

      console.log('====================================');
      console.log('[Nginx] ✅ Nginx 配置已正确加载');
      console.log('====================================');

    } catch (error) {
      console.error(`[Nginx] ❌ 启动 Nginx 失败: ${error.message}`);
      console.error('[Nginx] 请尝试手动运行: nginx -c ' + configPath);
      console.error('====================================');
    }
  } catch (error) {
    console.error(`[Nginx] ❌ 错误: ${error.message}`);
    console.error('====================================');
    process.exit(1);
  }
}

// 执行主函数
ensureNginxConfig();
