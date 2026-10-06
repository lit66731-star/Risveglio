/* ==========================================================================
   Risveglio · Core AI（Phase 6）
   定位：Runtime 的「最终消费者」+「非确定性计算边界」。
   跨层例外（Contract 明确授权，性质=最终消费者，区别于 Guard=检查点）：
   允许消费当前 Runtime Pipeline 已完成的全部公开结果 —— context + world + actor + guard。
   输出：Runtime Result / Proposal，v1 绝不写回任何事实源（Serendipity/Amor/ST）。
   边界：
   - 确定性部分 assembleCore：构造 Core 专用 prompt/messages，纯函数、可 node 测。
   - 非确定性部分 generateCore：经 Generation Adapter 调独立 Core API（唯一允许非确定的位置）。
   - 不读 adapter / ST 内部 / 聊天隐藏上下文；不复用 summary/planner/聊天 model；
     不写回；不自动再 run；不自调第二次 AI。
   - 一次 run 最多一次生成：generateCore 是独立显式步骤，run() 本身不发请求、不循环。
   coreConfig：第三套独立配置 {enabled, api:{url,key,model}, tokenBudget}，默认禁用。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';
import { generate } from '../adapters/generation.js';

const SYSTEM_PROMPT =
    '你是 Risveglio 的运行时核心。下面是当前 Runtime 装配出的世界/人物/一致性状态。' +
    '只做忠实、简洁的运行时观察与结果陈述，不要臆测、不要补写、不要修改任何事实。';

function _v(x, empty = '（无）') {
    return (x == null || x === '') ? empty : String(x);
}

// 忠实序列化单个 actor（13 字段 source-faithful，不新增/不合并）
function _actorText(a) {
    const domain = [a.world, a.timeline, a.identity].filter(v => v).join('·');
    const parts = [`id=${_v(a.id, '（缺）')}`, `名=${_v(a.name)}`];
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

// v1 最小忠实 prompt：只序列化已装配的 Runtime 全景（scope+world+actor+guard）。
// 原始 context 文本 / amor 方向 / chat 快照暂不并入 —— 后续 refine 时在此扩展。
function _buildPrompt(context, world, actor, guard) {
    const sc = context?.scope ?? null;
    const L = [];

    L.push('【剧情范围】');
    L.push(`角色=${_v(sc?.characterId)}  聊天=${_v(sc?.chatId)}`);

    L.push('');
    L.push('【世界状态】');
    L.push(`剧情时间=${_v(world?.storyTime)}`);
    L.push(`世界状态=${_v(world?.worldState)}`);
    L.push(`时间线=${_v(world?.timeline)}`);

    L.push('');
    L.push('【人物】');
    const actors = actor?.actors;
    if (actors == null) {
        L.push('（无结构化人物来源）');
    } else if (actors.length === 0) {
        L.push('（无人物）');
    } else {
        for (const a of actors) L.push(_actorText(a));
    }

    L.push('');
    L.push('【一致性检查】');
    L.push(`status=${_v(guard?.status, 'degraded')}`);
    const conflicts = guard?.conflicts || [];
    if (conflicts.length === 0) {
        L.push('conflicts=（无）');
    } else {
        for (const c of conflicts) L.push(`- [${c.type}] ${c.message}`);
    }

    return L.join('\n');
}

/**
 * Core Input Assembly（确定性）：Runtime 全景 → prompt/messages + GenerationRequest。
 * @param {object} context  assembleContext() 产出
 * @param {object} world    assembleWorld() 产出
 * @param {object} actor    assembleActor() 产出
 * @param {object} guard    assembleGuard() 产出
 * @param {object} coreConfig  {enabled, api:{url,key,model}, tokenBudget}
 * @returns {object} coreInput
 */
export function assembleCore(context = {}, world = {}, actor = {}, guard = {}, coreConfig = {}) {
    const enabled = !!coreConfig.enabled;
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: _buildPrompt(context, world, actor, guard) },
    ];
    return {
        scope: deepClone(context?.scope ?? null),
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
 * 结果状态：generated / skipped / failed。错误信息用 Core 自己的字符串，不复用 Adapter 错误码。
 * @param {object} coreInput   assembleCore() 产出
 * @param {object} coreConfig  {enabled, api:{url,key,model}, tokenBudget}
 * @returns {Promise<{status: string, scope: object|null, generation: object|null, reason?: string, error?: string}>}
 */
export async function generateCore(coreInput = null, coreConfig = {}) {
    const scope = deepClone(coreInput?.scope ?? null);
    if (!coreInput || !coreInput.enabled) {
        return {
            status: 'skipped',
            reason: (coreInput && coreInput.skippedReason) || 'disabled',
            scope,
            generation: null,
        };
    }
    try {
        const out = await generate(coreConfig.api, coreInput.request.messages, coreInput.request.maxTokens);
        return { status: 'generated', scope, generation: out };
    } catch (err) {
        return {
            status: 'failed',
            scope,
            generation: null,
            error: String((err && err.message) || err),
        };
    }
}
