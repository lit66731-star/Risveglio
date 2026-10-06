/* ==========================================================================
   Risveglio · Runtime Revision v1（Phase 2）
   只回答一个问题：Runtime 当前状态和上一次相比，有没有变化？
   职责：Adapter 状态 → 稳定指纹 → 比较。只比较、不解释；只发现变化、不决定变化之后做什么。
   明确不做：changedParts / whyChanged / shouldReassemble / shouldRecall ...（都是后面的 orchestration）。
   ========================================================================== */

import { fingerprint } from '../adapters/_shared.js';

let _last = null; // { fingerprint, at }

// 单个 adapter 的可比较三元组：存在性 + 兼容性（会话级，来自 Capability Matrix）+ 状态指纹。
function _triple(adapter, matrixEntry) {
    if (!adapter) return { available: false, compatible: null, fingerprint: null };
    let available = false;
    try { available = adapter.available(); } catch { available = false; }
    let fp = null;
    try { fp = adapter.getRevision(); } catch { fp = null; }
    return {
        available,
        compatible: matrixEntry?.compatible ?? null,
        fingerprint: fp,
    };
}

/**
 * 计算当前 Runtime 指纹并与上一次比较。
 * @returns {{changed: boolean, fingerprint: string, previousFingerprint: string|null, adapters: object}}
 */
export function computeRevision(adapters = {}, matrix = {}) {
    const parts = {
        serendipity: _triple(adapters.serendipity, matrix.serendipity),
        amor: _triple(adapters.amor, matrix.amor),
        chat: _triple(adapters.chat, matrix.chat),
    };
    const fp = fingerprint(parts);
    const previousFingerprint = _last ? _last.fingerprint : null;
    // 首次运行没有「上一次」，视为基线（不是变化）。
    const changed = previousFingerprint != null && fp !== previousFingerprint;
    _last = { fingerprint: fp, at: Date.now() };
    return {
        changed,
        fingerprint: fp,
        previousFingerprint,
        adapters: parts,
    };
}

/** 取上一次指纹（供诊断用）。 */
export function lastRevision() {
    return _last;
}
