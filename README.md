# 馃殌 AI 瀵硅瘽绯荤粺娴嬭瘯骞冲彴

涓€涓熀浜?Web 鐨勬彁绀鸿瘝宸ョ▼涓庡璇濊川閲忚瘎娴嬪钩鍙帮紝鏀寔澶氭ā鍨嬨€佸鏈嶅姟鍟嗐€佸満鏅寲閰嶇疆銆佹壒閲忓苟琛屾祴璇曚笌鑷姩鍖栬瘎浼帮紝閫傚悎璇剧▼/姣曚笟璁捐銆佸洟闃熷唴閮ㄨ瘎娴嬩笌鏃ュ父 Prompt 瀹為獙銆?
鏈?README 閲嶆柊姊崇悊浜嗛」鐩粨鏋勩€佸惎鍔ㄦ柟寮忋€侀厤缃柟娉曚笌甯歌闂锛屼究浜庡揩閫熶笂鎵嬩笌缁存姢銆?
## 馃専 鍔熻兘鐗规€?
- 涓诲璇濅笌娴佸紡杈撳嚭锛氬疄鏃跺璇濄€佹秷鎭€夋嫨涓庡鍒躲€佽嚜鍔?杩炵画鍝嶅簲銆佺粨鏉熸潯浠舵帶鍒?- 鍦烘櫙閰嶇疆绯荤粺锛歒AML 鍙鍖栭厤缃€佹ā鏉挎浛鎹?LLM鐢熸垚/鐩存帴杈撳嚭涓夌鐢熸垚妯″紡銆佸疄鏃堕瑙堜笌涓€閿簲鐢?- 骞惰娴嬭瘯涓庤瘎浼帮細鎵归噺浠诲姟銆佽繘搴﹀彲瑙嗗寲銆佽嚜鍔ㄩ敊璇綊绫汇€佸缁村害璇勫垎銆丆SV 瀵煎嚭
- 鏅鸿兘鍒嗘瀽缁勪欢锛氶【瀹㈠績鐞嗐€佸璇濊川閲忋€侀攢鍞〃鐜扮瓑澶氱淮璇勪及锛屽浐瀹?JSON 缁撴瀯浜у嚭锛屼究浜庤嚜鍔ㄥ寲澶勭悊
- 妯″瀷涓庡瘑閽ョ鐞嗭細澶氭湇鍔″晢/澶氭ā鍨嬮厤缃紝缁熶竴绠＄悊 API Key锛岄殢鏃跺垏鎹笌璋冨弬涓庢寔涔呭寲
- 璋冭瘯涓庤瘖鏂細璋冭瘯瑕嗙洊灞備笌璋冭瘯鎺у埗鍙般€佺綉缁滀笌閿欒鐩戞帶銆佹€ц兘鎸囨爣灞曠ず锛堣瑙?`DEBUG.md`锛?
鍏稿瀷鏈嶅姟鍟嗭紙绀轰緥锛夛細OpenAI銆丄nthropic銆丟oogle Gemini銆侀樋閲屼簯閫氫箟鍗冮棶锛圖ashScope锛夈€佹櫤璋?GLM銆丏eepSeek銆佽眴鍖呯瓑銆?
## 馃彈锔?鎶€鏈爤涓庢灦鏋?
- 鍓嶇锛氬師鐢?HTML/CSS/JS锛屾ā鍧楀寲缁勭粐锛岀函闈欐€佹墭绠″嵆鍙繍琛?- 鍚庣锛歂ode.js + Express锛圗SM 妯″潡锛夛紝JWT 璁よ瘉锛孋ORS 鏀寔
- 鏁版嵁搴擄細MySQL锛堢敤鎴枫€佹彁绀鸿瘝銆丄PI Key锛?- 鏁版嵁杩佺Щ锛氬唴缃垵濮嬪寲鑴氭湰锛岃嚜鍔ㄥ垱寤烘暟鎹簱涓庤〃缁撴瀯

鍏抽敭浣嶇疆
- 鍚庣鍏ュ彛锛歚backend/src/app.js`
- 鏁版嵁搴撻厤缃細`backend/src/config/database.js`
- 璺敱涓庢帶鍒跺櫒锛歚backend/src/routes/*`, `backend/src/controllers/*`
- 鍒濆鍖栬剼鏈細`backend/scripts/init-db.js`, `backend/database/migrations.sql`
- 鍓嶇鍏ュ彛椤甸潰锛歚index.html`, `login.html`
- 鍓嶇 API 绠＄悊锛歚js/api-manager.js`, `js/auth-manager.js`
- 鍦烘櫙閰嶇疆涓?YAML 缂栬緫锛歚js/scene-config/*`, `js/scene-config/yaml-editor/*`
- 璋冭瘯鏂囨。锛歚DEBUG.md`

## 鈿欙笍 鐜鍑嗗

- Node.js 18+锛堝缓璁?LTS锛?- MySQL 8.0+锛堟垨鍏煎鐗堟湰锛?- 浠绘剰闈欐€佹湇鍔″櫒锛堢ず渚嬶細VS Code Live Server 鎴?`python -m http.server`锛?
## 馃攼 鐜鍙橀噺锛堝悗绔級

鍦?`backend` 鐩綍鍒涘缓 `.env`锛?
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

璇存槑
- `FRONTEND_URL` 鐢ㄤ簬 CORS锛岄渶涓庡墠绔潤鎬佹湇鍔″湴鍧€涓€鑷达紙榛樿 8000锛?- `DB_*` 涓?MySQL 杩炴帴淇℃伅
- `JWT_*` 涓鸿璇佷护鐗岄厤缃?
## 馃殌 鏈湴鍚姩

1) 鍚姩鍚庣 API锛堢鍙ｉ粯璁?3001锛?- 杩涘叆鐩綍骞跺畨瑁呬緷璧栵細
  - `cd backend`
  - `npm install`
- 鍒濆鍖栨暟鎹簱锛堝垱寤哄簱涓庤〃锛夛細
  - `npm run init-db`
- 杩愯寮€鍙?鐢熶骇锛?  - 寮€鍙戯細`npm run dev`
  - 鐢熶骇锛歚npm start`

2) 鍚姩鍓嶇闈欐€佺珯鐐癸紙绔彛寤鸿 8000锛?- 鏂瑰紡 A锛歏S Code 鎻掍欢 Live Server 鐩存帴鎵撳紑椤圭洰鏍圭洰褰曞苟鎸囧畾 8000 绔彛
- 鏂瑰紡 B锛歅ython 绠€鍗曟湇鍔″櫒锛堥渶瀹夎 Python锛?  - 鍦ㄩ」鐩牴鐩綍鎵ц锛歚python -m http.server 8000`

3) 璁块棶鍦板潃
- 鐧诲綍椤碉細`http://localhost:8000/login.html`
- 涓诲簲鐢細`http://localhost:8000/index.html`

娉ㄦ剰锛氬墠绔粯璁ら€氳繃 `http://localhost:3001/api` 璁块棶鍚庣锛堣 `js/api-manager.js:1-20`锛夛紝鑻ヤ慨鏀瑰悗绔鍙ｆ垨閮ㄧ讲鍩熷悕锛岃鍚屾鏇存柊璇ユ枃浠舵垨閫氳繃鍙嶅悜浠ｇ悊缁熶竴缃戝叧銆?
## 馃攽 璁よ瘉涓庡瘑閽ョ鐞?
- 鐧诲綍/娉ㄥ唽锛?  - 鎺ュ彛锛歚POST /api/auth/login`, `POST /api/auth/register`
  - 鎴愬姛鍚庢祻瑙堝櫒 `localStorage` 鎸佷箙鍖?token 涓庣敤鎴蜂俊鎭紙瑙?`js/auth-manager.js`锛?- 鐢ㄦ埛淇℃伅锛歚GET /api/auth/profile`锛堥渶鎼哄甫 `Authorization: Bearer <token>`锛?- API Key 绠＄悊锛?  - 鍒楄〃锛歚GET /api/api-keys`
  - 鑾峰彇锛歚GET /api/api-keys/:provider`
  - 淇濆瓨锛歚POST /api/api-keys`锛坆ody: `{ provider, api_key }`锛?  - 鍒犻櫎锛歚DELETE /api/api-keys/:provider`

瀹夊叏鎻愮ず锛氱ず渚嬪疄鐜板皢瀵嗛挜鏄庢枃瀛樺偍鍦ㄦ暟鎹簱涓紙鐢ㄤ簬鍓嶇蹇€熼泦鎴愪笌婕旂ず锛夈€傜敓浜х幆澧冭缁撳悎 KMS/瀵嗛挜鍔犲瘑銆佺粏绮掑害鏉冮檺涓庡璁＄瓑鎺柦銆?
## 馃摑 鎻愮ず璇嶇鐞?API

- 鍒楄〃锛堝垎椤?鎼滅储/绛涢€夛級锛歚GET /api/prompts?search=&tab=&textbox=&page=&limit=`
- 璇︽儏锛歚GET /api/prompts/:id`
- 鍒涘缓锛歚POST /api/prompts`锛坄{ name, description, tabs:[], textboxes:[], text }`锛?- 鏇存柊锛歚PUT /api/prompts/:id`
- 鍒犻櫎锛歚DELETE /api/prompts/:id`
- 瀵煎嚭锛歚GET /api/prompts/export/all`
- 瀵煎叆锛歚POST /api/prompts/import`锛坄{ presets: [...] }`锛?
## 馃挕 鍓嶇涓昏妯″潡

- 瀵硅瘽涓庢湇鍔★細`js/chat.js`, `js/ChatService.js`, `js/HelpSystem.js`
- 妯″瀷閰嶇疆锛歚js/config/ModelConfig.js`, `js/config/ModelConfigUI.js`
- 鍦烘櫙閰嶇疆锛歚js/scene-config/*`锛堥瑙堛€佽〃鍗曠敓鎴愩€佹ā鏉挎浛鎹€佺洿鎺ヨ緭鍑恒€丩LM 鐢熸垚锛?- YAML 缂栬緫锛歚js/scene-config/yaml-editor/*`锛堣瑙?`js/scene-config/yaml-editor/YAML_DATA_PROCESSING_GUIDE.md`锛?- 骞惰娴嬭瘯锛歚js/parallel-test/*`锛堜换鍔＄紪鎺掋€佽瘎鍒嗐€佽皟搴︿笌 UI锛?- 棰勮绠＄悊锛歚js/preset-manager/*`
- 宸ュ叿锛歚js/utils/*`锛坄js-yaml.mjs`, `csv.mjs` 绛夛級

## 馃搧 鐩綍缁撴瀯锛堣妭閫夛級

- 鏍圭洰褰曪細`index.html`, `login.html`, `css/*`, `js/*`
- 鍚庣锛歚backend/src/app.js`, `backend/src/routes/*`, `backend/src/controllers/*`, `backend/src/config/database.js`
- 鍒濆鍖栵細`backend/scripts/init-db.js`, `backend/database/migrations.sql`
- 璋冭瘯璇存槑锛歚DEBUG.md`

## 馃И 浣跨敤寤鸿

- 棣栨浣跨敤寤鸿鍏堝湪鈥滄ā鍨嬭缃€濋潰鏉块厤缃湇鍔″晢涓?API Key锛屽啀鍦ㄢ€滀富瀵硅瘽鈥濅笌鈥滃満鏅厤缃€濅腑杩涜 Prompt 杩唬
- 鎵归噺璇勬祴璇蜂娇鐢ㄢ€滃苟琛屾祴璇曗€濓紝骞剁粨鍚堚€滄櫤鑳藉垎鏋愨€濆浐瀹?JSON 杈撳嚭锛屼究浜庤嚜鍔ㄥ寲姣斿
- 濡傞渶淇敼榛樿鍚庣鍦板潃鎴?CORS 婧愶紝璇峰悓姝ヨ皟鏁达細
  - `backend/src/app.js` 鐨?`cors` 閰嶇疆
  - `js/api-manager.js` 鐨?`baseUrl`

## 馃洜锔?鏁呴殰鎺掗櫎

- 鍓嶇 401 璺宠浆鐧诲綍锛歵oken 澶辨晥鎴栫己澶憋紝閲嶆柊鐧诲綍鍗冲彲
- 鏃犳硶杩炴帴鍚庣锛氭鏌?`backend` 鏄惁杩愯銆佺鍙ｆ槸鍚?3001銆佷互鍙?`.env` 鏄惁姝ｇ‘
- CORS 鎶ラ敊锛氱‘淇?`.env` 涓?`FRONTEND_URL` 涓庡墠绔闂湴鍧€涓€鑷?- 鏁版嵁搴撻敊璇細纭 MySQL 杩炴帴淇℃伅銆佺敤鎴锋潈闄愶紝骞堕噸鏂版墽琛?`npm run init-db`
- 瀛楃鏄剧ず寮傚父锛氱‘淇濇枃浠?缁堢浣跨敤 UTF-8 缂栫爜

## 馃 璐＄尞

- Fork 浠撳簱骞跺垱寤虹壒鎬у垎鏀細`git checkout -b feature/your-feature`
- 鎻愪氦鍙樻洿锛歚git commit -m "feat: your message"`
- 鎺ㄩ€佸苟鍙戣捣 Pull Request

## 馃搫 License

- 鏍圭洰褰?`package.json` 鏍囨敞 `ISC`锛屽悗绔?`backend/package.json` 鏍囨敞 `MIT`
- 鑻ラ渶缁熶竴鍗忚锛岃鍦ㄦ牴鐩綍鏂板 `LICENSE` 骞跺湪涓や釜 `package.json` 涓繚鎸佷竴鑷?
---

濡傛灉鏈」鐩浣犳湁甯姪锛屾杩?Star锛屼害鍙彁鍑?Issue/PR 涓€璧锋敼杩涖€?

## 已知问题（2025-11-11）

- 预设管理中的测试结果面板如果 /api/experiments?preset_id=... 请求返回 401，就不会显示任何数据；重新登录保证 Authorization 头有效即可。
- js/preset-manager/PresetResultsExtension.js 曾被非 UTF-8 编辑器破坏导致语法错误，如再次出现需确认文件保持 UTF-8 且没有非法字符。


