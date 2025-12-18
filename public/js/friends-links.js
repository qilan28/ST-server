// 加载友情链接
async function loadFriendsLinks() {
    try {
        const response = await fetch('/api/friends');
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            displayFriendsLinks(data.data);
        } else {
            // 如果没有友情链接，隐藏整个友情链接区域
            document.getElementById('friendsLinksContainer').style.display = 'none';
        }
    } catch (error) {
        console.error('加载友情链接失败:', error);
        document.getElementById('friendsLinksContainer').style.display = 'none';
    }
}

// 显示友情链接
function displayFriendsLinks(links) {
    const friendsLinksElement = document.getElementById('friendsLinks');
    if (!friendsLinksElement) return;
    
    friendsLinksElement.innerHTML = '';
    
    links.forEach(link => {
        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.className = 'friend-link';
        
        if (link.logo) {
            const logoImg = document.createElement('img');
            logoImg.src = link.logo;
            logoImg.alt = link.name;
            logoImg.className = 'friend-logo';
            linkElement.appendChild(logoImg);
        }
        
        const nameElement = document.createElement('span');
        nameElement.textContent = link.name;
        linkElement.appendChild(nameElement);
        
        // 如果有描述，添加为title提示
        if (link.description) {
            linkElement.title = link.description;
        }
        
        friendsLinksElement.appendChild(linkElement);
    });
    
    // 显示友情链接区域
    document.getElementById('friendsLinksContainer').style.display = 'block';
}

// 页面加载完成后加载友情链接
document.addEventListener('DOMContentLoaded', loadFriendsLinks);
