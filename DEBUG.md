# 调试模式使用说明

本项目已增强调试功能，帮助开发者快速定位和修复问题。调试功能不会影响正常使用，但会在后台收集和显示调试信息。

## 功能概述

### 1. 调试覆盖层 (DebugOverlay)
- 显示API调用统计、性能指标和错误信息
- 按下 `Ctrl+Shift+O` 可以切换显示/隐藏
- 提供内存使用情况和活动服务数量监控

### 2. 调试控制台 (DebugConsole)
- 显示详细的调试日志，包括错误、警告和信息
- 按下 `Ctrl+Shift+D` 可以切换显示/隐藏
- 支持按级别过滤日志（ALL、ERROR、WARN、INFO）
- 提供清除日志功能

### 3. 全局错误处理
- 自动捕获所有未处理的JavaScript错误
- 监控未处理的Promise拒绝
- 重写console.error和console.warn，将错误和警告记录到调试面板
- 监控网络请求错误
- 监控内存使用情况，当内存使用超过90%时发出警告

### 4. 增强的API服务 (ApiService)
- 添加了API密钥、模型名称和API URL的检查
- 详细的请求和响应日志记录
- 更好的错误处理和错误信息显示
- 将错误信息记录到调试面板

### 5. 增强的聊天服务 (ChatService)
- 添加了消息和系统提示的检查
- 详细的生成过程日志记录
- Token数量和生成时间统计
- 更好的错误处理和错误信息显示

## 使用方法

### 查看调试信息
1. 按下 `Ctrl+Shift+O` 打开调试覆盖层，查看API统计和性能指标
2. 按下 `Ctrl+Shift+D` 打开调试控制台，查看详细日志

### 过滤日志
在调试控制台中，点击顶部的过滤按钮（ALL、ERROR、WARN、INFO）可以按级别过滤日志。

### 清除日志
在调试控制台中，点击"Clear"按钮可以清除所有日志。

## 开发者提示

### 添加自定义调试信息
在代码中，可以使用以下方式添加自定义调试信息：

```javascript
// 添加错误信息
if (window.debug) {
    window.debug.set('ERROR', 'Category', 'Error message');
}

// 添加警告信息
if (window.debug) {
    window.debug.set('WARN', 'Category', 'Warning message');
}

// 添加信息
if (window.debug) {
    window.debug.set('INFO', 'Category', 'Info message');
}
```

### 添加自定义错误处理
可以使用全局错误处理程序捕获特定错误：

```javascript
window.addEventListener('error', function(event) {
    // 处理特定错误
    if (event.error.message.includes('specific error')) {
        // 自定义处理逻辑
    }
});
```

### 监控特定网络请求
可以使用重写的fetch函数监控特定网络请求：

```javascript
// 原始fetch函数仍然可用
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = args[0];
    if (url.includes('specific-api-endpoint')) {
        console.log('[Custom] Monitoring specific API call:', url);
    }
    return originalFetch.apply(this, args);
};
```

## 注意事项

1. 调试功能仅在前端运行，不会发送任何数据到服务器。
2. 调试信息仅在浏览器控制台和调试面板中显示，不会影响用户体验。
3. 在生产环境中，可以通过删除或注释掉相关脚本来禁用调试功能。
4. 内存监控功能仅在支持Performance API的浏览器中可用。

## 故障排除

如果调试功能无法正常工作，请检查：

1. 确保所有调试脚本已正确加载
2. 检查浏览器控制台是否有脚本加载错误
3. 确保没有其他脚本覆盖了window.debug对象
4. 尝试清除浏览器缓存并重新加载页面

## 反馈

如果您在使用调试功能时遇到任何问题或有改进建议，请提交Issue或Pull Request。