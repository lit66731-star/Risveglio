/* ==========================================================================
   Risveglio · Core AI（Phase 6）
   定位：Runtime 的「最终消费者」+「非确定性计算边界」。

   Core Input Contract（三条硬规则，立住后架构不散）：
   1. Core 只能读 Core Input（input），不得读 Runtime Context / adapter / ST 内部。
   2. Core Input 字段必须来自已完成的 Runtime 层，不允许 Core 自己推断/检索/重捞。
   3. 新增 Core 可见信息必须改本 Contract（_assembleInput），而不是直接扩 prompt。

   Core Input Schema（Runtime → Core 的唯一可见面，按权威等级分层，不是全量序列化）：
   {
     scope:          { characterId, chatId },
     facts:          { storyTime, worldState, timeline, actors[13 字段] },   // Serendipity 事实层
     interpretation: { currentScene, currentBeat, directorState, activeGoals,
                       plotThreads, emotionalArcs, knowledgeState, storyArc,
                       causalChains, storyHealth },                            // Amor 解释层（不是事实）
     conversation:   { characterId, chatId, messageCount, lastRole, lastMes },// Chat 当前输入快照
     guard:          { status, conflicts },                                    // Runtime 一致性报告（不是剧情事实）
   }

   字段来源映射（source-faithful，已按真码核对）：
     facts.storyTime/worldState/timeline ← world（Serendipity sections 子集）
     facts.actors                          ← actor（serendipity.data.entities 结构化实体；id 主键）
     interpretation.*                      ← context.amor.data（Amor 15 字段里取 10）
     conversation.*                        ← context.chat.data（ChatAdapter 快照）
     guard.*                               ← guard（assembleGuard 产出）
     明确排除：sections.characters/recentMemory/relationships/foreshadows/consistency（损失文本/未立 Contract），
             Amor 的 foreshadowPlan/choices/doctorOrders/doctorReport/inspection（内部导演工具，语义特殊），
             整个 chat history，Serendipity 的 purpose/tokenBudget/estimatedTokens/truncated/text 原文。

   Result Contract（generateCore 产出，冻结；详见函数 JSDoc）：
     generated → { status, scope, proposal:{type:'response', text}, generation:{model, tokenUsage} }
     skipped   → { status, reason:'disabled', scope }            // 无 proposal / 无 generation
     failed    → { status, scope, error:{code, message} }        // code 由 Generation Adapter 提供、Core 透传
   proposal = Core 的提案（不是事实、不是最终消息）；generation = 执行元数据（text 已上移到 proposal.text）。

   边界：
   - 确定性 assembleCore：构造 Core Input + prompt，纯函数、可 node 测。
   - 非确定性 generateCore：经 Generation Adapter 调独立 Core API（唯一允许非确定的位置）。
   - 不写回；不自动再 run；不自调第二次 AI。一次 run 最多一次生成（generateCore 是独立显式步骤）。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';
import { generate } from '../adapters/generation.js';

const SYSTEM_PROMPT =
    '你是 Risveglio 的运行时核心。下面按权威等级分区给出当前剧情状态：' +
    '[Story Facts] 是事实层（发生了什么，可采信）；[Actors] 是结构化人物（id 是唯一身份，name 仅显示）；' +
    '[Amor Interpretation] 是导演解释层（不是事实，勿当成已发生）；[Current Conversation] 是当前输入；' +
    '[Runtime Guard] 是 Runtime 检测到的一致性报告（不是剧情事实，不要把它当剧情内容）。' +
    '只做忠实、简洁的运行时观察与结果陈述，不要臆测、不要补写、不要修改任何事实。';

function _fmt(v, empty = '（无）') {
    if (v == null || v === '') return empty;
    if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
}

// callableResult 三态：available=false（未提供）/ ok=false（调用抛错）/ ok=true（值）
function _fmtCallable(cr, empty = '（无）') {
    if (!cr || cr.available === false) return empty;
    if (cr.ok === false) return '（调用失败：' + (cr.error || 'threw') + '）';
    return _fmt(cr.value);
}

// 忠实序列化单个 actor（13 字段 source-faithful，不新增/不合并）
function _actorText(a) {
    const domain = [a.world, a.timeline, a.identity].filter(v => v).join('·');
    const parts = [`id=${_fmt(a.id, '（缺）')}`, `名=${_fmt(a.name)}`];
    if (domain) parts.push(`身份域=${domain}`);
    if (a.age != null && a.age !== '') parts.push(`年龄=${a.age}`);
    if (a.body != null && a.body !== '') parts.push(`身体=${a.body}`);
    if (a.mind != null && a.mind !== '') parts.push(`心智=${a.mind}`);
    if (a.goal != null && a.goal !== '') parts.push(`目标=${a.goal}`);
    if (a.secret != null && a.secret !== '') parts.push(`秘密=${a.secret}`);
    if (a.promise != null && a.promise !== '') parts.push(`承诺=${a.promise}`);
    if (a.note != null && a.note !== '') parts.push(`备注=${a.note}`);
    return '- ' + parts.join(' · ');
}

// 从已完成 Runtime 层组装 Core Input Schema（只读，不推断/检索/重捞）。
function _assembleInput(context, world, actor, guard) {
    const chat = context?.chat?.data ?? null;   // conversation 来源
    const amor = context?.amor?.data ?? null;   // interpretation 来源

    return {
        scope: deepClone(context?.scope ?? null),
        facts: {
            storyTime: world?.storyTime ?? null,
            worldState: world?.worldState ?? null,
            timeline: world?.timeline ?? null,
            actors: deepClone(actor?.actors ?? null),
        },
        interpretation: {
            currentScene: amor?.currentScene ?? null,
            currentBeat: amor?.currentBeat ?? null,
            directorState: amor?.directorState ?? null,
            activeGoals: amor?.activeGoals ?? null,
            plotThreads: amor?.plotThreads ?? null,
            emotionalArcs: amor?.emotionalArcs ?? null,
            knowledgeState: amor?.knowledgeState ?? null,
            storyArc: amor?.storyArc ?? null,
            causalChains: amor?.causalChains ?? null,
            storyHealth: amor?.storyHealth ?? null, // callableResult 三态
        },
        conversation: {
            characterId: chat?.characterId ?? null,
            chatId: chat?.chatId ?? null,
            messageCount: chat?.messageCount ?? null,
            lastRole: chat?.lastRole ?? null,
            lastMes: chat?.lastMes ?? null,
        },
        guard: {
            status: guard?.status ?? 'degraded',
            conflicts: deepClone(guard?.conflicts ?? null),
        },
    };
}

// 只从 Core Input（input）构造 prompt，绝不回读 context/world/actor/guard（硬规则 1）。
function _buildPrompt(input) {
    const L = [];
    const sc = input?.scope ?? null;
    const f = input?.facts ?? {};
    const it = input?.interpretation ?? {};
    const cv = input?.conversation ?? {};
    const g = input?.guard ?? {};

    L.push('[Scope]');
    L.push(`characterId=${_fmt(sc?.characterId)}`);
    L.push(`chatId=${_fmt(sc?.chatId)}`);

    L.push('');
    L.push('[Story Facts]');
    L.push(`storyTime=${_fmt(f.storyTime)}`);
    L.push(`worldState=${_fmt(f.worldState)}`);
    L.push(`timeline=${_fmt(f.timeline)}`);

    L.push('');
    L.push('[Actors]');
    const actors = f.actors;
    if (actors == null) L.push('（无结构化人物来源）');
    else if (actors.length === 0) L.push('（无人物）');
    else for (const a of actors) L.push(_actorText(a));

    L.push('');
    L.push('[Amor Interpretation]');
    L.push(`currentScene=${_fmt(it.currentScene)}`);
    L.push(`currentBeat=${_fmt(it.currentBeat)}`);
    L.push(`directorState=${_fmt(it.directorState)}`);
    L.push(`activeGoals=${_fmt(it.activeGoals)}`);
    L.push(`plotThreads=${_fmt(it.plotThreads)}`);
    L.push(`emotionalArcs=${_fmt(it.emotionalArcs)}`);
    L.push(`knowledgeState=${_fmt(it.knowledgeState)}`);
    L.push(`storyArc=${_fmt(it.storyArc)}`);
    L.push(`causalChains=${_fmt(it.causalChains)}`);
    L.push(`storyHealth=${_fmtCallable(it.storyHealth)}`);

    L.push('');
    L.push('[Current Conversation]');
    L.push(`messageCount=${_fmt(cv.messageCount)}`);
    L.push(`lastRole=${_fmt(cv.lastRole)}`);
    L.push(`lastMes=${_fmt(cv.lastMes)}`);

    L.push('');
    L.push('[Runtime Guard]');
    L.push(`status=${_fmt(g.status, 'degraded')}`);
    const conflicts = g.conflicts;
    if (conflicts == null || conflicts.length === 0) L.push('conflicts=（无）');
    else for (const c of conflicts) L.push(`- [${c.type}] ${c.message}`);

    return L.join('\n');
}

/**
 * Core Input Assembly（确定性）：Runtime 全景 → Core Input Schema + prompt/messages + request。
 * @param {object} context  assembleContext() 产出
 * @param {object} world    assembleWorld() 产出
 * @param {object} actor    assembleActor() 产出
 * @param {object} guard    assembleGuard() 产出
 * @param {object} coreConfig  {enabled, api:{url,key,model}, tokenBudget}
 * @returns {{input: object, enabled: boolean, skippedReason: (string|null), request: object}}
 */
export function assembleCore(context = {}, world = {}, actor = {}, guard = {}, coreConfig = {}) {
    const input = _assembleInput(context, world, actor, guard);
    const enabled = !!coreConfig.enabled;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: _buildPrompt(input) },
    ];
    return {
        input,
        enabled,
        skippedReason: enabled ? null : 'disabled',
        request: {
            model: String(coreConfig?.api?.model || ''),
            messages,
            maxTokens: Number(coreConfig.tokenBudget) || 0,
            stream: false,
        },
    };
}

/**
 * Core AI Generation（非确定性）：经 Generation Adapter 调独立 Core API。
 * Result Contract（冻结）：
 *   generated → { status, scope, proposal:{type:'response', text}, generation:{model, tokenUsage} }
 *   skipped   → { status, reason:'disabled', scope }             // 无 proposal / 无 generation
 *   failed    → { status, scope, error:{code, message} }         // code 由 Adapter 提供、Core 透传不猜文案
 * proposal 是 Core 的提案（不是事实、不是最终消息）；generation 是执行元数据（text 已上移到 proposal.text）。
 * @param {object} corePackage  assembleCore() 产出
 * @param {object} coreConfig   {enabled, api:{url,key,model}, tokenBudget}
 * @returns {Promise<object>}
 */
export async function generateCore(corePackage = null, coreConfig = {}) {
    const scope = deepClone(corePackage?.input?.scope ?? null);
    if (!corePackage || !corePackage.enabled) {
        return {
            status: 'skipped',
            reason: (corePackage && corePackage.skippedReason) || 'disabled',
            scope,
        };
    }
    try {
        const out = await generate(coreConfig.api, corePackage.request.messages, corePackage.request.maxTokens);
        // 语义提升：Adapter 的 {text, model, tokenUsage} → Core Result。
        // text 提升成 proposal.text（提案，不是事实也不是最终消息）；model/tokenUsage 留在 generation（执行元数据）。
        return {
            status: 'generated',
            scope,
            proposal: { type: 'response', text: out.text },
            generation: { model: out.model, tokenUsage: out.tokenUsage },
        };
    } catch (err) {
        // error.code 由 Generation Adapter 提供，Core 只透传不猜文案；'unknown' 仅防御（正常流不触发）。
        return {
            status: 'failed',
            scope,
            error: {
                code: (err && err.code) || 'unknown',
                message: (err && err.message) ? String(err.message) : String(err),
            },
        };
    }
}
