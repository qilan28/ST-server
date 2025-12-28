/**
 * 更灵活的模态框系统
 * 与modal.js配合使用
 */

// 通用模态框函数
function showModal(options = {}) {
    const { title, content, type, buttons } = options;
    
    // 检测是否存在原生对话框函数，避免循环调用
    // 使用原生的modal.js中的函数，但通过其替代名称访问
    const modalConfirmFn = window.originalModalConfirm || window.showConfirm;
    const modalAlertFn = window.originalModalAlert || window.showAlert;
    
    if (!modalConfirmFn || !modalAlertFn) {
        // 原生对话框函数未找到，使用默认对话框
        if (buttons && buttons.length >= 1) {
            return confirm(content) ? 
                (buttons[1] && typeof buttons[1].onClick === 'function' ? buttons[1].onClick() : true) : 
                (buttons[0] && typeof buttons[0].onClick === 'function' ? buttons[0].onClick() : false);
        } else {
            alert(content);
            return Promise.resolve();
        }
    }
    
    // 使用已有的modalConfirmFn或modalAlertFn
    if (buttons && buttons.length === 2) {
        // 双按钮模式
        return modalConfirmFn(
            content,
            title,
            {
                type: type,
                confirmText: buttons[1].text,
                cancelText: buttons[0].text
            }
        ).then(result => {
            if (result && typeof buttons[1].onClick === 'function') {
                return buttons[1].onClick();
            } else if (!result && typeof buttons[0].onClick === 'function') {
                return buttons[0].onClick();
            }
            return result;
        });
    } else {
        // 单按钮模式
        return modalAlertFn(content, title, type);
    }
}

// 将showModal添加到全局
window.showModal = showModal;
