// 快速测试模型配置系统
console.log('🧪 模型配置系统已加载');

// 在控制台中暴露测试函数
window.testModelConfig = () => {
    console.log('📋 测试提供商列表:', window.modelConfig.getProviders().length, '个提供商');
    console.log('🔄 当前提供商:', window.modelConfig.getCurrentProvider().name);
    console.log('🤖 当前模型:', window.modelConfig.getCurrentModel().name);
    console.log('🔗 API地址:', window.modelConfig.getApiUrl());
    console.log('✅ 配置状态:', window.modelConfig.validateConfig() ? '有效' : '无效');
    console.log('🎉 测试完成！');
};

// 暴露配置对象供调试使用
window.modelConfig = null; // 将在main.js中设置

console.log('💡 提示：在浏览器控制台中运行 testModelConfig() 来测试系统');