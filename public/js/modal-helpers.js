/**
 * 模态框辅助函数
 * 提供显示和隐藏模态框的函数
 */

// 显示模态框
function showModalById(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    } else {
        console.error(`模态框 ${modalId} 未找到`);
    }
}

// 隐藏模态框
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    } else {
        console.error(`模态框 ${modalId} 未找到`);
    }
}

// 导出到全局
window.showModalById = showModalById;
window.hideModal = hideModal;

console.log('模态框辅助函数已加载');
