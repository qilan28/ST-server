const API_BASE = '/api';

// 设置 Cookie
function setCookie(name, value, days = 365) {
    try {
        // 方法 1：使用 max-age（更简单、更可靠）
        document.cookie = `${name}=${value}; path=/; max-age=${days * 24 * 60 * 60}`;
        
        // 验证是否设置成功
        if (document.cookie.includes(`${name}=`)) {
            console.log(`[Cookie] ✅ ${name} 设置成功`);
            return true;
        }
        
        // 方法 2：如果方法 1 失败，尝试添加 SameSite
        document.cookie = `${name}=${value}; path=/; max-age=${days * 24 * 60 * 60}; SameSite=Lax`;
        
        if (document.cookie.includes(`${name}=`)) {
            console.log(`[Cookie] ✅ ${name} 设置成功（方法2）`);
            return true;
        }
        
        console.error(`[Cookie] ❌ ${name} 设置失败 - 浏览器可能阻止了 Cookie`);
        console.error(`[Cookie] 💡 请检查浏览器地址栏左侧的锁图标 → Cookie 设置`);
        return false;
    } catch (error) {
        console.error(`[Cookie] ❌ 设置失败:`, error);
        return false;
    }
}

// 公告轮播相关变量
let loginAnnouncements = [];
let currentAnnouncementIndex = 0;
let announcementInterval = null;

// 加载登录页公告
async function loadLoginAnnouncements() {
    try {
        const response = await fetch(`${API_BASE}/announcements/login`);
        if (!response.ok) return;
        
        const data = await response.json();
        loginAnnouncements = data.announcements;
        
        if (loginAnnouncements && loginAnnouncements.length > 0) {
            document.getElementById('announcementContainer').style.display = 'block';
            showAnnouncement(0);
            
            // 如果有多个公告，显示控制按钮并启动自动轮播
            if (loginAnnouncements.length > 1) {
                document.getElementById('announcementControls').style.display = 'flex';
                createIndicators();
                startAutoPlay();
            }
        }
    } catch (error) {
        console.error('Load announcements error:', error);
    }
}

// 显示指定索引的公告
function showAnnouncement(index) {
    if (!loginAnnouncements || loginAnnouncements.length === 0) return;
    
    currentAnnouncementIndex = index;
    const announcement = loginAnnouncements[index];
    
    document.getElementById('announcementTitle').textContent = announcement.title;
    document.getElementById('announcementContent').textContent = announcement.content;
    
    const date = new Date(announcement.created_at);
    document.getElementById('announcementDate').textContent = `发布于 ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    updateIndicators();
}

// 创建指示器
function createIndicators() {
    const container = document.getElementById('announcementIndicators');
    container.innerHTML = '';
    
    for (let i = 0; i < loginAnnouncements.length; i++) {
        const dot = document.createElement('span');
        dot.style.cssText = 'width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.3s;';
        dot.onclick = () => {
            stopAutoPlay();
            showAnnouncement(i);
            startAutoPlay();
        };
        container.appendChild(dot);
    }
}

// 更新指示器
function updateIndicators() {
    const dots = document.getElementById('announcementIndicators').children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].style.background = i === currentAnnouncementIndex ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)';
        dots[i].style.transform = i === currentAnnouncementIndex ? 'scale(1.2)' : 'scale(1)';
    }
}

// 上一个公告
function prevAnnouncement() {
    stopAutoPlay();
    const newIndex = (currentAnnouncementIndex - 1 + loginAnnouncements.length) % loginAnnouncements.length;
    showAnnouncement(newIndex);
    startAutoPlay();
}

// 下一个公告
function nextAnnouncement() {
    stopAutoPlay();
    const newIndex = (currentAnnouncementIndex + 1) % loginAnnouncements.length;
    showAnnouncement(newIndex);
    startAutoPlay();
}

// 启动自动轮播
function startAutoPlay() {
    stopAutoPlay();
    if (loginAnnouncements.length > 1) {
        announcementInterval = setInterval(() => {
            const newIndex = (currentAnnouncementIndex + 1) % loginAnnouncements.length;
            showAnnouncement(newIndex);
        }, 5000); // 每5秒切换
    }
}

// 停止自动轮播
function stopAutoPlay() {
    if (announcementInterval) {
        clearInterval(announcementInterval);
        announcementInterval = null;
    }
}

// 页面加载完成后加载公告
document.addEventListener('DOMContentLoaded', () => {
    loadLoginAnnouncements();
});

// 切换到注册表单
function switchToRegister() {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('registerForm').classList.add('active');
    hideMessage();
}

// 切换到登录表单
function switchToLogin() {
    document.getElementById('registerForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    hideMessage();
}

// 显示消息
function showMessage(text, type = 'error') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message show ${type}`;
}

// 隐藏消息
function hideMessage() {
    const messageEl = document.getElementById('message');
    messageEl.className = 'message';
}

// 处理登录
async function handleLogin(event) {
    event.preventDefault();
    hideMessage();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('\n========== [前端] 登录成功 ==========');
            
            // 保存token到 localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            console.log('[前端] ✅ Token 已保存到 localStorage');
            console.log('[前端] 👤 用户:', data.user.username);
            
            // 同时设置 cookie，供 Nginx 权限验证使用
            setCookie('st_token', data.token);
            console.log('[前端] ✅ st_token cookie 已设置');
            console.log('[前端] 🍪 当前所有 Cookies:', document.cookie);
            console.log('==========================================\n');
            
            showMessage('登录成功！正在跳转...', 'success');
            
            // 跳转到控制台
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showMessage(data.error || '登录失败，请重试');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('网络错误，请检查连接');
    }
}

// 更新QQ头像
function updateQQAvatar() {
    const qqInput = document.getElementById('registerUsername');
    const qqNumber = qqInput.value.trim();
    const avatarContainer = document.getElementById('qqAvatarContainer');
    const qqAvatar = document.getElementById('qqAvatar');
    
    // 验证QQ号格式 (5-13位纯数字)
    if (/^[1-9]\d{4,12}$/.test(qqNumber)) {
        // 显示QQ头像
        const tempImg = new Image();
        tempImg.onerror = function() {
            console.log(`头像加载失败: ${qqNumber}`);
            // 使用默认头像
            qqAvatar.src = '/images/default-avatar.png';
        };
        tempImg.onload = function() {
            qqAvatar.src = tempImg.src;
        };
        tempImg.src = `/api/proxy/qq-avatar/${qqNumber}`;
        avatarContainer.style.display = 'block';
    } else {
        // 隐藏头像容器
        avatarContainer.style.display = 'none';
    }
}

// 处理注册
async function handleRegister(event) {
    event.preventDefault();
    hideMessage();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    // QQ号格式验证 (5-13位纯数字)
    if (!/^[1-9]\d{4,12}$/.test(username)) {
        showMessage('请输入正确的QQ号 (5-13位纯数字)');
        return;
    }
    
    // 验证密码确认
    if (password !== passwordConfirm) {
        showMessage('两次输入的密码不一致');
        return;
    }
    
    // 使用QQ邮箱作为邮箱地址
    const email = `${username}@qq.com`;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 保存token
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.username);
            
            // 同时设置 cookie，供 Nginx 权限验证使用
            setCookie('st_token', data.token);
            
            showMessage('注册成功！正在跳转...', 'success');
            
            // 跳转到控制台
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showMessage(data.error || '注册失败，请重试');
        }
    } catch (error) {
        console.error('Register error:', error);
        showMessage('网络错误，请检查连接');
    }
}

// 密码显示与隐藏切换函数
function togglePasswordVisibility(inputId, toggleElement) {
    const passwordInput = document.getElementById(inputId);
    const eyeIcon = toggleElement.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        // 添加关闭的眼睛图标（斜线）
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2"></line>
        `;
    } else {
        passwordInput.type = 'password';
        // 恢复正常的眼睛图标
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

// 检查是否已登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (token) {
        // 如果已登录，跳转到控制台
        window.location.href = '/dashboard.html';
    }
}

// 页面加载时检查登录状态
checkAuth();
