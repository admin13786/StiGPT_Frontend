# STIGPT WebIdx + Chat Skeleton Implementation Plan

> **Archive note:** This file is a historical implementation plan from 2026-04-18. It is not the current source of truth for startup steps, ports, or shipped scope.
> 
> Current source of truth:
> - startup / ports: `README.md`
> - default player entry: `/apps/stigpt/webIdx`
> - current implemented product behavior: `docs/产品使用文档.md`
> 
> Legacy `/stigpt/*` route strings below are preserved as written in the original plan. Current canonical user-facing paths in this repo are under `/apps/stigpt/*`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Historical goal:** Add a real `/stigpt/webIdx` entry page plus a new `stigpt-chat` backend domain so ScholarMate-style AI Q&A no longer depends on the support `Ticket -> Session -> Message` model.

**Architecture:** Keep the current React player shell and NestJS monolith, but add a parallel STIGPT conversation domain. Phase 2 only ships the product skeleton: server-owned conversations, page config, model list, example prompts, message persistence, and a placeholder assistant reply. Streaming, route-specialized RAG, and full job orchestration stay as follow-up tasks.

**Tech Stack:** React 18, Ant Design, Zustand, Axios, NestJS 10, Prisma 5, PostgreSQL, JWT auth.

---

### Task 1: Add Prisma models for STIGPT chat

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Steps:**
1. Add `StigptConversation`, `StigptMessage`, `StigptChatModel`, `StigptExample`, and `StigptPageConfig`.
2. Add `User.stigptConversations` relation.
3. Keep fields minimal:
   - `Conversation`: `userId`, `routeKey`, `title`, `modelId`, `personaId`, `kbId`, `providerConversationId`, `status`, `lastMessageAt`, `metadata`
   - `Message`: `conversationId`, `role`, `content`, `status`, `citations`, `tokenUsage`, `metadata`
   - `ChatModel`: `code`, `name`, `provider`, `supportedRoutes`, `isDefault`, `isActive`
   - `Example`: `routeKey`, `title`, `prompt`, `sortOrder`, `modelId?`, `isActive`
   - `PageConfig`: `routeKey`, `pageTitle`, `assistantName`, `welcomeMessage`, `inputPlaceholder`, `config`
4. Add useful indexes on `userId`, `routeKey`, `createdAt`, `lastMessageAt`, and `isActive`.

**Verification:**
- Run: `cd backend; npx prisma format`
- Run: `cd backend; npx prisma validate`

### Task 2: Generate Prisma client

**Files:**
- No source changes

**Steps:**
1. Regenerate Prisma client after schema update.

**Verification:**
- Run: `cd backend; npx prisma generate`
- Expected: Prisma Client generated successfully.

### Task 3: Create `stigpt-chat` Nest module skeleton

**Files:**
- Create: `backend/src/stigpt-chat/stigpt-chat.module.ts`
- Create: `backend/src/stigpt-chat/stigpt-chat.controller.ts`
- Create: `backend/src/stigpt-chat/stigpt-chat.service.ts`
- Create: `backend/src/stigpt-chat/dto/create-conversation.dto.ts`
- Create: `backend/src/stigpt-chat/dto/create-message.dto.ts`
- Modify: `backend/src/app.module.ts`

**Steps:**
1. Register a new module named `StigptChatModule`.
2. Protect controller routes with `JwtAuthGuard`.
3. Inject `PrismaService`.
4. Add phase-2 endpoints:
   - `GET /stigpt/page-config`
   - `GET /stigpt/me`
   - `GET /stigpt/models`
   - `GET /stigpt/examples`
   - `GET /stigpt/conversations`
   - `POST /stigpt/conversations`
   - `GET /stigpt/conversations/:id`
   - `POST /stigpt/conversations/:id/messages`

**Verification:**
- Run: `cd backend; npm run build`
- Expected: Nest backend compiles without TS errors.

### Task 4: Bootstrap default STIGPT data in service layer

**Files:**
- Modify: `backend/src/stigpt-chat/stigpt-chat.service.ts`

**Steps:**
1. Add an internal `ensureBootstrapData()` helper.
2. Upsert one default page config for `webIdx`.
3. Upsert 2-3 default models.
4. Upsert 4-6 default example prompts for `webIdx`.
5. Keep this bootstrap logic idempotent so the page works without a seed script.

**Verification:**
- Run backend locally.
- Hit `GET /stigpt/page-config?routeKey=webIdx`.
- Expected: JSON payload exists even on a fresh database.

### Task 5: Implement minimal conversation behavior

**Files:**
- Modify: `backend/src/stigpt-chat/stigpt-chat.service.ts`

**Steps:**
1. `createConversation()` should create a server-owned conversation row.
2. `listConversations()` should return only current user records, newest first.
3. `getConversation()` should include ordered messages.
4. `createMessage()` should:
   - verify ownership
   - persist the user message
   - synthesize one placeholder assistant reply
   - update `lastMessageAt` and auto-title empty conversations
5. Keep reply generation deterministic and explicit that streaming/RAG is pending.

**Verification:**
- Use Swagger or curl to create a conversation.
- Post a message.
- Fetch the conversation again.
- Expected: both user and assistant messages are present.

### Task 6: Add frontend STIGPT service client

**Files:**
- Create: `frontend/player-app/src/services/stigpt.service.ts`
- Create: `frontend/player-app/src/types/stigpt.ts`

**Steps:**
1. Add typed wrappers around the new backend endpoints.
2. Reuse existing `apiClient`.
3. Keep types aligned with Phase 2 payloads:
   - `StigptPageConfig`
   - `StigptChatModel`
   - `StigptExample`
   - `StigptConversation`
   - `StigptMessage`

**Verification:**
- Run: `cd frontend/player-app; npm run build`
- Expected: frontend type-check passes.

### Task 7: Create `/stigpt/webIdx` page skeleton

**Files:**
- Create: `frontend/player-app/src/pages/StigptWebIdx/index.tsx`
- Create: `frontend/player-app/src/pages/StigptWebIdx/index.css`

**Steps:**
1. Build a 3-column layout:
   - left: conversation list and new conversation button
   - center: message stream and input box
   - right: model list and example prompts
2. Load page config, user info, models, examples, and conversations on mount.
3. Allow:
   - create conversation
   - switch conversation
   - send message
   - click example prompt to fill or send
4. Show clear Phase 2 placeholder text where streaming and citations are not ready yet.

**Verification:**
- Run the frontend dev server.
- Open `/stigpt/webIdx`.
- Expected: page renders, data loads, and a message round-trip works.

### Task 8: Wire route and shell navigation

**Files:**
- Modify: `frontend/player-app/src/App.tsx`
- Modify: `frontend/player-app/src/layouts/MainLayout.tsx`

**Steps:**
1. Register `/stigpt/webIdx` as a protected route.
2. Add one menu entry for AI问答 in the top navigation or More menu.
3. Keep existing `/ai/write`, `/ai/check`, `/ai/review` routes intact.
4. Make active-state logic recognize `/stigpt/`.

**Verification:**
- Start frontend and navigate from the main shell.
- Expected: AI问答 menu leads to `/stigpt/webIdx`.

### Task 9: Add explicit follow-up placeholders

**Files:**
- Modify: `frontend/player-app/src/pages/StigptWebIdx/index.tsx`
- Modify: `backend/src/stigpt-chat/stigpt-chat.service.ts`

**Steps:**
1. Mark missing features explicitly instead of hiding them:
   - SSE streaming pending
   - route-specialized modes pending
   - citations pending
   - provider routing pending
2. Keep those placeholders in code comments or UI text so later work is obvious.

**Verification:**
- Manual UI inspection.
- Expected: users can tell which parts are skeletal and which are real.

### Task 10: Expand into Phase 3 tasks

**Files:**
- Modify: `docs/2026-04-18-scholarmate-site-research-report.md`
- Modify: `docs/plans/2026-04-18-stigpt-phase2-webidx-and-chat-implementation.md`

**Steps:**
1. Record what shipped in Phase 2.
2. Record what remains:
   - SSE stream endpoint
   - `routeKey`-specific strategy layer
   - `aiRead` and policy/project modes
   - persistent page config admin UI
   - user/workspace ownership rollout for write/check/review

**Verification:**
- Review docs for consistency with shipped code.

---

Plan complete and saved to `docs/plans/2026-04-18-stigpt-phase2-webidx-and-chat-implementation.md`.
