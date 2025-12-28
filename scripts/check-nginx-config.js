#!/usr/bin/env node

/**
 * Nginx 配置文件检查工具
 * 用于检查配置文件中的重复指令和语法错误
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查指令是否重复
async function checkDuplicateDirectives(configFile) {
  try {
    console.log(`====================================`);
    console.log(`Nginx 配置文件检查工具`);
    console.log(`====================================\n`);
    
    console.log(`检查文件: ${configFile}\n`);
    
    if (!fs.existsSync(configFile)) {
      console.error(`错误: 文件不存在: ${configFile}`);
      return;
    }
    
    const content = fs.readFileSync(configFile, 'utf-8');
    const lines = content.split('\n');
    
    // 需要检查的指令列表
    const directivesToCheck = [
      'proxy_pass_request_headers',
      'proxy_pass_request_body',
      'proxy_buffering',
      'proxy_buffer_size'
    ];
    
    // 在每个大括号块中检查重复指令
    let openBraces = 0;
    let currentBlock = [];
    let blockStart = 0;
    let duplicatesFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // 统计花括号
      const openCount = (line.match(/{/g) || []).length;
      const closeCount = (line.match(/}/g) || []).length;
      
      if (openCount > 0) {
        if (openBraces === 0) {
          blockStart = lineNum;
          currentBlock = [];
        }
        openBraces += openCount;
      }
      
      // 检查此行是否包含需要检查的指令
      for (const directive of directivesToCheck) {
        if (line.startsWith(directive)) {
          currentBlock.push({ lineNum, directive, line });
        }
      }
      
      if (closeCount > 0) {
        openBraces -= closeCount;
        
        // 当一个块结束时，检查是否有重复指令
        if (openBraces === 0) {
          const directives = {};
          for (const item of currentBlock) {
            if (!directives[item.directive]) {
              directives[item.directive] = [];
            }
            directives[item.directive].push(item);
          }
          
          // 检查重复
          for (const [directive, items] of Object.entries(directives)) {
            if (items.length > 1) {
              duplicatesFound = true;
              console.log(`警告: 在行 ${blockStart}-${lineNum} 的块中发现重复指令: ${directive}`);
              items.forEach(item => {
                console.log(`  - 行 ${item.lineNum}: ${item.line}`);
              });
              console.log();
            }
          }
          
          currentBlock = [];
        }
      }
    }
    
    if (!duplicatesFound) {
      console.log(`✅ 未发现重复指令`);
    }
    
    // 使用 nginx -t 进行语法检查
    try {
      console.log(`\n执行 nginx -t 语法检查...`);
      const { stdout, stderr } = await execAsync(`nginx -t -c "${configFile}"`);
      console.log(stdout || stderr);
      console.log(`✅ 语法检查通过`);
    } catch (error) {
      console.error(`❌ 语法检查失败:`);
      console.error(error.stdout || error.stderr);
      
      // 尝试找出问题所在的行
      const errorMatch = (error.stderr || error.stdout).match(/in .+:(\d+)/);
      if (errorMatch) {
        const errorLine = parseInt(errorMatch[1]);
        console.log(`\n问题可能在第 ${errorLine} 行附近:`);
        
        // 显示错误行周围的代码
        const start = Math.max(1, errorLine - 5);
        const end = Math.min(lines.length, errorLine + 5);
        
        for (let i = start - 1; i < end; i++) {
          const prefix = i + 1 === errorLine ? '>>> ' : '    ';
          console.log(`${prefix}${i + 1}: ${lines[i]}`);
        }
      }
    }
    
    console.log(`\n====================================`);
    console.log(`检查完成`);
    console.log(`====================================`);
    
  } catch (error) {
    console.error(`错误:`, error);
  }
}

// 修复配置文件中的重复指令
function fixDuplicateDirectives(configFile) {
  if (!fs.existsSync(configFile)) {
    console.error(`错误: 文件不存在: ${configFile}`);
    return;
  }
  
  console.log(`备份并修复配置文件: ${configFile}`);
  
  // 创建备份
  const backupFile = `${configFile}.backup`;
  fs.copyFileSync(configFile, backupFile);
  console.log(`已创建备份: ${backupFile}`);
  
  // 读取文件
  let content = fs.readFileSync(configFile, 'utf-8');
  
  // 修复重复的 proxy_pass_request_headers 指令
  // 这种情况通常是在 location 块中出现重复
  const regex = /(location[^{]*{[^}]*)(proxy_pass_request_headers[^;]*;)([^}]*\1)/g;
  content = content.replace(regex, '$1$3');
  
  // 写入修复后的文件
  fs.writeFileSync(configFile, content, 'utf-8');
  console.log(`已修复可能的重复指令`);
}

// 执行
const configFile = path.join(__dirname, '../nginx/nginx.conf');
checkDuplicateDirectives(configFile).then(() => {
  console.log('\n是否要尝试自动修复重复指令? (y/n)');
  process.stdin.once('data', (data) => {
    const answer = data.toString().trim().toLowerCase();
    if (answer === 'y') {
      fixDuplicateDirectives(configFile);
      console.log('修复完成，请重新运行检查工具验证');
    }
    process.exit(0);
  });
});
