import { modelConfig } from './ModelConfig.js';

/**
 * 模型兼容性测试工具
 */
export class ModelCompatibilityTester {
    constructor() {
        this.testResults = new Map();
    }

    /**
     * 测试所有支持的提供商
     */
    async testAllProviders() {
        const providers = modelConfig.getProviders();
        console.log(`🧪 开始测试 ${providers.length} 个模型提供商的兼容性...`);

        for (const provider of providers) {
            console.log(`\n📡 测试 ${provider.name}...`);
            await this.testProvider(provider.id);
        }

        this.showTestSummary();
    }

    /**
     * 测试单个提供商
     */
    async testProvider(providerId) {
        const provider = modelConfig.providers[providerId];
        const results = {
            provider: provider.name,
            models: [],
            overall: 'unknown'
        };

        for (const model of provider.models) {
            const modelResult = await this.testModel(providerId, model.id);
            results.models.push({
                name: model.name,
                id: model.id,
                status: modelResult.status,
                error: modelResult.error,
                responseTime: modelResult.responseTime
            });
        }

        // 评估整体状态
        const successCount = results.models.filter(m => m.status === 'success').length;
        const totalCount = results.models.length;

        if (successCount === totalCount) {
            results.overall = 'success';
            console.log(`✅ ${provider.name}: 全部模型测试通过 (${successCount}/${totalCount})`);
        } else if (successCount > 0) {
            results.overall = 'partial';
            console.log(`⚠️ ${provider.name}: 部分模型可用 (${successCount}/${totalCount})`);
        } else {
            results.overall = 'failed';
            console.log(`❌ ${provider.name}: 全部模型测试失败 (${successCount}/${totalCount})`);
        }

        this.testResults.set(providerId, results);
    }

    /**
     * 测试单个模型
     */
    async testModel(providerId, modelId) {
        const startTime = Date.now();
        const result = {
            status: 'unknown',
            error: null,
            responseTime: 0
        };

        try {
            // 保存当前配置
            const originalProvider = modelConfig.currentProvider;
            const originalModel = modelConfig.currentModel;

            // 切换到测试模型
            modelConfig.switchProvider(providerId);
            modelConfig.switchModel(modelId);

            // 如果没有API密钥，跳过测试
            const currentApiKey = modelConfig.getApiKeyForProvider(providerId);
            if (!currentApiKey) {
                result.status = 'skipped';
                result.error = 'No API key provided';
                result.responseTime = Date.now() - startTime;
                return result;
            }

            // 发送测试请求
            const response = await fetch(modelConfig.getApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': modelConfig.getAuthHeader(),
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: 'Hello, world!' }],
                    max_tokens: 10,
                    stream: false
                })
            });

            result.responseTime = Date.now() - startTime;

            if (response.ok) {
                result.status = 'success';
                console.log(`  ✅ ${modelId}: ${result.responseTime}ms`);
            } else {
                result.status = 'error';
                result.error = `HTTP ${response.status}: ${response.statusText}`;
                console.log(`  ❌ ${modelId}: ${result.error} (${result.responseTime}ms)`);
            }

            // 恢复原始配置
            modelConfig.currentProvider = originalProvider;
            modelConfig.currentModel = originalModel;

        } catch (error) {
            result.status = 'error';
            result.error = error.message;
            result.responseTime = Date.now() - startTime;
            console.log(`  ❌ ${modelId}: ${result.error} (${result.responseTime}ms)`);
        }

        return result;
    }

    /**
     * 显示测试总结
     */
    showTestSummary() {
        console.log('\n📊 测试总结:');
        console.log('='.repeat(50));

        let totalSuccess = 0;
        let totalModels = 0;

        for (const [providerId, results] of this.testResults) {
            const successCount = results.models.filter(m => m.status === 'success').length;
            const providerModels = results.models.length;
            totalSuccess += successCount;
            totalModels += providerModels;

            console.log(`${results.provider}: ${successCount}/${providerModels} ✅`);

            // 显示失败的模型详情
            const failedModels = results.models.filter(m => m.status === 'error');
            if (failedModels.length > 0) {
                console.log('  失败模型:');
                failedModels.forEach(model => {
                    console.log(`    - ${model.name}: ${model.error}`);
                });
            }
        }

        console.log('='.repeat(50));
        console.log(`总体结果: ${totalSuccess}/${totalModels} 个模型可用`);

        if (totalSuccess === totalModels) {
            console.log('🎉 所有模型都兼容！');
        } else if (totalSuccess > 0) {
            console.log('⚠️ 部分模型可用，请检查配置');
        } else {
            console.log('❌ 所有模型都不可用，请检查网络和API密钥');
        }
    }

    /**
     * 获取测试结果
     */
    getTestResults() {
        return Object.fromEntries(this.testResults);
    }

    /**
     * 生成测试报告
     */
    generateReport() {
        const results = this.getTestResults();
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalProviders: Object.keys(results).length,
                totalModels: Object.values(results).reduce((sum, r) => sum + r.models.length, 0),
                successfulModels: Object.values(results).reduce((sum, r) => sum + r.models.filter(m => m.status === 'success').length, 0)
            },
            details: results
        };

        return report;
    }
}

// 创建全局测试实例
export const modelTester = new ModelCompatibilityTester();

// 便捷测试函数
export async function testModelCompatibility() {
    await modelTester.testAllProviders();
    return modelTester.generateReport();
}