/* ==========================================================================
   Risveglio · SerendipityAdapter（Fact Layer 防火墙）
   上游：window.Serendipity（Serendipity 2.3.14）
   唯一接触点：getDirectorContext(opts)、getForeshadows()
   本文件是 Runtime 读 Serendipity 的唯一通道；Runtime 不得直接碰 window.Serendipity。
   ========================================================================== */

import { makeEnvelope, probe, deepClone } from './_shared.js';

const SOURCE = 'serendipity';

// §9 缓存：getContext() 一次调用同时缓存 context + revision；getRevision() 只读缓存，绝不额外调用。
// TODO: 缓存键改为「角色 + 聊天」作用域（ChatAdapter 落地后接入）。
let _cache = null;

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

/**
 * 规范化 getDirectorContext(opts)。
 * 注意：不带 opts 的旧用法返回拼接字符串（无 revision）——本 adapter 只用新用法（Contract §4.1）。
 */
function getContext(opts = {}) {
    if (!available()) return _degraded('unavailable');

    let raw = null;
    try {
        raw = window.Serendipity.getDirectorContext({ ...opts });
    } catch (err) {
        return _degraded(err?.message || 'getDirectorContext threw');
    }

    if (raw == null) return _degraded('null result（settings 未加载）');

    const compatible = raw.schema === 1 && typeof raw.revision === 'string';
    if (!compatible) {
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: false,
            revision: null,
            data: null,
            meta: { source: SOURCE, degraded: true, error: 'unexpected shape（可能是旧用法）' },
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

    _cache = { revision, data, at: Date.now() };

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
    try {
        const raw = window.Serendipity.getForeshadows();
        if (raw == null) return _degraded('null result');
        return makeEnvelope(SOURCE, {
            available: true,
            compatible: true,
            revision: null,
            data: deepClone(raw),
            meta: { source: SOURCE, degraded: false, error: null },
        });
    } catch (err) {
        return _degraded(err?.message || 'getForeshadows threw');
    }
}

/** §9：只读缓存，绝不为了「判断有没有变化」而额外调 getDirectorContext()。 */
function getRevision() {
    return _cache ? _cache.revision : null;
}

export const SerendipityAdapter = {
    source: SOURCE,
    available,
    getContext,
    getForeshadows,
    getRevision,
};
