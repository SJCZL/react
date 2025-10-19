import { useEffect } from 'react';

function HelpSystem({ onClose }) {
    useEffect(() => {
        // 点击外部关闭弹窗
        const handleClickOutside = (e) => {
            if (e.target.id === 'help-popup') {
                onClose();
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [onClose]);

    return (
        <div id="help-popup" className="help-popup">
            <div className="help-popup-content">
                <div className="help-popup-header">
                    <h3>快捷键和操作技巧</h3>
                    <span id="close-help" className="close-popup" onClick={onClose}>
                        &times;
                    </span>
                </div>
                <div className="help-popup-body">
                    <div style={{padding: '20px'}}>
                        <h4>快捷键：</h4>
                        <ul>
                            <li><kbd>Ctrl</kbd> + <kbd>Enter</kbd> - 发送消息</li>
                            <li><kbd>Ctrl</kbd> + <kbd>L</kbd> - 清除聊天记录</li>
                            <li><kbd>Ctrl</kbd> + <kbd>S</kbd> - 保存聊天记录</li>
                            <li><kbd>Ctrl</kbd> + <kbd>O</kbd> - 加载聊天记录</li>
                        </ul>
                        
                        <h4>操作技巧：</h4>
                        <ul>
                            <li>在消息上双击可以查看详细信息</li>
                            <li>使用侧边栏开关控制自动响应设置</li>
                            <li>YAML编辑器支持语法高亮和自动补全</li>
                            <li>拖拽文件到聊天区域可以快速加载预设</li>
                        </ul>
                        
                        <h4>标签页功能：</h4>
                        <ul>
                            <li><strong>主对话</strong> - 基础聊天和自动响应测试</li>
                            <li><strong>待测试prompt配置</strong> - YAML编辑和提示词生成</li>
                            <li><strong>并行测试</strong> - 多模型并行对比测试</li>
                            <li><strong>预设管理</strong> - 保存和加载聊天配置</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HelpSystem;