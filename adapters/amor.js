/* ==========================================================================
   Risveglio · AmorAdapter（Interpretation Layer 防火墙）
   上游：window.Amor（Amor 1.15.1）
   唯一接触点：getStoryDirection({ include })
   本文件只「读」Amor 此刻已经存在的 Interpretation，绝不触发/请求 Amor 规划（Phase 1）。
   ========================================================================== */

import { makeEnvelope, probe, deepClone, fingerprint, callableResult, currentScopeKey } from './_shared.js';

const SOURCE = 'amor';

// §9 缓存：按「角色 + 聊天」作用域隔离。getDirection() 一次调用完成「读 → 规范化 → 缓存 → 返回」。
const _cache = new Map(); // scopeKey -> { revision, direction, at }

function _ns() {
    return (typeof window !== 'undefined') ? window.Amor : null;
}

function available() {
    return probe(_ns(), 'getStoryDirection');
}

function _degraded(error) {
    return makeEnvelope(SOURCE, {
        available: false,
        compatible: false,
        revision: null,
        data: null,
        meta: { source: SOURCE, degraded: true, error },
    });
}

function getDirection(opts = {}) {
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return _degraded('no scope（无当前聊天）');
    if (!available()) return _degraded('unavailable');

    let raw = null;
    try {
        raw = window.Amor.getStoryDirection({ include: opts.include });
    } catch (err) {
        return _degraded(err?.message || 'getStoryDirection threw');
    }

    if (raw == null) return _degraded('null result（无当前聊天）');

    const compatible = raw.revision != null;
    if (!compatible) {
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: false,
            revision: null,
            data: null,
            meta: { source: SOURCE, degraded: true, error: 'unexpected shape（无 revision）' },
        });
    }

    // object revision → 稳定字符串化 → 指纹 → string（Contract §7）。Runtime 只看到 string。
    const revision = fingerprint(raw.revision);

    // 深拷贝快照；inspection/storyHealth 是函数，用 callableResult 包成三态结构。
    const data = {
        currentScene: deepClone(raw.currentScene),
        currentBeat: deepClone(raw.currentBeat),
        directorState: deepClone(raw.directorState),
        activeGoals: deepClone(raw.activeGoals),
        plotThreads: deepClone(raw.plotThreads),
        emotionalArcs: deepClone(raw.emotionalArcs),
        knowledgeState: deepClone(raw.knowledgeState),
        foreshadowPlan: deepClone(raw.foreshadowPlan),
        choices: deepClone(raw.choices),
        doctorOrders: deepClone(raw.doctorOrders),
        doctorReport: deepClone(raw.doctorReport),
        storyArc: deepClone(raw.storyArc),
        causalChains: deepClone(raw.causalChains),
        inspection: callableResult(raw.inspection),
        storyHealth: callableResult(raw.storyHealth),
    };

    _cache.set(scopeKey, { revision, direction: data, at: Date.now() });

    return makeEnvelope(SOURCE, {
        available: true,
        compatible: true,
        revision,
        data,
        meta: { source: SOURCE, degraded: false, error: null },
    });
}

/** §9：只读当前 scope 已缓存的 revision。 */
function getRevision() {
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return null;
    return _cache.get(scopeKey)?.revision ?? null;
}

export const AmorAdapter = {
    source: SOURCE,
    available,
    getDirection,
    getRevision,
};
