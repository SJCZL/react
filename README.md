# 🚀 提示词结构演示与测试平台

一个先进的基于 Web 的提示词工程演示和测试平台，专注于对话系统、场景配置、多模型并行测试和智能评估。支持全球主流AI模型，提供企业级的提示词工程解决方案。

## 🌟 项目特色

### 🔥 最新功能
- **🎯 多模型支持**：集成全球主流AI模型（GPT-5、Claude Opus 4、Gemini 2.5、Qwen3、通义千问等）
- **⚡ 实时并行测试**：批量执行对话测试，支持实时流式输出和智能评估
- **🎨 智能场景配置**：支持YAML配置、模板替换、LLM生成等多种场景创建方式
- **📊 深度分析评估**：多维度对话质量分析，包括心理、销售、质量等专业评估
- **🎪 动态模型切换**：实时切换AI服务商和模型，无缝集成体验
- **📋 预设管理系统**：丰富的提示词模板库，支持导入导出和复用

## 🎯 核心功能

### 1. 🗨️ 主对话系统
- **实时对话**：与多种AI模型进行实时对话交流
- **自动响应**：基于规则的智能自动回复机制
- **流式输出**：实时显示AI模型的思考和输出过程
- **消息管理**：强大的消息选择、复制、分析功能

### 2. 🎭 场景配置系统
- **YAML编辑器**：可视化YAML配置编辑，支持语法高亮
- **多生成模式**：
  - 模板替换生成
  - LLM智能生成
  - 直接输出生成
- **场景预览**：实时预览生成的场景效果

### 3. ⚡ 并行测试系统
- **批量测试**：同时运行多个对话测试场景
- **实时监控**：可视化显示测试进度和状态
- **智能评估**：
  - 自动错误检测和分类
  - 多专家评分体系
  - 详细评估报告
- **结果导出**：支持CSV格式导出测试结果

### 4. 📊 智能分析系统
- **心理分析**：客户心理状态和情绪分析
- **质量评估**：对话质量和合规性检查
- **销售绩效**：销售技巧和效果评估
- **综合报告**：多维度分析结果整合

### 5. 🎛️ 模型配置管理
- **多服务商支持**：OpenAI、Anthropic、Google、阿里云、智谱AI、DeepSeek、豆包等
- **统一管理**：集中管理所有AI模型的API密钥和参数
- **实时切换**：无缝切换不同的AI服务商和模型
- **参数调优**：灵活调整温度、top-p等模型参数

## 🤖 支持的AI模型和服务商

本平台支持全球主流AI模型和服务商，提供丰富的模型选择：

### 🌐 支持的服务商

| 服务商 | API地址 | 模型数量 | 特色功能 |
|--------|---------|----------|----------|
| **🦄 通义千问** | `dashscope.aliyuncs.com` | 4个 | 阿里云原生，性价比极高 |
| **🔮 OpenAI** | `api.openai.com` | 5个 | GPT-5、GPT-4o等最新模型 |
| **💎 Claude** | `api.anthropic.com` | 5个 | Claude Opus 4、Sonnet 4等顶尖模型 |
| **⭐ Gemini** | `generativelanguage.googleapis.com` | 4个 | Gemini 2.5 Pro/Flash系列 |
| **🔍 DeepSeek** | `api.deepseek.com` | 2个 | 高性价比开源模型 |
| **🌟 智谱AI** | `open.bigmodel.cn` | 6个 | GLM-4.6、GLM-4.5系列 |
| **🆕 豆包** | `ark.cn-beijing.volces.com` | 2个 | 字节跳动豆包模型 |

### 🚀 热门模型推荐

#### 🔥 最强推理模型
- **GPT-5 Chat Latest** - OpenAI最新旗舰模型
- **Claude Opus 4.1** - Anthropic最强模型
- **Gemini 2.5 Pro** - Google最新专业模型

#### ⚡ 最快响应模型
- **Qwen Flash** - 通义千问极速模型
- **Gemini 2.5 Flash** - Google快速模型
- **GLM-4.5 Flash** - 智谱AI闪电模型

#### 💰 最高性价比
- **DeepSeek Chat** - 开源免费模型
- **Qwen3 Max** - 通义千问专业版
- **Doubao Seed 1.6** - 豆包种子模型

## 🏗️ 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    🚀 前端界面层 (Vue-like架构)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ 主对话界面   │  │ 场景配置界面 │  │ 并行测试界面 │  │ 模型配置 │  │
│  │             │  │             │  │             │  │          │  │
│  │ • 实时对话   │  │ • YAML编辑  │  │ • 批量测试  │  │ • 多模型 │  │
│  │ • 流式输出  │  │ • 多生成器  │  │ • 实时监控  │  │ • API管理│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                 🎯 业务逻辑层 (模块化设计)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ 核心服务    │  │ 场景配置    │  │ 并行测试    │  │ 分析引擎 │  │
│  │             │  │             │  │             │  │          │  │
│  │ • ChatService│  │ • SceneConfig│  │ • TaskOrch  │  │ • 心理分析│  │
│  │ • ApiService │  │ • YamlEditor │  │ • Assessment│  │ • 质量评估│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                     💾 数据管理层                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ 对话数据    │  │ 配置数据    │  │ 测试结果    │  │ 分析报告 │  │
│  │             │  │             │  │             │  │          │  │
│  │ • 消息存储  │  │ • YAML配置  │  │ • CSV导出   │  │ • 多维度 │  │
│  │ • 历史记录  │  │ • 模板管理  │  │ • JSON格式  │  │ • 可视化 │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 🎯 核心模块详解

#### 1. 🗨️ 主对话系统 (`js/chat.js`, `js/ChatService.js`)
- **ChatService**：核心对话服务，管理对话状态、消息存储、自动响应
- **ChatUIManager**：对话界面管理，处理渲染、交互、消息选择
- **MessageSelectionManager**：高级消息选择和管理功能
- **实时流式输出**：支持实时显示AI模型思考过程

#### 2. 🎭 场景配置系统 (`js/scene-config/`)
- **SceneConfigManager**：场景配置主管理器，协调整个配置流程
- **YamlEditorManager**：专业的YAML配置编辑器，支持语法高亮和验证
- **多生成模式**：
  - **TemplateSubstitutionGenerator**：基于模板的智能替换生成
  - **LLMGenerator**：利用AI模型自动生成场景内容
  - **DirectOutputGenerator**：直接输出模式，支持自定义格式

#### 3. ⚡ 高级并行测试系统 (`js/parallel-test/`)
- **TaskOrchestrator**：智能任务编排器，协调复杂的测试流程
- **ContinuousGenerationService**：连续对话生成，支持长时间对话测试
- **AssessmentService**：智能评估引擎，自动检测对话中的各类问题
- **RatingService**：多专家评分系统，提供专业级的评分评估
- **TaskScheduler**：任务调度器，支持并发控制和队列管理
- **TaskUIManager**：现代化的测试界面，支持实时监控和交互

#### 4. 📊 深度分析引擎 (`js/analysis/`)
- **AnalysisManager**：分析协调器，整合多种分析服务
- **CustomerPsychologyService**：客户心理状态深度分析
- **MessageQualityService**：对话质量和合规性专业评估
- **SalesPerformanceService**：销售技巧和绩效量化分析
- **多维度评估体系**：信息级、警告级、错误级三级评估体系

#### 5. 🎛️ 统一模型配置系统 (`js/config/`)
- **ModelConfig**：集中式模型配置管理
- **ModelConfigUI**：可视化模型配置界面
- **多服务商集成**：统一管理不同AI服务商的API密钥和参数
- **实时切换机制**：无缝切换不同的AI模型和服务商

### 🔄 数据流程

```
用户操作 → 事件捕获 → 业务逻辑处理 → 多模型API调用 → 流式响应处理 → 实时UI更新 → 结果存储分析
     ↑                                                                      ↓
     └────────────────── 错误处理和重试机制 ←──────────────────────────────┘
```

## 🚀 快速开始

### 📋 系统要求

- **浏览器**：现代浏览器（Chrome 80+、Firefox 75+、Safari 13+、Edge 80+）
- **网络**：稳定的互联网连接（用于访问AI模型API）
- **API密钥**：至少一个主流AI服务商的API密钥
- **开发环境**：支持ES6+模块的现代JavaScript环境

### ⚡ 一键部署

#### 🐍 方法一：Python快速部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd prompt-structure-demo

# 启动本地服务器（Python 3）
python -m http.server 8000

# 或使用Python 2
python -m SimpleHTTPServer 8000

# 访问应用
# 打开浏览器访问：http://localhost:8000
```

#### 🟢 方法二：Node.js部署

```bash
# 安装轻量级服务器
npm install -g http-server

# 启动服务器
http-server -p 8000 -c-1

# 访问应用：http://localhost:8000
```

#### 🐳 方法三：Docker容器化部署

```bash
# 构建镜像
docker build -t prompt-demo -f Dockerfile .

# 运行容器
docker run -d -p 8000:80 --name prompt-demo prompt-demo

# 访问应用：http://localhost:8000
```

#### ☁️ 方法四：云端部署（推荐生产环境）

- **Vercel**：零配置部署，支持按需扩展
- **Netlify**：静态站点托管，内置CDN加速
- **Railway**：支持Docker容器，免费额度充足
- **Render**：全托管平台，支持静态站点和Docker

## 📖 使用指南

### 🎯 初次使用

1. **访问应用**
   ```bash
   # 启动服务器后，打开浏览器访问
   http://localhost:8000
   ```

2. **配置API密钥**
   - 点击右上角的 🤖 模型配置按钮
   - 选择您偏好的AI服务商（推荐：通义千问）
   - 输入您的API密钥
   - 点击"测试连接"验证配置

3. **开始对话**
   - 在主对话界面输入您想说的话
   - 系统将自动调用配置的AI模型
   - 享受流式响应体验

### 🎨 核心功能使用

#### 多模型切换
1. 点击 🤖 模型配置按钮
2. 在弹出的面板中选择不同服务商
3. 浏览并选择您需要的模型
4. 系统自动应用新配置

#### 并行测试
1. 切换到"并行测试"标签页
2. 点击 ➕ 按钮创建新测试任务
3. 观看实时测试进度和结果
4. 查看详细的评估报告

#### 场景配置
1. 切换到"场景配置"标签页
2. 在YAML编辑器中编写场景配置
3. 使用多种生成模式创建内容
4. 预览和保存配置结果

#### 智能分析
1. 在对话界面勾选消息进行分析
2. 点击分析按钮查看详细评估
3. 浏览心理、销售、质量等多维度分析结果

### 🔧 高级配置

#### 添加自定义模型
```javascript
// 在ModelConfig.js中添加新的服务商
customProviders: {
    'my-api': {
        name: '我的AI服务',
        models: [
            { id: 'my-model', name: '我的模型', maxTokens: 8000 }
        ],
        baseUrl: 'https://my-api.com',
        endpoint: '/v1/chat/completions',
        authType: 'bearer'
    }
}
```

#### 自定义评估规则
```javascript
// 在mistakes.json中添加新的评估规则
{
    "name": "我的评估规则",
    "severity": "warning",
    "type": "自定义类型",
    "description": "规则描述",
    "examples": ["示例1", "示例2"]
}
```

## 🌟 项目特色

### 🔥 技术亮点

- **🎯 多模型架构**：创新的多服务商统一管理架构，支持实时切换
- **⚡ 高性能并行**：优化的异步处理机制，支持多任务并发执行
- **🎨 现代化UI**：响应式设计，支持深色模式，操作流畅自然
- **📊 智能评估**：先进的对话质量评估算法，多维度分析体系
- **🔧 易于扩展**：模块化设计，轻松添加新的AI模型和服务商
- **💾 数据持久化**：自动保存配置和测试结果，支持导出多种格式

### 🚀 性能优势

| 特性 | 本平台 | 传统方案 |
|------|--------|----------|
| 模型切换 | ⚡ 实时无缝 | 🔄 需要重启 |
| 并行测试 | 🎯 智能调度 | 📊 简单队列 |
| 多模型支持 | 🌟 25+ 模型 | 📝 少数固定 |
| 评估深度 | 🎨 多维度 | 📋 单维度 |
| 用户体验 | 🎪 现代化 | 📱 传统界面 |

### 📈 使用场景

#### 企业应用
- **提示词工程**：开发和测试企业级对话系统
- **客服培训**：模拟客户对话，提升服务质量
- **销售训练**：优化销售话术和技巧
- **产品测试**：验证AI助手的交互体验

#### 个人使用
- **学习研究**：探索不同AI模型的特点和能力
- **内容创作**：利用多种模型生成创意内容
- **效率提升**：批量测试和评估提示词效果
- **技术验证**：验证不同模型在特定场景下的表现

## 🤝 贡献指南

欢迎社区贡献！无论是bug修复、功能增强还是文档改进，我们都非常欢迎。

### 📝 贡献方式

1. **Fork项目** 到您的GitHub账户
2. **创建特性分支**：`git checkout -b feature/amazing-feature`
3. **提交更改**：`git commit -m 'Add amazing feature'`
4. **推送分支**：`git push origin feature/amazing-feature`
5. **提交Pull Request**

### 🐛 问题报告

如果您发现bug或有改进建议，请：

1. 查看现有的 [Issues](../../issues)
2. 如果没有相关issue，请创建一个新的issue
3. 详细描述问题，包括复现步骤和环境信息

### 🔧 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd prompt-structure-demo

# 启动开发服务器
python -m http.server 8000

# 运行测试（如果有）
npm test
```

### 📋 代码规范

- 使用ES6+现代JavaScript语法
- 遵循模块化开发原则
- 添加适当的注释和文档
- 确保代码的可读性和可维护性

## 📄 开源协议

本项目采用 **MIT License** 开源协议。

```
MIT License

Copyright (c) 2024 提示词结构演示平台

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 👥 作者与致谢

### 核心开发者
- **项目维护者**：您的名字
- **技术顾问**：AI助手团队

### 特别致谢
- 感谢所有开源AI模型和服务商提供的优秀技术支持
- 感谢开源社区的宝贵贡献和建议
- 感谢测试用户提出的宝贵反馈

### 🌐 相关链接
- **项目主页**：[GitHub Repository]
- **问题反馈**：[Issues](../../issues)
- **功能请求**：[Discussions](../../discussions)
- **贡献指南**：[CONTRIBUTING.md]

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给个 Star！**

[![Star History Chart](https://api.star-history.com/svg?repos=username/repo&type=Date)](https://star-history.com/#username/repo&Date)

*Built with ❤️ for the AI community*

</div>
