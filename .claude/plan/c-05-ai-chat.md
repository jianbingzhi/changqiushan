# 子计划 05 · AI 智能问答（modules/ai + 直连大模型 + A7 流式对话）

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。对应 R-AI 决策（Gemini 式流式对话 + 历史会话）。
> **不做 RAG**：直连大模型 API，无向量检索/知识库召回/来源引用。景区专属知识作为 **system prompt 背景**注入即可（PRD 2.4「结合景区专属知识库」的轻量做法）。

## Task Type
- [x] Backend（新 `modules/ai`）  - [x] Frontend（A7，分包 `subpkg-ai`）

## 范围
新增 AI 对话用例：会话/消息持久化 + 大模型上游流式输出。前端在小程序约束下做流式（无 EventSource → chunked）。知识库不做检索召回，仅把一段固定的景区背景知识拼进 system prompt（可后台配置）。

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/prisma/models/ai.prisma` | Create | `AiConversation`(visitorId 应用层关联/title) + `AiMessage`(role 枚举/content) |
| `app/src/modules/ai/index.ts` | Create | 导出 `aiService` |
| `app/src/modules/ai/service/chat.ts` | Create | `streamChat({visitorId,conversationId?,message})`（流式 generator）；`listConversations/getMessages` |
| `app/src/modules/ai/repository.ts` | Create | 会话/消息表 CRUD |
| `app/src/modules/ai/domain/{schema,prompt}.ts` | Create | 入参 schema；system prompt 模板（景区背景知识 + 角色设定，可后台配置） |
| `app/src/lib/ai/client.ts` | Create | 大模型 client（baseURL/model/key 来自集成配置中心，不下发；超时/重试/降级）；直连，不接检索 |
| `app/src/app/api/c/ai/chat/route.ts` | Create | `POST` 流式响应（chunked，`text/event-stream`-like 帧） |
| `app/src/app/api/c/ai/conversations/route.ts`、`[id]/messages/route.ts` | Create | 历史会话/消息 |
| `../Changqiushan-mobile/src/subpkg-ai/chat/*` | Create | A7 对话页 |
| `../Changqiushan-mobile/src/api/ai.ts` | Create | `enableChunked` 流式封装 |

## 后端流式伪码
```ts
// api/c/ai/chat/route.ts
const v = await requireVisitor(req)
const { message, conversationId } = await req.json()
const stream = new ReadableStream({ async start(ctrl) {
  await aiRepo.appendUser(conversationId, message)
  const history = await aiRepo.getMessages(conversationId)      // 多轮上下文
  let full = ""
  for await (const tok of aiService.streamChat({ system: SCENIC_SYSTEM_PROMPT, history, message })) {
    full += tok; ctrl.enqueue(`data:${JSON.stringify({t:tok})}\n\n`)
  }
  await aiRepo.appendAssistant(conversationId, full)
  ctrl.close()
}})
return new Response(stream, { headers:{ "Content-Type":"text/event-stream", "Cache-Control":"no-cache" }})
```
```ts
// lib/ai/client.ts —— 直连大模型, 无检索
async *streamChat({ system, history, message }) {
  const { baseURL, model, apiKey } = await integrationConfig.ai()   // 服务端读, 不下发
  const res = await fetch(`${baseURL}/chat/completions`, { method:"POST", headers:{Authorization:`Bearer ${apiKey}`},
    body: JSON.stringify({ model, stream:true, messages:[{role:"system",content:system}, ...history, {role:"user",content:message}] }) })
  for await (const tok of parseSSE(res.body)) yield tok            // 上游 token 流逐字 yield
}
```

## 前端流式伪码（小程序无 EventSource）
```ts
const task = Taro.request({ url:`${BASE}/ai/chat`, method:"POST", enableChunked:true, data:{...}, header:{Authorization} })
const dec = new TextDecoder(); let buf=""
task.onChunkReceived(({data}) => {
  buf += dec.decode(new Uint8Array(data), {stream:true})
  // 按 \n\n 切帧, data:{t} 累加进当前 AI 气泡(节流批量 flush)
})
// 降级: enableChunked 老基础库失败 → 整段返回 + 打字机动画
```
- Markdown 渲染：累加文本 → `MpHtml`(marked→白名单)。
- 帧内可夹结构化"库存指令" `{type:"stock",slot,remaining}` → 渲染"立即预约"按钮，跳 A3/A4 闭环（这是直连后端可加的轻增强，非 RAG）。
- 左侧历史会话：按时间分组、分页、可检索。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| `enableChunked` 兼容 | 真机多版本回归；降级整段+打字机；设最低基础库版本 |
| AI key 泄漏 | 仅服务端集成配置中心；端只调 BFF |
| 流式占用连接+本机内存 | 限单游客并发会话；重任务交 pg-boss，别和 AI 流抢同步资源 |
| system prompt 过长/成本 | 景区背景知识精简可配；多轮历史截断保留近 N 轮 |

## Checkpoint
| Sub-step | Done |
|---|---|
| ai.prisma + migrate + repo | [ ] |
| 大模型 client(直连) + system prompt 模板 | [ ] |
| `POST /api/c/ai/chat` 流式 + 历史接口 | [ ] |
| A7 chunked 流式 + Markdown + 历史会话 | [ ] |
| 库存指令闭环跳预约 | [ ] |
| 真机流式回归 + 降级路径验 | [ ] |
