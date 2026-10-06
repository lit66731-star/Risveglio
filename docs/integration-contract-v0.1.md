# Risveglio Integration Contract v0.1

> 状态：定义稿（Phase 1）。这是一份**技术合同**，供未来写代码时对照，不是产品说明。
> 依据：Serendipity `2.3.14`（105 commits）与 Amor `1.15.1`（35 commits）的**源码核验**结果。
> World / Actor / Guard 的内部结构**不在本版范围**（只在 §3 / §15 出现一次）。

---

## 1. Purpose

定义 Risveglio Runtime 如何与两个上游插件对接：

- **Serendipity**（Fact Layer，事实层）
- **Amor**（Interpretation Layer，解释层）

Risveglio **只通过它们的公开只读接口读取**，经 Adapter 规范化后供 Runtime 消费，并以 `revision` 指纹实现「无变化 → 不思考」的门控。本版不定义 Risveglio 自有模块（World / Actor / Guard）的内部数据。

## 2. Scope

**范围内：**

- 三个公开只读接口的精确入参 / 出参与规范化。
- Adapter 契约、能力检测、缓存、门控、降级、处理锁。
- 数据所有权边界与「不写回」边界。

**范围外：** 见 §15。

## 3. Ownership Model

三层各自独立存储。**Risveglio 是第三层，叠加而非接管。**

| 层 | 插件 | 拥有 |
| --- | --- | --- |
| Fact | Serendipity 2.3.14 | 记忆 / 时间轴 / 人物实体 / 关系 / 世界事实 / 伏笔 / 一致性 / 语义召回。数据按「角色 + 聊天」隔离。 |
| Interpretation | Amor 1.15.1 | 导演 / 规划 / 节拍 / 剧情线 / 情绪弧 / 知识状态 / 伏笔导演 / 巡检 / 健康 / 因果 / 医生 / 选择。只解释，不写回 Serendipity 事实。 |
| Runtime | Risveglio | 自己的 Simulation（世界推演）/ Performance（角色表现）/ Guard（规则·违例·诊断）状态。**不拥有** memories / timeline / characters / relationships / foreshadows / plotThreads 等。 |

**关键区分**：Serendipity 的 `worldState` 是「已确认世界事实」；Risveglio 的 World 是「运行中的推演状态」。二者**可以存在差异**——只有被剧情确认的推演，将来才有资格成为 Fact，但这条写回路径本版明确不做（§13）。

## 4. Upstream Public API

### 4.1 Serendipity（`window.Serendipity`，共 2 个只读函数）

```js
getDirectorContext(opts) -> {
  schema: 1,
  purpose: string,
  revision: string,         // String(getStringHash(JSON.stringify(all))) —— 事实指纹
  tokenBudget: number,
  estimatedTokens: number,
  truncated: boolean,
  sections: { ... },        // 仅含 include 命中的 section
  text: string,             // 拼接后的正文
}
```

- `opts` 省略或非对象 → **旧用法**，返回拼接字符串（无 `revision` 字段）。**Adapter 不依赖旧用法。**
- `opts.include`：过滤 `DIRECTOR_SECTIONS`（8 个）：
  `storyTime / recentMemory / timeline / characters / relationships / worldState / foreshadows / consistency`。
  默认 include = 除 `consistency` 外全部。
- `opts.tokenBudget`：默认 `2500`，最小 `200`。
- **`revision` 不是 cheap probe**：每次调用都先 `buildDirectorSections()` 把全部 8 个 section build 出来再哈希（本地、无 AI，但非零成本）。
- `settings` 未加载时，带 `opts` 调用返回 `null`。

```js
getForeshadows() -> {
  storyDay: number | null,
  items: [{ id, title, status, note, day }],
} | null
```

### 4.2 Amor（`window.Amor`，共 1 个只读函数）

```js
getStoryDirection({ include }) -> {
  revision: { amorRevision, lastProcessedMessageIndex, serendipityRevision },  // 对象，非字符串
  currentScene, currentBeat, directorState, activeGoals,
  plotThreads, emotionalArcs, knowledgeState, foreshadowPlan,
  choices, doctorOrders, doctorReport, storyArc, causalChains,
  inspection:  function,    // 需 safeCall
  storyHealth: function,    // 需 safeCall
}
```

- `include` 数组过滤返回字段。
- `inspection` / `storyHealth` 是**函数**，Adapter 必须安全调用。
- 无当前聊天时返回 `null`。

## 5. Adapter Contract

```
window.Risveglio.adapters.serendipity
window.Risveglio.adapters.amor
```

Serendipity Adapter：

```js
{
  available(): boolean,
  getContext(opts): NormalizedFactContext | null,
  getForeshadows(): NormalizedForeshadows | null,
  getRevision(): string | null,   // 来自缓存 lastResult.revision，绝不额外调用
}
```

Amor Adapter：

```js
{
  available(): boolean,
  getDirection(opts): NormalizedDirection | null,
  getRevision(): string | null,   // 来自缓存
}
```

**硬约束**：Adapter 是 Runtime 接触上游的**唯一通道**。Runtime 不得直接访问 `window.Serendipity` / `window.Amor`，不得碰它们的内部变量与存储键。

## 6. Normalized Data Contract

Adapter 把上游返回规范化为稳定结构（上游升级只改 Adapter）：

- Amor 的 `inspection` / `storyHealth`：`safeCall(fn)` 包裹 `try/catch`，失败返回 `null`。
- 所有返回对象**深拷贝（clone）**，不让 Runtime 拿到上游活引用。
- `revision` 统一为字符串（§7）。

## 7. Revision Contract

Runtime 永远只面对 `string === string`：

```js
runtime.revision = {
  serendipity: string | null,   // getDirectorContext().revision（本就是字符串，原样缓存）
  amor:        string | null,   // getStoryDirection().revision 对象 → canonical serialize → hash → string
  chat:        string | null,   // Runtime 自算：消息数 + 最后一条消息 hash
  runtime:     string | null,   // 上述三者 + Risveglio 自身状态 的 hash
}
```

Amor 规范化（伪代码）：

```
amorFingerprint = hash(JSON.stringify(revision, stableKeyOrder))
```

上游两个 `revision` 类型不同（Serendipity 字符串、Amor 对象），**必须在 Adapter 层统一成字符串指纹**后，Runtime 才能直接比较。

## 8. Capability Detection

两个插件都**不暴露运行时 version 全局**（`window.Serendipity` 上只有 2 个函数、`window.Amor` 上只有 1 个），所以：

- `available()`：`typeof window.X?.method === 'function'`。
- 「够不够新」：**能力探测**——调用后检查返回是否含期望字段（`schema` / `revision`）。探测不到 → 该能力视为不可用并降级（§11）。
- **禁止**：读 manifest version 字符串、读不存在的 `window.X.version`。
- Amor 依赖 Serendipity ≥ 2.3.6（伏笔导演需 2.3.7+），由 Amor 内部处理，Risveglio 不重复判断。

## 9. Cache Contract

**缓存是契约的一部分，不是事后优化。**

- `getContext()` 一次调用 → 同时缓存 `context` 与 `revision`。
- `getRevision()` 只读缓存，**绝不**为了「判断有没有变化」而额外调 `getDirectorContext()`（那会 build 8 个 section，违背门控思想）。
- 需要新 Fact Context 时重新调 `getContext()`，同时刷新 context + revision + cache。
- 缓存键 = 当前「角色 + 聊天」作用域（与上游隔离维度一致）。

## 10. Gate / NO CHANGE Rule

```
User Message
    ↓
Revision Compare（cached 指纹 vs 最新上游指纹 + chat 指纹）
    ↓
无实质变化？
  ├─ YES → STOP（0 AI，0 state write）
  └─ NO  → Build Context → World/Actor → Guard → 1 次 Core AI
```

- 「无变化」由 §7 四元指纹判定；任一关键指纹变化才触发对应模块。
- 门控只决定 Risveglio **自己的 Core AI** 是否调用；**不影响** Serendipity / Amor 各自的总结 / 规划 AI（那由它们各自的门控独立决定，Risveglio 不接管、不合并）。

## 11. Failure & Degradation

- 上游插件缺失 / 未加载 → `available() === false` → 相关字段置 `null`，Risveglio 仍可运行（仅本地 Simulation / Guard 规则）。
- 上游「插件 API」未配置 → 上游自身已静默跳过（不回退聊天 API）；Risveglio 从返回里拿到的可能是空 / 过期数据，同样不触发额外调用。
- Risveglio 自己的模型调用走**独立插件 API**，**绝不回退 ST 聊天 API**。
- Adapter 任何异常 → 捕获、返回 `null`、记录诊断，**不阻断生成**（上游失败不得阻塞剧情生成）。

## 12. Concurrency / Processing Lock

- `runtime.processing` 锁：Core AI 未返回前，不重复触发新一轮 Runtime 分析。
- 与 ST 的删除 / 重生成 / swipe 交互：chat 指纹变化即视为新状态，**重算**而非复用缓存。

## 13. No-Write Boundary

Risveglio **不写回** Serendipity 与 Amor：

- 不调用任何不存在的写接口（两个插件当前只有读接口）。
- 不把 Risveglio 的 Simulation 状态写入 Serendipity `worldState`。
- 不在 Risveglio 内重建第二套 Fact / Direction 数据。

（将来若要「推演 → 事实」沉淀，需先给上游定义写接口，届时另立 Contract 版本；本版明确不做。）

## 14. Upgrade Firewall

- 上游插件升级 → **优先改 Adapter，不动 Runtime**。
- 上游内部结构、存储键、字段名都是**实现细节**，Risveglio 一律不依赖。
- 依赖项只有：§4 的三个公开函数 + 它们的返回结构（经 Adapter 规范化后）。

## 15. Explicitly Out of Scope（非目标）

- 不创建 Serendipity 第二套 Fact 数据
- 不创建 Amor 第二套 Story Direction 数据
- 不写回两个插件
- 不调用不存在的 `getRevision()`
- 不读取不存在的全局 version
- 不尝试统一三个插件的 AI 调用
- 不把 Serendipity / Amor 内部实现当成 Risveglio API
- 不因上游不可用而回退 ST Chat API
- 不在本版定义 World / Actor / Guard 的内部结构

## 16. Reference Runtime Flow

**Normal round（有变化）：**

```
1 次 getDirectorContext() → 缓存 context + revision（string）
1 次 getStoryDirection()  → 规范化 + 缓存 direction + revision（object → string hash）
chat fingerprint（本地自算）
→ 指纹比对，有变化 → Build Context → World/Actor → Guard → 1 次 Core AI
```

**No change：**

```
指纹比对无变化 → STOP（0 AI，0 state write）
```
