#!/usr/bin/env node

/**
 * Nginx配置文件重复指令修复工具
 * 用于修复配置文件中的重复指令，特别是 proxy_pass_request_headers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`====================================`);
console.log(`  Nginx 配置重复指令修复工具`);
console.log(`====================================\n`);

// 配置文件路径
const configFile = path.join(__dirname, 'nginx/nginx.conf');
console.log(`目标配置文件: ${configFile}\n`);

// 检查文件是否存在
if (!fs.existsSync(configFile)) {
  console.error(`❌ 错误: 配置文件不存在!`);
  console.log(`尝试生成配置文件...`);
  
  try {
    const { generateNginxConfig } = await import('./scripts/generate-nginx-config.js');
    await generateNginxConfig();
    
    if (!fs.existsSync(configFile)) {
      console.error(`❌ 生成配置文件失败!`);
      process.exit(1);
    }
    console.log(`✅ 配置文件已生成`);
  } catch (error) {
    console.error(`❌ 生成配置文件失败:`, error.message);
    process.exit(1);
  }
}

// 创建备份
const backupFile = `${configFile}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.copyFileSync(configFile, backupFile);
console.log(`✅ 已创建备份: ${path.basename(backupFile)}\n`);

// 读取文件内容
let content = fs.readFileSync(configFile, 'utf8');

// 查找重复的 proxy_pass_request_headers 指令
console.log(`正在查找重复的 proxy_pass_request_headers 指令...`);
const matches = content.match(/proxy_pass_request_headers/g);
if (matches && matches.length > 1) {
  console.log(`发现 ${matches.length} 个 proxy_pass_request_headers 指令\n`);
} else {
  console.log(`未发现重复指令，但仍将继续修复\n`);
}

// 找到包含 proxy_pass_request_headers 的行和行号
const lines = content.split('\n');
const problematicLines = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('proxy_pass_request_headers')) {
    problematicLines.push({ lineNum: i + 1, line: lines[i].trim() });
  }
}

if (problematicLines.length > 0) {
  console.log(`包含 proxy_pass_request_headers 的行:`);
  problematicLines.forEach(line => {
    console.log(`  行 ${line.lineNum}: ${line.line}`);
  });
  console.log();
}

// 修复策略 1: 删除特定行的 proxy_pass_request_headers
// 定位到配置中第139行附近的内容
const targetLineIndex = 139 - 1; // 转为0-based索引
let fixed = false;

if (lines.length >= targetLineIndex && lines[targetLineIndex].includes('proxy_pass_request_headers')) {
  console.log(`✅ 找到并修复第139行的问题:`);
  console.log(`  原始: ${lines[targetLineIndex]}`);
  lines[targetLineIndex] = lines[targetLineIndex].replace(/proxy_pass_request_headers[^;]*;/g, '');
  console.log(`  修复: ${lines[targetLineIndex]}`);
  fixed = true;
}

// 修复策略 2: 修复所有 location 块中重复的 proxy_pass_request_headers 指令
console.log(`\n执行全局修复策略...`);
let blocksFixed = 0;
let insideBlock = false;
let currentBlock = [];
let blockStart = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // 检测块的开始和结束
  if (line.includes('location') && line.includes('{')) {
    insideBlock = true;
    blockStart = i;
    currentBlock = [];
  }
  
  if (insideBlock) {
    currentBlock.push({ index: i, line: line });
  }
  
  if (line.includes('}') && insideBlock) {
    insideBlock = false;
    
    // 检查当前块中是否有重复的 proxy_pass_request_headers
    const directiveIndices = currentBlock
      .map((item, idx) => item.line.includes('proxy_pass_request_headers') ? idx : -1)
      .filter(idx => idx !== -1);
    
    if (directiveIndices.length > 1) {
      // 保留第一个指令，删除其他的
      for (let j = 1; j < directiveIndices.length; j++) {
        const lineIndex = currentBlock[directiveIndices[j]].index;
        console.log(`删除重复指令: 行 ${lineIndex + 1}`);
        lines[lineIndex] = lines[lineIndex].replace(/proxy_pass_request_headers[^;]*;/g, '');
      }
      blocksFixed++;
      fixed = true;
    }
    
    currentBlock = [];
  }
}

if (blocksFixed > 0) {
  console.log(`✅ 修复了 ${blocksFixed} 个包含重复指令的块`);
}

// 写入修复后的内容
if (fixed) {
  const fixedContent = lines.join('\n');
  fs.writeFileSync(configFile, fixedContent, 'utf8');
  console.log(`\n✅ 配置文件已更新`);
} else {
  console.log(`\n⚠️ 未发现需要修复的问题，文件未更改`);
}

// 测试 Nginx 配置
console.log(`\n测试 Nginx 配置...`);
try {
  const { stdout, stderr } = await execAsync(`nginx -t -c "${configFile}"`);
  console.log(stdout || stderr);
  console.log(`\n✅ 配置测试通过!`);
  console.log(`\n现在您可以运行以下命令启动 Nginx:`);
  console.log(`nginx -c "${configFile}"`);
  console.log(`\n或者运行:`);
  console.log(`npm run ensure-nginx`);
} catch (error) {
  console.error(`\n❌ 配置测试失败:`);
  console.error(error.stderr || error.stdout);
  console.log(`\n您可能需要手动修复配置文件。`);
}

console.log(`\n====================================`);
console.log(`  修复完成`);
console.log(`====================================`);
