/* ==========================================================================
   Risveglio · SerendipityAdapter（Fact Layer 防火墙）
   上游：window.Serendipity（Serendipity 2.3.14）
   唯一接触点：getDirectorContext(opts)、getForeshadows()
   本文件是 Runtime 读 Serendipity 的唯一通道；Runtime 不得直接碰 window.Serendipity。
   错误码：unavailable / no_scope / null_result / unexpected_shape / threw
   ========================================================================== */

import { makeEnvelope, probe, deepClone, currentScopeKey, fingerprint } from './_shared.js';

const SOURCE = 'serendipity';

// §9 缓存：按「角色 + 聊天」作用域隔离。getContext() 缓存 director context + directorRevision；
// getEntities() 缓存 entitiesRevision（含 degraded 状态）；getRevision() 只读缓存里的两个 revision
// 并稳定合成 Adapter-level revision，绝不为了补缓存再次调上游（getDirectorContext / getEntities）。
const _cache = new Map(); // scopeKey -> { directorRevision, entitiesRevision, context, foreshadows, at }

function _ns() {
    return (typeof window !== 'undefined') ? window.Serendipity : null;
}

function available() {
    return probe(_ns(), 'getDirectorContext');
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

function getContext(opts = {}) {
    if (!available()) return _degraded('unavailable');
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return _degraded('no_scope');

    let raw = null;
    try {
        raw = window.Serendipity.getDirectorContext({ ...opts });
    } catch (err) {
        console.warn('[Risveglio][serendipity] getDirectorContext threw:', err);
        return _degraded('threw');
    }

    if (raw == null) return _degraded('null_result');

    const compatible = raw.schema === 1 && typeof raw.revision === 'string';
    if (!compatible) {
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: false,
            revision: null,
            data: null,
            meta: { source: SOURCE, degraded: true, error: 'unexpected_shape' },
        });
    }

    const revision = raw.revision;
    // 深拷贝快照；revision 提升到信封顶层，data 里不含 revision（避免双份）。
    const data = deepClone({
        purpose: raw.purpose,
        tokenBudget: raw.tokenBudget,
        estimatedTokens: raw.estimatedTokens,
        truncated: raw.truncated,
        sections: raw.sections,
        text: raw.text,
    });

    const entry = _cache.get(scopeKey) || {};
    entry.directorRevision = revision;
    entry.context = data;
    entry.at = Date.now();
    _cache.set(scopeKey, entry);

    return makeEnvelope(SOURCE, {
        available: true,
        compatible: true,
        revision,
        data,
        meta: { source: SOURCE, degraded: false, error: null },
    });
}

/** getForeshadows()：无独立 revision（Contract §7），信封 revision = null。 */
function getForeshadows() {
    if (!available()) return _degraded('unavailable');
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return _degraded('no_scope');
    try {
        const raw = window.Serendipity.getForeshadows();
        if (raw == null) return _degraded('null_result');
        const data = deepClone(raw);
        const entry = _cache.get(scopeKey) || {};
        entry.foreshadows = data;
        entry.at = Date.now();
        _cache.set(scopeKey, entry);
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: true,
            revision: null,
            data,
            meta: { source: SOURCE, degraded: false, error: null },
        });
    } catch (err) {
        console.warn('[Risveglio][serendipity] getForeshadows threw:', err);
        return _degraded('threw');
    }
}

/** 把信封的 revision 相关元数据抽成稳定状态（不含 data），供 getRevision() 合成指纹。 */
function _revisionState(env) {
    return {
        available: env.available,
        compatible: env.compatible,
        revision: env.revision ?? null,
        error: env.meta?.error ?? null,
    };
}

/** getEntities()：结构化角色实体（唯一 id + 身份域 world·timeline·identity + 状态），供 Actor 做身份解析。纯读，不触发 AI。 */
function getEntities() {
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return _degraded('no_scope');
    const env = _readEntities();
    // 缓存 entities revision 状态（含 degraded：unavailable/null_result/threw/unexpected_shape），
    // 供 getRevision() 与 directorRevision 合成；只存 revision 元数据，绝不缓存完整 entities 数据。
    const entry = _cache.get(scopeKey) || {};
    entry.entitiesRevision = _revisionState(env);
    entry.at = Date.now();
    _cache.set(scopeKey, entry);
    return env;
}

function _readEntities() {
    if (!probe(_ns(), 'getEntities')) return _degraded('unavailable');
    let raw = null;
    try {
        raw = window.Serendipity.getEntities();
    } catch (err) {
        console.warn('[Risveglio][serendipity] getEntities threw:', err);
        return _degraded('threw');
    }
    if (raw == null) return _degraded('null_result');
    const compatible = raw.schema === 1 && Array.isArray(raw.items) && typeof raw.revision === 'string';
    if (!compatible) {
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: false,
            revision: null,
            data: null,
            meta: { source: SOURCE, degraded: true, error: 'unexpected_shape' },
        });
    }
    return makeEnvelope(SOURCE, {
        available: true,
        compatible: true,
        revision: raw.revision,
        data: deepClone(raw.items), // 结构化实体数组；name 只是显示属性，身份靠 id + world/timeline/identity
        meta: { source: SOURCE, degraded: false, error: null },
    });
}

/** §9：只读缓存里的 directorRevision + entitiesRevision，稳定合成 Adapter-level revision；绝不重新调上游。 */
function getRevision() {
    const scopeKey = currentScopeKey();
    if (scopeKey == null) return null;
    const entry = _cache.get(scopeKey);
    if (!entry) return null;
    return fingerprint([entry.directorRevision ?? null, entry.entitiesRevision ?? null]);
}

export const SerendipityAdapter = {
    source: SOURCE,
    available,
    getContext,
    getForeshadows,
    getEntities,
    getRevision,
};
