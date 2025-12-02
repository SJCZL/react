# 🚀 AI 对话系统测试平台

一个基于 Web 的提示词工程与对话质量评测平台，支持多模型/多厂商接入、场景化配置、批量并行测试与自动化评估，适合课程/毕设、团队内评测与日常 Prompt 实验。

## 功能亮点
- 主对话与流式输出：实时对话、消息选择/复制、自定义初始响应、自动连续响应、结束条件控制。
- 场景配置系统：YAML 可视化编辑，模板占位符替换，支持 LLM 生成/直接输出两种模式，实时预览与一键应用。
- 并行测试与评估：批量任务、进度可视化、自动错误归类、多维度评分、CSV 导出，支持历史结果查询。
- 模型与密钥管理：多服务商/多模型配置，统一管理 API Key，随时切换与持久化。
- 调试与诊断：调试覆盖层、调试控制台、网络与错误监控、性能指标展示（详见 `DEBUG.md`）。
- 预设与快照：支持预设管理、输入框快照与批量导入导出，方便不同场景复用。

## 技术栈
- 前端：原生 HTML/CSS/JS（模块化），纯静态托管即可运行。
- 后端：Node.js + Express（ESM），JWT 认证，CORS 支持。
- 数据库：MySQL（用户、提示词、API Key、实验与测试结果等）。
- 数据迁移：内置初始化脚本，自动创建数据库与表结构。

## 目录速览
- 后端入口：`backend/src/app.js`
- 数据库配置：`backend/src/config/database.js`
- 路由与控制器：`backend/src/routes/*`, `backend/src/controllers/*`
- 初始化脚本：`backend/scripts/init-db.js`, `backend/database/migrations.sql`
- 前端入口：`index.html`, `login.html`
- 前端 API 管理：`js/api-manager.js`, `js/auth-manager.js`
- 场景配置 & YAML 编辑：`js/scene-config/*`, `js/scene-config/yaml-editor/*`
- 并行测试：`js/parallel-test/*`
- 预设管理：`js/preset-manager/*`
- 调试文档：`DEBUG.md`
- Windows 一键启动脚本：`tools/start-all.ps1`

## 环境要求
- Node.js 18+（建议 LTS）
- MySQL 8.0+（或兼容版本）
- 任意静态服务器（示例：VS Code Live Server 或 `python -m http.server 8000`）

## 后端环境变量
在 `backend` 目录创建 `.env`：
```
PORT=3001
FRONTEND_URL=http://localhost:8000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=prompt_system

JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=7d
```
说明：`FRONTEND_URL` 应与前端访问地址一致；`DB_*` 为 MySQL 连接信息；`JWT_*` 为认证配置。

## 本地启动
1) 启动后端 API（默认端口 3001）  
   - `cd backend && npm install`  
   - 初始化数据库：`npm run init-db`  
   - 开发/生产：`npm run dev` 或 `npm start`
2) 启动前端静态站点（推荐 8000）  
   - 方式 A：VS Code Live Server 打开项目根目录并指定 8000 端口  
   - 方式 B：`python -m http.server 8000`
3) 访问地址  
   - 登录页：`http://localhost:8000/login.html`  
   - 主应用：`http://localhost:8000/index.html`

### Windows 一键启动脚本
- 在 PowerShell 中执行 `.\tools\start-all.ps1`，脚本会尝试启动 `MySQL80/mysql80/sql80` 服务，并在独立窗口运行后端（`npm run dev`）与前端静态服务器（默认端口 8000）。  
- 参数示例：`.\tools\start-all.ps1 -MySqlServiceName mysql80 -FrontendPort 5173 -SkipFrontend`，可按需跳过任意子服务。  
- 由于启动 MySQL 服务需要管理员权限，若被系统拦截，请手动以管理员身份运行，或先执行 `Set-ExecutionPolicy -Scope Process Bypass` 后再启动脚本。

## 认证与密钥
- 登录/注册：`POST /api/auth/login`, `POST /api/auth/register`。成功后 token 存于 localStorage。  
- 用户信息：`GET /api/auth/profile`（需 `Authorization: Bearer <token>`）。  
- API Key 管理：`GET /api/api-keys`, `GET /api/api-keys/:provider`, `POST /api/api-keys`, `DELETE /api/api-keys/:provider`。  
- 安全提示：示例实现会将密钥明文存储在数据库，仅用于演示。生产环境请结合 KMS/密钥加密、细粒度权限、审计等措施。

## 提示词管理 API（节选）
- 列表：`GET /api/prompts?search=&tab=&textbox=&page=&limit=`  
- 详情：`GET /api/prompts/:id`  
- 创建：`POST /api/prompts`（`{ name, description, tabs, textboxes, text }`）  
- 更新：`PUT /api/prompts/:id`  
- 删除：`DELETE /api/prompts/:id`  
- 导出/导入：`GET /api/prompts/export/all`, `POST /api/prompts/import`

## 使用建议
- 先在“模型设置”配置服务商及 API Key，再在“主对话”和“场景配置”中迭代 Prompt。  
- 批量评测使用“并行测试”，结合“智能分析”固定 JSON 输出，便于自动比对。  
- 并行测试右侧“模型配置”面板的服务商/模型选择会直接驱动运行时调用，优先级高于顶部全局设置，可分别为对话与评估指定不同厂商。  
- 如需修改后端地址或 CORS，请同步调整 `backend/src/app.js` 与 `js/api-manager.js`。

## 故障排除
- 前端 401 跳转登录：token 失效或缺失，重新登录。  
- 连接失败：检查后端进程、端口、`.env` 配置。  
- CORS 报错：确保 `FRONTEND_URL` 与前端访问地址一致。  
- 数据库错误：确认 MySQL 连接信息与权限，并重新执行 `npm run init-db`。  
- 字符显示异常：确保文件与终端均使用 UTF-8。

## License
- 根目录 `package.json` 标注 `ISC`，后端 `backend/package.json` 标注 `MIT`。如需统一协议，请在根目录新增 `LICENSE` 并保持一致。

---
如果本项目对你有帮助，欢迎 Star，也可提 Issue/PR 一起改进！
