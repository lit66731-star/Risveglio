/* ==========================================================================
   Risveglio · Guard（Phase 5-C）
   定位：Runtime Pipeline 的「收口检查点」——装配完成后做最终一致性检查。
   跨层例外（Contract 明确授权）：Guard 不属于普通数据变换层，而是检查点，
   可同时消费已装配完成的 world 与 actor 两个 Runtime Context，但只读它们，
   绝不回头访问 Adapter / Serendipity / Amor / ST 内部。
   职责边界（本阶段严格只做这一件事）：
   - 只发现「明确、可机械判断」的结构性矛盾；不解析自然语言事实、不推理、不修复、不写回。
   - 纯函数：只读、确定性、无副作用、无网络、无 AI、无缓存依赖、无时间/随机。
   v1 检查：
   - scope_mismatch：防御性不变量（当前 live 链 world.scope 与 actor.scope 恒等，仅单测注入可达）。
   - duplicate_actor_id：live 可达；同一 id 在 Actor collection 出现 ≥2 次。
   null 语义（严格区分）：
   - actor.actors === null → 结构化实体来源不可用 → duplicate-id 无法执行 → degraded。
   - actor.actors === []   → 来源正常、0 实体 → duplicate-id 完整执行（无重复）→ ok。
   - world.storyTime/worldState/timeline === null → v1 无任何检查依赖它们 → 不制造 conflict。
   status 聚合：conflict（有冲突）> degraded（某项检查因数据缺失未能执行）> ok。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';

function _sameScope(a, b) {
    return (a?.characterId ?? null) === (b?.characterId ?? null)
        && (a?.chatId ?? null) === (b?.chatId ?? null);
}

/**
 * 从 World + Actor 组装 Guard 结果（Phase 5-C 唯一产出）。
 * @param {object} worldContext  assembleWorld() 的产出
 * @param {object} actorContext  assembleActor() 的产出
 * @returns {{scope: (object|null), status: ('ok'|'conflict'|'degraded'), conflicts: Array}}
 */
export function assembleGuard(worldContext = null, actorContext = null) {
    // scope 透传：live 时 world.scope === actor.scope；world 优先，缺省回退 actor。
    const scope = deepClone(worldContext?.scope ?? actorContext?.scope ?? null);

    // 防御性兜底（单测注入）：前层 Contract 保证 live 传入非 null 对象，这里不抛错、不伪造 conflict，直接降级。
    if (worldContext == null || actorContext == null) {
        return { scope, status: 'degraded', conflicts: [] };
    }

    const conflicts = [];

    // A. scope_mismatch（防御性不变量，live 恒等）
    if (!_sameScope(worldContext.scope, actorContext.scope)) {
        conflicts.push({
            type: 'scope_mismatch',
            severity: 'error',
            message: 'World 与 Actor 不属于同一 scope（character/chat 不一致）',
        });
    }

    // B. duplicate_actor_id（依赖 actor.actors，live 唯一可 degrade 的检查）
    if (actorContext.actors == null) {
        // 结构化实体来源不可用 → duplicate-id 无法执行 → degraded（除非 A 已发现冲突）。
        return { scope, status: conflicts.length > 0 ? 'conflict' : 'degraded', conflicts };
    }

    const seen = new Set();
    const dups = new Set();
    for (const a of actorContext.actors) {
        const id = a?.id;
        if (id == null) continue; // 缺 id 不参与重复判定（Actor 层已保证有 id，此处纯防御）
        if (seen.has(id)) dups.add(id);
        else seen.add(id);
    }
    for (const id of dups) {
        conflicts.push({
            type: 'duplicate_actor_id',
            severity: 'error',
            message: `重复的 actor id：${id}`,
        });
    }

    return {
        scope,
        status: conflicts.length > 0 ? 'conflict' : 'ok',
        conflicts,
    };
}
