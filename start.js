#!/usr/bin/env node

/**
 * Claude Relay Service - 一键启动脚本
 *
 * 功能：
 * 1. 检查 Node.js 版本
 * 2. 检查依赖是否安装
 * 3. 自动安装缺失依赖
 * 4. 以生产环境启动服务
 * 5. 错误处理和日志记录
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 检查 Node.js 版本
function checkNodeVersion() {
  logStep(1, '检查 Node.js 版本...');

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  logInfo(`当前 Node.js 版本: ${nodeVersion}`);

  if (majorVersion < 18) {
    logError(`Node.js 版本过低！需要 18.0.0 或更高版本，当前版本: ${nodeVersion}`);
    process.exit(1);
  }

  logSuccess('Node.js 版本检查通过');
  return true;
}

// 检查依赖是否安装
function checkDependencies() {
  logStep(2, '检查项目依赖...');

  const packageJsonPath = path.join(__dirname, 'package.json');
  const nodeModulesPath = path.join(__dirname, 'node_modules');

  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json 文件不存在！');
    process.exit(1);
  }

  // 检查 node_modules 是否存在
  if (!fs.existsSync(nodeModulesPath)) {
    logWarning('node_modules 目录不存在，需要安装依赖');
    return false;
  }

  // 检查关键依赖是否存在
  const criticalDeps = ['express', 'winston', 'ioredis'];
  const missingDeps = [];

  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  });

  if (missingDeps.length > 0) {
    logWarning(`关键依赖缺失: ${missingDeps.join(', ')}`);
    return false;
  }

  // 检查 package-lock.json 是否存在
  const packageLockPath = path.join(__dirname, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    const nodeModulesMtime = fs.statSync(nodeModulesPath).mtime;
    const packageLockMtime = fs.statSync(packageLockPath).mtime;

    if (nodeModulesMtime < packageLockMtime) {
      logWarning('package-lock.json 比 node_modules 更新，需要重新安装依赖');
      return false;
    }
  }

  logSuccess('依赖检查通过');
  return true;
}

// 安装依赖
function installDependencies() {
  logStep(3, '安装项目依赖...');

  try {
    logInfo('正在执行 npm install...');

    // 使用 spawn 执行 npm install，以便显示实时输出
    const npmInstall = spawn('npm', ['install'], {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve, reject) => {
      npmInstall.on('close', (code) => {
        if (code === 0) {
          logSuccess('依赖安装完成');
          resolve(true);
        } else {
          logError(`依赖安装失败，退出码: ${code}`);
          reject(new Error(`npm install failed with code ${code}`));
        }
      });

      npmInstall.on('error', (error) => {
        logError(`依赖安装出错: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    logError(`依赖安装失败: ${error.message}`);
    throw error;
  }
}

// 检查环境配置
function checkEnvironment() {
  logStep(4, '检查环境配置...');

  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      logWarning('.env 文件不存在，正在从 .env.example 复制...');
      fs.copyFileSync(envExamplePath, envPath);
      logInfo('已创建 .env 文件，请根据需要修改配置');
    } else {
      logWarning('.env 文件不存在，将使用默认配置');
    }
  } else {
    logSuccess('.env 文件存在');
  }

  // 检查配置目录
  const configDir = path.join(__dirname, 'config');
  const configExamplePath = path.join(configDir, 'config.example.js');
  const configPath = path.join(configDir, 'config.js');

  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(configExamplePath)) {
      logWarning('config.js 文件不存在，正在从 config.example.js 复制...');
      fs.copyFileSync(configExamplePath, configPath);
      logInfo('已创建 config.js 文件');
    }
  } else {
    logSuccess('config.js 文件存在');
  }

  return true;
}

// 检查 Redis 连接
function checkRedisConnection() {
  logStep(5, '检查 Redis 连接...');

  try {
    const Redis = require('ioredis');
    const configPath = path.join(__dirname, '.env');

    // 简单解析 .env 文件
    let redisHost = 'localhost';
    let redisPort = 6379;
    let redisPassword = '';

    if (fs.existsSync(configPath)) {
      const envContent = fs.readFileSync(configPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          switch (key.trim()) {
            case 'REDIS_HOST':
              redisHost = value;
              break;
            case 'REDIS_PORT':
              redisPort = parseInt(value);
              break;
            case 'REDIS_PASSWORD':
              redisPassword = value;
              break;
          }
        }
      });
    }

    const redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      connectTimeout: 5000,
      lazyConnect: true
    });

    return new Promise((resolve, reject) => {
      redis.connect((err) => {
        if (err) {
          logWarning(`Redis 连接失败: ${err.message}`);
          logWarning('请确保 Redis 服务正在运行');
          resolve(false);
        } else {
          logSuccess('Redis 连接成功');
          redis.disconnect();
          resolve(true);
        }
      });

      redis.on('error', () => {
        // 忽略连接错误，在回调中处理
      });
    });
  } catch (error) {
    logWarning(`Redis 检查失败: ${error.message}`);
    return false;
  }
}

// 启动服务
function startProductionServer() {
  logStep(6, '启动生产环境服务...');

  // 设置生产环境变量
  process.env.NODE_ENV = 'production';

  logInfo('以生产模式启动 Claude Relay Service...');
  logInfo('使用 Ctrl+C 停止服务');
  log('');
  log('='.repeat(60), 'bright');
  log('🚀 Claude Relay Service 正在启动...', 'bright');
  log('='.repeat(60), 'bright');
  log('');

  try {
    // 启动服务
    const serverProcess = spawn('node', ['src/app.js'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    serverProcess.on('close', (code) => {
      log('');
      log('='.repeat(60), 'bright');
      if (code === 0) {
        logSuccess('Claude Relay Service 正常退出');
      } else {
        logError(`Claude Relay Service 异常退出，退出码: ${code}`);
      }
      log('='.repeat(60), 'bright');
      process.exit(code);
    });

    serverProcess.on('error', (error) => {
      logError(`服务启动失败: ${error.message}`);
      process.exit(1);
    });

    // 处理进程信号
    process.on('SIGINT', () => {
      logInfo('\n收到停止信号，正在关闭服务...');
      serverProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      logInfo('\n收到终止信号，正在关闭服务...');
      serverProcess.kill('SIGTERM');
    });

  } catch (error) {
    logError(`启动服务失败: ${error.message}`);
    process.exit(1);
  }
}

// 主函数
async function main() {
  console.log('');
  log('='.repeat(60), 'bright');
  log('🚀 Claude Relay Service - 一键启动脚本', 'bright');
  log('='.repeat(60), 'bright');
  console.log('');

  try {
    // 1. 检查 Node.js 版本
    checkNodeVersion();

    // 2. 检查依赖
    const depsOk = checkDependencies();
    if (!depsOk) {
      // 3. 安装依赖
      await installDependencies();
    }

    // 4. 检查环境配置
    checkEnvironment();

    // 5. 检查 Redis 连接（可选，不影响启动）
    await checkRedisConnection();

    // 6. 启动服务
    startProductionServer();

  } catch (error) {
    logError(`启动失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  main,
  checkNodeVersion,
  checkDependencies,
  installDependencies,
  checkEnvironment,
  checkRedisConnection,
  startProductionServer
};