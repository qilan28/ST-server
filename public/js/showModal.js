/**
 * 更灵活的模态框系统
 * 与modal.js配合使用
 */

// 通用模态框函数
function showModal(options = {}) {
    const { title, content, type, buttons } = options;
    
    // 使用已有的showConfirm或showAlert
    if (buttons && buttons.length === 2) {
        // 双按钮模式，使用showConfirm
        return showConfirm(
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
        // 单按钮模式，使用showAlert
        return showAlert(content, title, type);
    }
}

// 将showModal添加到全局
window.showModal = showModal;
