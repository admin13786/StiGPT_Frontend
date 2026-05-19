# ScholarMate / STIGPT 深度调研报告

日期：2026-04-18

> **Research note:** This document is an external-site research snapshot plus implementation hypotheses. It is not the current implementation spec for this repo.
>
> Current source of truth:
> - startup / ports: `README.md`
> - default player entry: `/apps/stigpt/webIdx`
> - current implemented product behavior: `docs/产品使用文档.md`
>
> References below to ScholarMate `/stigpt/*` routes, inferred architecture, hidden capabilities, and phased recommendations are research observations only. In this repo, canonical user-facing paths are under `/apps/stigpt/*`.

调研对象：
- 宿主站：`https://www.scholarmate.com/apps`
- STIGPT 子系统：`/stigpt/webIdx`、`/stigpt/write`、`/stigpt/check`、`/stigpt/review`、`/stigpt/inspect`

调研目标：
- 弄清楚 ScholarMate / STIGPT 的真实功能边界
- 尽量推断 AI问答、AI写作、AI检查、AI评审 的实现方式和内部逻辑
- 映射到当前 `game-ai` 仓库，明确哪些能力可复用、哪些必须重构
- 为下一步高相似学习实现做准备

---

## 1. 核心结论

ScholarMate 不是“几个 AI 页面”，而是两个层次叠加：

1. 学术社交宿主平台
- 负责首页、个人主页、联系人、项目组、动态流、推荐关注、入口导航
- 技术栈大概率是 `Nuxt 3 + Vue 3 + Tailwind CSS`

2. STIGPT 科研 AI 子系统
- 负责 AI问答、AI写作、AI检查、AI评审，以及更多隐藏能力
- 技术栈大概率是 `Vue 3 + Element Plus`
- 通过 iframe / micro-app 方式嵌入宿主站

更关键的是，STIGPT 不是“一个统一 prompt 的聊天站”，而是一个多能力、多路由、按场景拆开的科研 AI 工具箱：
- `webIdx`：AI 问答
- `write`：AI 写作
- `check`：AI 检查
- `review`：AI 评审
- `inspect`：AI 编辑建议
- `semantic`：AI 语义查重
- `complianceInspection`：AI 合规检查
- `summary`：AI 总结
- `answer/policy`：政策问答子模块
- `answer/project`：项目问答子模块
- `aiRead`：AI 阅读 / RAG 子能力

对当前仓库的判断也很明确：
- `game-ai` 已经有可复用的 AI 基础设施：`rag`、`knowledge`、`document`、`paper`、`ai-write`、`ai-check`、`ai-review`、`avatar`
- 但当前产品域仍然是“客服 / 工单 / 会话”主导
- 如果要做成 ScholarMate 学习版，最大的工作不是重写 LLM，而是重构产品壳层、会话模型、记录模型和前台信息架构

---

## 2. 证据来源与可信度

本报告优先使用以下证据：
- 已登录状态下对真实站点的逐页浏览
- 真实网络请求与请求体
- 前端资源路径、DOM 类名、iframe 源地址
- 浏览器 localStorage / sessionStorage 中的运行时 trace buffer
- 当前仓库的前端路由、后端模块、Prisma 模型、AI 服务实现

可信度分级：
- 高：页面结构、路由、接口名、请求体、资源路径、宿主/子应用关系
- 中高：能力拆分、会话生命周期、写作编辑器流程
- 中：具体后端服务内部实现、调度方式、模型配置细节
- 低：未暴露的管理员配置、内部运维流程

---

## 3. 站点整体结构

### 3.1 宿主平台 `/apps`

已实测宿主平台包含：
- `/apps`
- `/apps/personal`
- `/apps/contact`
- `/apps/groups`
- `/apps/stigpt/write`
- `/apps/stigpt/check`
- `/apps/stigpt/review`

功能定位：
- 学术社交首页
- 学者画像页
- 联系人与社交网络
- 项目组协作
- AI 工具分发入口

### 3.2 STIGPT 子系统 `/stigpt/*`

已实测直接路由：
- `/stigpt/webIdx`
- `/stigpt/write`
- `/stigpt/write/edit`
- `/stigpt/write/essay-writing/edit`
- `/stigpt/check`
- `/stigpt/review`
- `/stigpt/inspect`

通过 `routes` 接口暴露出的完整路由树，还能确认更多隐藏能力：
- `/stigpt/answer/policy`
- `/stigpt/answer/policy/qa/:id`
- `/stigpt/answer/policy/rule/:id`
- `/stigpt/answer/project`
- `/stigpt/answer/project/:id`
- `/stigpt/semantic`
- `/stigpt/complianceInspection`
- `/stigpt/summary`
- `/stigpt/aiRead`

结论：
- STIGPT 是独立子应用，不是宿主页里的几个组件
- 它内部还按子场景拆成多个模块

---

## 4. 宿主站与 STIGPT 的集成方式

### 4.1 iframe / micro-app 证据

在 `/apps/stigpt/write` 实测到 iframe，源地址形如：

`https://www.scholarmate.com/stigpt/write?from=form-person&__smate_host_origin=...&__smate_host_app=smate-web&__smate_host_instance=...&__smate_iframe_id=stigpt-write-list`

可以确认：
- 宿主应用名是 `smate-web`
- 子应用知道宿主 origin、宿主实例 ID、iframe ID
- 两边存在显式通信协议

### 4.2 认证桥接证据

从浏览器 trace buffer 里观察到宿主与子应用之间的消息类型：
- `context`
- `REQUEST_TOKEN`
- `TOKEN_READY`
- `READY`
- `IFRAME_ROUTE`

宿主侧还能看到这些阶段：
- `host_iframe_create`
- `host_iframe_src_set`
- `host_context_sent`
- `host_message_received`
- `host_token_request_received`
- `host_token_ready_sent`
- `host_iframe_ready`
- `host_iframe_route_synced`

子应用侧能看到这些阶段：
- `token_request_sent`
- `token_wait_start`
- `token_ready_received`
- `route_guard_token_reused`

结论：
- 不是“只靠 cookie 就自动共享登录态”
- 宿主和 STIGPT 之间有一层显式 token bridge
- 这说明它在设计上就是“宿主壳 + 子应用”，而不是单体路由

### 4.3 浏览器会话线索

已观测到：
- cookie 名：`token`、`refresh`
- localStorage 键：`systemInfo`、`auth_redirect_iframe_map`、`stigpt_trace_buffer`、`smate_stigpt_host_trace_buffer`
- sessionStorage 键：`userInfo`、`__SMATE_HOST_INSTANCE_ID__`

结论：
- 使用 JWT / token 刷新模式
- 并且为多 iframe / 多标签页同步登录态做了额外设计

---

## 5. 技术栈判断

### 5.1 宿主站

证据：
- 静态资源位于 `video.scholarmate.com/resource/smate-web/_nuxt/*`
- 页面存在 `window.__NUXT__`
- 页面存在 `window.useNuxtApp`
- CSS 包中有 `tailwind.*.css`
- DOM 类名大量出现 Tailwind utility

判断：
- 宿主站大概率是 `Nuxt 3 + Vue 3 + Tailwind CSS`

### 5.2 STIGPT

证据：
- 静态资源位于 `video.scholarmate.com/resource/smate-stigpt/assets/*`
- DOM 类名大量出现 `el-container`、`el-header`、`el-tabs`、`el-dropdown`、`el-scrollbar`
- CSS 文件名包含 `el-main`、`el-button`、`el-dialog`、`el-input`
- 页面上 `window.__VUE__ === true`
- 页面上 `window.__NUXT__ === false`

判断：
- STIGPT 大概率是 `Vue 3 + Element Plus`

### 5.3 基础设施与域名分层

已观测到：
- `www.scholarmate.com`：主站与 gptapi 代理入口
- `api.scholarmate.com`：宿主站业务 API
- `auth.scholarmate.com`：登录与授权
- `video.scholarmate.com`：静态资源 / CDN
- `aiapi.scholarmate.com`：通用问答流式服务
- `gptapi.scholarmate.com`：写作、评审、数字人、RAG 等专用服务

结论：
- 不是一个单后端
- 明显是按能力分域 / 分服务的结构

---

## 6. STIGPT 启动与运行时逻辑

从 `stigpt_trace_buffer` 观察到典型启动阶段：
- `child_boot_start`
- `app_boot_ready`
- `app_fetch_sysinfo_start`
- `app_fetch_sysinfo_end`
- `app_fetch_routes_start`
- `app_fetch_routes_end`
- `route_guard_start`
- `route_guard_token_reused`
- `route_guard_init_done`
- `route_guard_end`
- `app_mount_start`
- `app_mount_end`
- `app_onmounted_start`
- `app_first_visible`

可以推断出 STIGPT 的启动逻辑：

1. 子应用启动
2. 拉 `sysinfo`
- 获取系统名称、菜单、服务地址、登录地址、描述信息

3. 拉 `routes`
- 获取前端可用路由树

4. 路由守卫处理 token
- 如果宿主模式，等待 `REQUEST_TOKEN / TOKEN_READY`
- 如果直开模式，复用已有 token

5. 拉当前用户信息与页面配置
- `psninfo`
- `pageconfig`

6. 再拉具体页面的首屏数据
- `chatmodel` / `chatlist` / `chatexample`
- `project/getRecentRecord`
- `aiCheck/list`
- `aiReviewRecord/list`
- `applycheck/list`

结论：
- STIGPT 是配置驱动的子系统
- 不是每个页面各自随便发请求
- 它有统一的系统配置、路由配置、鉴权、首屏初始化机制

---

## 7. AI问答 深度分析

### 7.1 已观测到的真实页面行为

`/stigpt/webIdx` 实测包含：
- 新建对话
- 最近 200 条对话提示
- 历史会话 tab 列表
- 输入框
- 示例问题列表
- “换一批”

更重要的是，当前账号的 `webIdx` 默认不是“泛聊天”，而是一个带人格和领域限定的问答场景：
- 页面文案：`你好，我是科创GPT，科学基金政策的人工智能助手`
- 示例问题都围绕科学基金政策
- 历史对话标题中出现“智能客服”

结论：
- `webIdx` 更像“模型工作台 / 问答入口”
- 它背后可能挂不同人格、不同语料域、不同问答模式

### 7.2 已观测到的接口

首屏接口：
- `POST /api/gptapi/chatmodel`
- `POST /api/gptapi/chatlist`
- `POST /api/gptapi/chatexample`
- `POST /api/gptapi/psninfo`
- `GET /api/gptapi/pageconfig`

从 `sysinfo` 暴露出的问答类服务地址：
- `normalChatReqUrl`
- `aiReadChatUrl`
- `digitalManChatUrl`

结论：
- 会话列表、示例、模型列表和实际问答服务是拆开的

### 7.3 隐藏子路由的意义

从 `routes` 可知还有：
- `answer/policy`
- `answer/project`
- `aiRead`

进一步实测：
- 访问 `/stigpt/answer/policy` 会触发：
  - `POST /api/gptapi/policyRegulation/getFileList`
  - `GET /api/gptapi/policyRegulation/fundIns`
  - `GET /api/gptapi/policyRegulation/tag`
  - 但当前账号无权限，返回 403

- 访问 `/stigpt/answer/project` 会触发：
  - `POST /api/gptapi/policygrp/getList`
  - `GET /api/gptapi/policygrp/fundIns`
  - `GET /api/gptapi/policygrp/template/list`
  - 同样当前账号无权限

结论：
- `AI问答` 不只是对话框
- 至少还有两个受权限控制的专业子模块：
  - 政策文档问答
  - 项目模板 / 项目规则问答
- 这些更像“文档库 + 筛选 + RAG 问答”而不是纯聊天

### 7.4 AI问答 的可能内部逻辑

高可信推断：

1. 启动时拉取系统配置
- 模型、菜单、页面配置、会话历史、示例问题

2. 根据 routeKey 进入不同问答模式
- `webIdx`
- `answer/policy`
- `answer/project`
- `aiRead`

3. 每种模式绑定不同服务和语料域
- 通用问答
- 科学基金政策问答
- 项目模板问答
- 文献阅读 / RAG 问答

4. 真实回答走独立流式服务
- `normalChatReqUrl`
- 推断为流式响应

5. 历史会话是服务端管理的
- `chatlist`
- 不是本地 localStorage 拼出来的假历史

### 7.5 对当前仓库的映射

当前仓库已有：
- `rag`
- `knowledge`
- `document`
- `dify`
- `avatar`
- `linly-talker`

但当前“问答产品模型”是错误的：
- 现在主流程是 `Ticket -> Session -> Message`
- 这更像客服系统，不像 ScholarMate 的研究问答工作台

结论：
- 不应拿 `Ticket/Session` 继续硬改成 STIGPT 问答
- 应新增独立的 `stigpt-chat` 领域模型

推荐新增：
- `StigptConversation`
- `StigptMessage`
- `StigptModel`
- `StigptExample`
- `StigptPageConfig`
- `StigptUserPreference`

推荐 API：
- `GET /stigpt/page-config`
- `GET /stigpt/me`
- `GET /stigpt/models`
- `GET /stigpt/examples`
- `GET /stigpt/conversations`
- `POST /stigpt/conversations`
- `GET /stigpt/conversations/:id`
- `POST /stigpt/conversations/:id/messages`

推荐传输方式：
- `webIdx` 用 SSE 做流式回答
- Socket.IO 留给客服工单 / 数字人状态

---

## 8. AI写作 深度分析

### 8.1 列表页不是写作器，而是写作记录管理页

`/stigpt/write` 已实测：
- 类型切换：`项目申请` / `期刊论文`
- 过滤：`写作时间`
- 搜索框
- `最近记录`
- `新建写作`
- 表格列：`名称`、`修改时间`、`操作`

对应接口：
- `POST /api/gptapi/project/getRecentRecord`
- 请求体：`pageNO`、`pageSize`、`writingTime`、`searchKey`

结论：
- AI写作 首屏不是 prompt 输入页
- 它是“写作记录列表 + 进入编辑器”的产品形态

### 8.2 项目申请写作编辑器

访问 `/stigpt/write/edit`，已实测到完整步骤页：
- 申请书起草步骤
  1. 基本条件
  2. 推荐合作者
  3. 项目标题
  4. 项目摘要
  5. 核心关键词
  6. 参考文献
  7. 生成大纲

首屏表单项包括：
- 资助机构
- 项目类型
- 学科分类
- 问题/背景关键词
- 问题/背景说明
- 方法/理论关键词
- 方法/理论说明

对应初始化接口：
- `POST /api/gptapi/project/getFundIns`
- `POST /api/gptapi/project/getSubject`

结论：
- 这不是简单文本生成
- 它明确是“向导式项目申请书起草器”

### 8.3 期刊论文写作编辑器

访问 `/stigpt/write/essay-writing/edit`，已实测步骤页：
- 论文起草步骤
  1. 基本条件
  2. 期刊选择
  3. 推荐合作者
  4. 论文标题
  5. 论文摘要
  6. 核心关键词
  7. 参考文献
  8. 生成提纲

首屏表单项包括：
- 学科分类
- 问题/背景关键词
- 问题/背景说明
- 方法/理论关键词
- 方法/理论说明

对应初始化接口：
- `POST /api/gptapi/paper/subject`

结论：
- 项目申请与论文写作不是一个表单改个文案
- 它们是两个不同工作流

### 8.4 AI写作 的可能内部逻辑

高可信推断：

1. 列表页管理用户写作记录
- 搜索
- 时间过滤
- 分类型
- 分页

2. 创建写作后进入专用编辑器
- 项目申请编辑器
- 期刊论文编辑器

3. 编辑器先收集结构化上下文
- 资助机构 / 项目类型 / 学科 / 关键词 / 摘要 / 背景 / 方法

4. 后端不是一次性出全文
- 更像分阶段：
  - 生成大纲
  - 生成章节
  - 润色 / 重写

5. 专用生成服务单独部署
- `generateApplyUrl` 指向独立写作服务

### 8.5 与当前仓库 `ai-write` 的关系

当前仓库 `ai-write` 已经实现了一个很强的写作引擎雏形：
- `create`
- `generateOutline`
- `generateSection`
- `polish`

并且内部逻辑与上面的推断高度接近：
- 模板分型：`project_proposal` / `journal_paper`
- 可注入检索知识
- 先大纲，再分章节，再全文润色
- 章节生成后再做自评改写

结论：
- 你后端的写作引擎并不弱
- 真正缺的是产品层：
  - 用户记录
  - 分页过滤
  - 编辑器状态
  - 版本 / 作业模型
  - 前台接线

当前关键缺口：
- `AIWriteTask` 没有 `userId`
- 前端列表页是空壳
- 前端 `project | paper` 与后端 `project_proposal | journal_paper` 枚举不一致
- 没有写作作业 / 进度 / 版本模型

推荐补充模型：
- `WriteRecord`
- `WriteVersion`
- `WriteJob`

---

## 9. AI检查 深度分析

### 9.1 已观测到的真实页面行为

`/stigpt/check` 已实测包含：
- 类型切换：`项目` / `论文` / `专利`
- 过滤：`上传时间`
- 搜索
- `上传文件`
- 额外入口：`合规检查支持的项目类型`
- 表格列：`名称`、`上传时间`、`检查`、`操作`

接口：
- `POST /api/gptapi/aiCheck/list`
- 请求体：`pageNo`、`pageSize`、`checkTime`、`searchKey`、`busType`

结论：
- 它是“任务列表 + 上传入口 + 报告查看”的标准异步任务产品

### 9.2 AI检查 不是一个功能，而可能是三个子能力编排

从路由和页面证据看，STIGPT 同时存在：
- `check`
- `semantic`
- `complianceInspection`
- `inspect`

这意味着高概率存在三层能力：
- 语义相似 / 查重
- 合规 / 规则检查
- 编辑建议 / 修订提示

推断：
- `AI检查` 更像一个统一外壳
- 内部可能编排多个引擎，而不是只跑一次 LLM

### 9.3 AI检查 的可能内部逻辑

高可信推断：

1. 用户上传文件，创建记录
2. 后端异步解析文档
3. 拆段 / 分块
4. 对已有学术语料做相似度召回
5. rerank
6. LLM 判断是合理引用、表述相似、还是实质重合
7. 并行跑规则 / 合规检查
8. 聚合成报告
9. 列表页展示状态和入口

### 9.4 与当前仓库 `ai-check` 的关系

当前仓库已经有：
- 上传
- 状态
- 报告
- 列表
- 语义查重式管线

内部流程是：
- parse
- vector retrieval
- rerank
- LLM judgement
- 聚合报告

这和线上产品的“语义检查”部分是高度对齐的。

但与 ScholarMate 的差距也很明确：
- 没有 `userId`
- 列表没有分页 / 过滤 / 搜索
- 没有 durable job queue
- 当前强依赖 `kbId`
- `project / paper / patent` 目前只是标签分支，不是不同检查策略
- 还没有单独的合规 / 规则层

结论：
- 当前仓库已具备 AI检查 的核心推理底座
- 但产品形态还没达到 ScholarMate 的“统一检查平台”水平

---

## 10. AI评审 深度分析

### 10.1 已观测到的真实页面行为

`/stigpt/review` 已实测包含：
- 类型切换：`项目` / `论文`
- 过滤：`上传时间`
- 搜索
- `上传文件`
- 表格列：`名称`、`上传时间`、`评审`、`操作`

接口：
- `POST /api/gptapi/aiReviewRecord/list`
- 请求体：`pageNo`、`pageSize`、`checkTime`、`searchKey`、`docType`

并且 `sysinfo` 暴露了：
- `aiReviewChatUrl`

结论：
- AI评审 是独立后端服务边界
- 列表页只是记录管理入口

### 10.2 AI评审 的可能内部逻辑

高可信推断：

1. 上传文档，创建评审记录
2. 后端抽取结构化信息
- 标题
- 摘要
- 方法
- 实验
- 结论

3. 根据 `docType` 选择评分规则
- `projectReview`
- `paperReview`

4. 检索该领域的标准、范式或参考案例
5. LLM 按维度独立评分
6. 做加权汇总
7. 生成综合意见、修改建议、可视化数据

### 10.3 与当前仓库 `ai-review` 的关系

当前仓库 `ai-review` 与这个推断非常接近：
- 先 parse
- 再 ingest 提取结构化字段
- 依据项目 / 论文配置不同维度
- 逐维度评分
- 生成总分、建议、summary、radarChartData

这是当前仓库与 ScholarMate 最接近的一块。

主要差距：
- 没有 `userId`
- 列表没有分页过滤
- 没有 durable worker
- 维度配置还过于固定
- 没有按具体项目类型 / 期刊 / 学科做 rubric 外置
- 还没有显式保留 benchmark provenance

结论：
- AI评审 在你现仓里已经有很强的雏形
- 要补的是“产品级记录系统 + 可扩展 rubric + 多场景配置”

---

## 11. 当前仓库的真实复用潜力

### 11.1 可直接复用

后端模块：
- `backend/src/rag`
- `backend/src/knowledge`
- `backend/src/document`
- `backend/src/paper`
- `backend/src/ai-write`
- `backend/src/ai-check`
- `backend/src/ai-review`
- `backend/src/avatar`
- `backend/src/linly-talker`

基础设施：
- Prisma / PostgreSQL
- Redis
- Milvus
- LightRAG 集成思路
- DashScope / Qwen 调用

### 11.2 最该避免直接复用的地方

不应继续让下面这些成为 STIGPT 问答的核心模型：
- `Ticket`
- `Session`
- `Message`

因为它们天然带着客服域假设：
- 提单
- 排队
- 分配客服
- 转人工
- 满意度

ScholarMate 的 AI问答更接近：
- conversation
- model
- route mode
- examples
- citations
- provider state

### 11.3 当前前端的真实状态

`player-app` 已经吸收了 ScholarMate 的页面命名和布局方向：
- `/profile`
- `/contacts`
- `/groups`
- `/ai/write`
- `/ai/check`
- `/ai/review`

但多数仍是 UI 壳层：
- 首页：静态推荐 + 空动态
- Profile：空资料
- Contacts：空列表
- AI 写作 / 检查 / 评审：空表格或静态壳

---

## 12. 推荐的目标架构

### 12.1 宿主层

继续用现有 React 前台，不必第一阶段就照搬 iframe 架构。

建议先做：
- `/apps` 风格首页
- `/profile`
- `/contacts`
- `/groups`
- `/library`
- 顶栏 + 更多菜单

### 12.2 STIGPT 问答层

新增 `stigpt-chat` 域，而不是继续挤在客服域里。

推荐表：
- `StigptConversation`
- `StigptMessage`
- `StigptModel`
- `StigptExample`
- `StigptPageConfig`
- `StigptRouteBinding`

### 12.3 写作 / 检查 / 评审层

保留现有模块名：
- `ai-write`
- `ai-check`
- `ai-review`

但补充：
- `userId`
- 过滤 / 分页
- job / progress
- 可扩展状态机
- version / report summary

### 12.4 传输方式

建议：
- AI问答：SSE
- 工单 / 数字人状态：Socket.IO
- 写作 / 检查 / 评审：REST + 异步任务状态轮询

---

## 13. 对四个 AI 功能的最终判断

### AI问答

真实产品形态：
- 不是单一聊天页
- 是带路由模式、示例问题、历史会话、权限控制、专门语料域的问答工作台

当前仓库最缺：
- 正确的会话模型
- 服务端会话列表
- 示例问题 / 模型配置
- 流式回答产品层

### AI写作

真实产品形态：
- 不是“一键生成文章”
- 是记录列表 + 类型化编辑器 + 分步骤起草流程

当前仓库最缺：
- 用户记录管理
- 前台编辑器
- 版本 / 作业模型
- 列表过滤与分页

### AI检查

真实产品形态：
- 很可能是“语义检查 + 合规检查 + 编辑建议”的统一外壳

当前仓库最缺：
- 合规 / 规则层
- 按类型定制策略
- durable queue
- 用户维度记录管理

### AI评审

真实产品形态：
- rubric 驱动的异步评审记录系统
- 项目与论文是两种独立评分范式

当前仓库最缺：
- 用户记录管理
- 外置 rubric
- benchmark provenance
- 场景化 docType 扩展

---

## 14. 建议的实施顺序

### Phase 1
- 完成宿主壳层
- 把前台改造成 ScholarMate 风格信息架构

### Phase 2
- 新建 `stigpt-chat` 域
- 做出 `/stigpt/webIdx`
- 接上服务端会话列表、示例问题、SSE

### Phase 3
- 把 `ai-write` 从后端引擎升级成“记录 + 编辑器 + 作业”产品

### Phase 4
- 把 `ai-check`、`ai-review` 补齐分页过滤、用户记录、异步作业、报告页

### Phase 5
- 视复杂度决定是否再做真正的宿主 / 子应用拆分

---

## 15. 当前仓库代码映射

这一节不是再重复功能结论，而是把四个核心能力直接映射到当前仓库里的真实实现位置，方便后续改造时少走弯路。

### 15.1 AI问答 在当前仓库里的真实落点

前端入口与页面：
- `frontend/player-app/src/pages/SubmitTicket/index.tsx`
- `frontend/player-app/src/pages/Chat/index.tsx`
- `frontend/player-app/src/components/Chat/ChatSidebar.tsx`
- `frontend/player-app/src/pages/DigitalHuman/index.tsx`

后端主链路：
- `backend/src/session/session.controller.ts`
- `backend/src/session/session.service.ts`
- `backend/src/message/message.service.ts`
- `backend/src/websocket/websocket.gateway.ts`
- `backend/src/session/session-rag.service.ts`
- `backend/src/dify/dify.service.ts`
- `backend/src/rag/rag.controller.ts`

数据模型：
- `Ticket`
- `Session`
- `Message`
- `Citation`

真实情况判断：
- 现在的聊天入口是“提交问题单 -> 创建会话 -> 进入聊天页”
- 历史列表不是 ScholarMate 那种服务端 `chatlist`，而更像本地拼装出来的会话列表
- 现有问答更偏“科研主题客服”，不是“科研工作台”
- SSE 已经在 `rag` 模块里存在，但主聊天链路仍偏同步式消息落库 + Socket.IO 广播

结论：
- AI问答 的底层能力能复用
- 但产品域模型必须抽离出新的 `stigpt-chat`
- 不能继续让 `Ticket / Session / Message` 充当 STIGPT 问答主模型

### 15.2 AI写作 在当前仓库里的真实落点

前端页面：
- `frontend/player-app/src/pages/AIWrite/index.tsx`

后端主链路：
- `backend/src/ai-write/ai-write.controller.ts`
- `backend/src/ai-write/ai-write.service.ts`
- `backend/src/rag/dual-route.service.ts`

数据模型：
- `AIWriteTask`

真实情况判断：
- 前端已经做了 ScholarMate 风格的列表壳层，但数据还是空的
- 后端已经具备分阶段写作能力：
  - `create`
  - `generateOutline`
  - `generateSection`
  - `polish`
- 写作逻辑已经是“先提纲，再章节，再全文润色”的生成链
- 还缺少真实产品层：
  - 用户维度记录
  - 版本
  - 作业
  - 编辑器状态
  - 前后端接线

关键问题：
- 前端类型是 `project | paper`
- 后端模板类型是 `project_proposal | journal_paper`
- 这会直接导致接线时出现类型漂移

结论：
- AI写作 不是要重写引擎
- 是要补“记录系统 + 编辑器系统 + 作业系统”

### 15.3 AI检查 在当前仓库里的真实落点

前端页面：
- `frontend/player-app/src/pages/AICheck/index.tsx`

后端主链路：
- `backend/src/ai-check/ai-check.controller.ts`
- `backend/src/ai-check/ai-check.service.ts`
- `backend/src/rag/retrieval.service.ts`
- `backend/src/rag/rerank.service.ts`

数据模型：
- `AICheckTask`

真实情况判断：
- 后端已经具备语义检查主链路：
  - 文档解析
  - 检索召回
  - rerank
  - LLM 判断
  - 报告聚合
- 这和线上站点中 `semantic` 那一层很接近
- 前端仍然只是“上传 + 空表格”的壳

主要缺口：
- 没有用户维度记录
- 没有与 ScholarMate 接近的 `pageNo/pageSize/checkTime/searchKey/busType`
- 缺 durable queue
- 缺合规规则层
- 缺按 `project / paper / patent` 的真正差异化策略

结论：
- AI检查 的推理底座已经够用
- 产品层、异步层、规则层还不够

### 15.4 AI评审 在当前仓库里的真实落点

前端页面：
- `frontend/player-app/src/pages/AIReview/index.tsx`

后端主链路：
- `backend/src/ai-review/ai-review.controller.ts`
- `backend/src/ai-review/ai-review.service.ts`

数据模型：
- `AIReviewTask`

真实情况判断：
- 这是四个能力里与目标站最接近的一块
- 后端已经实现了：
  - 文档抽取
  - 多维度评分
  - 权重汇总
  - 建议生成
  - radarChartData 之类的报告数据
- 当前前端依然是静态列表壳层

主要缺口：
- 没有用户维度记录
- 没有分页过滤
- rubric 仍然写死在服务层
- 没有 benchmark provenance
- 没有 durable worker

结论：
- AI评审 可以优先产品化
- 因为后端成熟度已经明显高于前三者

---

## 16. 必须先修的跨模块问题

如果不先处理这些横向问题，后面四个能力都会反复返工。

### 16.1 多租户与用户归属缺失

当前这些核心表都没有稳定的用户归属字段：
- `AIWriteTask`
- `AICheckTask`
- `AIReviewTask`
- `Paper`

影响：
- 无法做“我的记录”
- 无法做分页过滤
- 无法做权限隔离
- 无法复制 ScholarMate 的记录列表页

建议：
- 至少补 `userId`
- 更稳妥是补 `workspaceId`

### 16.2 鉴权与 ACL 不统一

当前仓库里有些知识库 / RAG 接口是受保护的，但 `ai-write`、`ai-check`、`ai-review` 这类核心能力并没有统一收口到真实用户上下文。

影响：
- 记录无法严格归属
- 知识库权限与消费能力会打架
- 以后接 ScholarMate 风格的“我的数据 / 我的知识 / 我的写作记录”会很别扭

建议：
- 统一要求所有面向最终用户的 STIGPT 能力都在登录上下文下执行
- 管理端与用户端明确分离

### 16.3 异步作业体系不够稳定

当前多个能力仍然是控制器创建记录后，直接在应用进程里 fire-and-forget 执行：
- `ai-check`
- `ai-review`
- `paper`
- `document`

影响：
- 服务重启会丢任务
- 长任务状态不可控
- 难以做重试、进度、并发限流

建议：
- 引入统一 `JobModule`
- 任务表最少补：
  - `jobType`
  - `status`
  - `progress`
  - `phase`
  - `startedAt`
  - `finishedAt`
  - `error`

### 16.4 Provider / Model 配置没有形成控制平面

现在模型与服务调用散落在：
- 直接 DashScope / Qwen
- RAG LLM
- Embedding
- Rerank
- Dify

影响：
- 不同功能使用的模型不可统一调配
- 页面级 model picker 很难落地
- 也不利于后面做 `chatmodel` 那种接口

建议：
- 建一个真正的 `ApiConfigModule` 或 `ProviderConfigModule`
- 至少管理：
  - provider credentials
  - feature -> model binding
  - routeKey -> provider strategy

### 16.5 文档与论文摄取链路是分裂的

当前：
- `document` 走知识库文档管线
- `paper` 走论文元数据和向量化管线

影响：
- AI写作 / AI阅读 / AI评审 的来源资产会越来越分裂
- 报告溯源、引用追踪、权限继承都会变复杂

建议：
- 统一成一个 `ResearchAsset` 或等价抽象
- 文档、论文只是不同 subtype

### 16.6 状态枚举存在漂移

例如文档状态在不同地方出现了 `ready` 与 `completed` 的不一致。

影响：
- 列表统计可能错误
- 管理页与后台任务状态会对不上

建议：
- 在正式产品化前先统一枚举

---

## 17. 可直接照着做的最小实现蓝图

这一节不是终局架构，而是“先把最像 ScholarMate 的第一版做出来”的最小路线。

### 17.1 AI问答 最小蓝图

新增表：
- `StigptConversation`
- `StigptMessage`
- `StigptModel`
- `StigptExample`
- `StigptPageConfig`

最小字段建议：
- `StigptConversation`
  - `id`
  - `userId`
  - `routeKey`
  - `title`
  - `modelId`
  - `personaId`
  - `kbId`
  - `providerConversationId`
  - `lastMessageAt`
  - `metadata`
- `StigptMessage`
  - `id`
  - `conversationId`
  - `role`
  - `content`
  - `status`
  - `citations`
  - `tokenUsage`
  - `metadata`

最小接口：
- `GET /api/v1/stigpt/page-config`
- `GET /api/v1/stigpt/me`
- `GET /api/v1/stigpt/models`
- `GET /api/v1/stigpt/examples`
- `GET /api/v1/stigpt/conversations`
- `POST /api/v1/stigpt/conversations`
- `GET /api/v1/stigpt/conversations/:id`
- `POST /api/v1/stigpt/conversations/:id/messages`

最小页面：
- `/stigpt/webIdx`

关键实现原则：
- 历史会话必须服务端管理
- 回复必须走 SSE
- `routeKey` 要能切换 `webIdx / answer/policy / answer/project / aiRead`

### 17.2 AI写作 最小蓝图

保留现有 `ai-write` 服务，但扩展三层对象：
- `WriteRecord`
- `WriteVersion`
- `WriteJob`

最小接口：
- `POST /api/v1/ai-write/list`
- `POST /api/v1/ai-write/create-record`
- `GET /api/v1/ai-write/records/:id`
- `POST /api/v1/ai-write/records/:id/generate-outline`
- `POST /api/v1/ai-write/records/:id/generate-section`
- `POST /api/v1/ai-write/records/:id/polish`
- `GET /api/v1/ai-write/jobs/:id`

关键实现原则：
- 列表页是记录页，不是编辑器首页
- 项目申请与期刊论文必须分工作流
- 先接通最小“提纲 -> 章节 -> 润色”链路，再做高级编辑器能力

### 17.3 AI检查 最小蓝图

保留现有 `ai-check` 服务，新增：
- 用户归属
- 分页过滤
- job 进度
- 合规规则插件层

最小接口尽量贴近线上：
- `POST /api/v1/ai-check/list`
- `POST /api/v1/ai-check/upload`
- `GET /api/v1/ai-check/status/:id`
- `GET /api/v1/ai-check/report/:id`

关键实现原则：
- 列表响应要支持：
  - `pageNo`
  - `pageSize`
  - `checkTime`
  - `searchKey`
  - `busType`
- 第一版先做“语义检查 + 基础报告”
- 第二版再做“合规检查 + 编辑建议”

### 17.4 AI评审 最小蓝图

保留现有 `ai-review` 服务，扩展：
- 用户归属
- 过滤分页
- rubric 外置
- benchmark provenance

最小接口尽量贴近线上：
- `POST /api/v1/ai-review/list`
- `POST /api/v1/ai-review/upload`
- `GET /api/v1/ai-review/status/:id`
- `GET /api/v1/ai-review/report/:id`

关键实现原则：
- `project` 与 `paper` 必须走不同 rubric
- rubric 不应长期写死在 service 里
- 报告页要能解释“为什么是这个分数”

---

## 18. 最终结论

ScholarMate / STIGPT 最值得抄的，不是“页面长得像什么”，而是这三层：

1. 宿主平台与 AI 子系统分层
2. 每个 AI 能力都是一个独立产品流，而不是一个 prompt
3. 记录、配置、权限、异步任务、服务拆分都在产品层可见

当前 `game-ai` 的最佳路线不是推倒重来，而是：
- 保留现有 AI 基础设施
- 重构前台与会话域模型
- 把 AI 写作 / 检查 / 评审接成真正的产品
- 把客服域退居次要位置

这条路线成本最低，也最接近真实可落地的 ScholarMate 学习版。
