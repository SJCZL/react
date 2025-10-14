/**
 * 全局错误处理程序
 * 用于捕获并记录所有未处理的错误
 */

// 全局错误处理
window.addEventListener('error', function(event) {
    console.error('[Global Error Handler]', event.error);
    
    // 如果调试面板可用，记录错误信息
    if (window.debug) {
        window.debug.set('ERROR', 'Global', `${event.error.name}: ${event.error.message}`);
        window.debug.set('ERROR', 'Stack', event.error.stack ? event.error.stack.substring(0, 200) + '...' : 'No stack trace');
    }
    
    // 可以在这里添加更多的错误处理逻辑，例如显示用户友好的错误消息
    // 或者将错误发送到服务器进行记录
});

// 未处理的Promise拒绝处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('[Unhandled Promise Rejection]', event.reason);
    
    // 如果调试面板可用，记录错误信息
    if (window.debug) {
        const reason = event.reason instanceof Error ? 
            `${event.reason.name}: ${event.reason.message}` : 
            String(event.reason);
        window.debug.set('ERROR', 'Promise', reason);
    }
    
    // 可以在这里添加更多的错误处理逻辑
});

// 控制台错误重写，以便捕获所有console.error调用
const originalConsoleError = console.error;
console.error = function(...args) {
    // 调用原始的console.error
    originalConsoleError.apply(console, args);
    
    // 如果调试面板可用，记录错误信息
    if (window.debug) {
        const errorMessage = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}`;
            } else if (typeof arg === 'object') {
                return JSON.stringify(arg);
            } else {
                return String(arg);
            }
        }).join(' ');
        
        window.debug.set('ERROR', 'Console', errorMessage);
    }
};

// 控制台警告重写，以便捕获所有console.warn调用
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
    // 调用原始的console.warn
    originalConsoleWarn.apply(console, args);
    
    // 如果调试面板可用，记录警告信息
    if (window.debug) {
        const warningMessage = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}`;
            } else if (typeof arg === 'object') {
                return JSON.stringify(arg);
            } else {
                return String(arg);
            }
        }).join(' ');
        
        window.debug.set('WARN', 'Console', warningMessage);
    }
};

// 添加网络错误监控
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    try {
        const response = await originalFetch.apply(this, args);
        
        // 检查响应状态
        if (!response.ok && window.debug) {
            window.debug.set('ERROR', 'HTTP', `${response.status} ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        console.error('[Fetch Error]', error);
        
        // 如果调试面板可用，记录错误信息
        if (window.debug) {
            window.debug.set('ERROR', 'Fetch', `${error.name}: ${error.message}`);
        }
        
        throw error;
    }
};

// 添加性能监控
if (window.performance && window.performance.addEventListener) {
    window.performance.addEventListener('resourcetimingbufferfull', function() {
        console.warn('[Performance] Resource timing buffer is full');
        if (window.debug) {
            window.debug.set('WARN', 'Performance', 'Resource timing buffer full');
        }
    });
}

// 添加内存使用监控
if (window.performance && window.performance.memory) {
    setInterval(() => {
        const memory = window.performance.memory;
        if (memory && window.debug) {
            const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
            const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
            const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
            
            window.debug.set('INFO', 'Memory', `${usedMB}/${totalMB}MB (Limit: ${limitMB}MB)`);
            
            // 如果内存使用超过90%的堆大小限制，发出警告
            if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
                console.warn('[Memory] High memory usage detected');
                window.debug.set('WARN', 'Memory', 'High usage detected');
            }
        }
    }, 5000); // 每5秒更新一次
}

console.log('[Debug] Global error handlers initialized');