/**
 * 美化版确认对话框
 * 替代原生的 confirm() 函数
 */

// 创建模态对话框 DOM
function createModalDOM() {
    const modalHTML = `
        <div id="customModal" class="custom-modal">
            <div class="modal-overlay"></div>
            <div class="modal-container">
                <div class="modal-header">
                    <h3 id="modalTitle" class="modal-title">确认操作</h3>
                </div>
                <div class="modal-body">
                    <p id="modalMessage" class="modal-message"></p>
                </div>
                <div class="modal-footer">
                    <button id="modalCancelBtn" class="modal-btn modal-btn-cancel">取消</button>
                    <button id="modalConfirmBtn" class="modal-btn modal-btn-confirm">确定</button>
                </div>
            </div>
        </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);
}

// 显示确认对话框
function showConfirm(message, title = '确认操作', options = {}) {
    return new Promise((resolve) => {
        // 确保 modal 存在
        let modal = document.getElementById('customModal');
        if (!modal) {
            createModalDOM();
            modal = document.getElementById('customModal');
        }
        
        // 设置内容
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        
        modalTitle.textContent = title;
        // 保留换行符格式
        modalMessage.innerHTML = message.replace(/\n/g, '<br>');
        
        // 自定义按钮文本
        if (options.confirmText) {
            confirmBtn.textContent = options.confirmText;
        } else {
            confirmBtn.textContent = '确定';
        }
        
        if (options.cancelText) {
            cancelBtn.textContent = options.cancelText;
        } else {
            cancelBtn.textContent = '取消';
        }
        
        // 自定义按钮样式
        if (options.type === 'danger') {
            confirmBtn.classList.add('modal-btn-danger');
        } else {
            confirmBtn.classList.remove('modal-btn-danger');
        }
        
        // 显示模态框
        modal.classList.add('show');
        
        // 处理确认
        const handleConfirm = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(true);
        };
        
        // 处理取消
        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(false);
        };
        
        // 清理事件监听器
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleOverlayClick);
            document.removeEventListener('keydown', handleEscape);
        };
        
        // 点击遮罩层关闭
        const handleOverlayClick = (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                handleCancel();
            }
        };
        
        // ESC 键关闭
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        
        // 绑定事件
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleEscape);
        
        // 自动聚焦确认按钮
        setTimeout(() => {
            if (options.type === 'danger') {
                cancelBtn.focus();
            } else {
                confirmBtn.focus();
            }
        }, 100);
    });
}

// 导出为全局函数（兼容性）
window.showConfirm = showConfirm;

// 页面加载完成后创建 DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createModalDOM);
} else {
    createModalDOM();
}
