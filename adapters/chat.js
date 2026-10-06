/* ==========================================================================
   Risveglio · ChatAdapter（聊天作用域 / chat 指纹）
   上游：SillyTavern 当前聊天数据（window.getContext）
   只读聊天「元数据」算 chat 指纹（作用域 + 消息数 + 末条消息），绝不碰聊天 AI 接口（Contract §11）。
   ========================================================================== */

import { makeEnvelope, probe, deepClone, fingerprint } from './_shared.js';

const SOURCE = 'chat';

let _cache = null;

function _ctx() {
    if (typeof window === 'undefined') return null;
    try {
        return typeof window.getContext === 'function' ? window.getContext() : null;
    } catch {
        return null;
    }
}

function available() {
    const c = _ctx();
    return c != null && Array.isArray(c.chat);
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

function getSnapshot() {
    if (!available()) return _degraded('unavailable（无当前聊天）');
    const c = _ctx();
    const chat = c.chat;
    const last = chat.length ? chat[chat.length - 1] : null;

    // chat 指纹 = 作用域 + 消息数 + 末条消息 hash（Contract §7）。
    const scope = {
        chatId: c.chatId ?? c.chatMetadata?.chat_id ?? null,
        messageCount: chat.length,
        lastRole: last ? (last.is_user ? 'user' : (last.is_system ? 'system' : 'char')) : null,
        lastMes: last ? String(last.mes ?? '') : null,
    };

    const revision = fingerprint(scope);
    const data = deepClone(scope);

    _cache = { revision, data, at: Date.now() };

    return makeEnvelope(SOURCE, {
        available: true,
        compatible: true,
        revision,
        data,
        meta: { source: SOURCE, degraded: false, error: null },
    });
}

/** chat 指纹（只读缓存）。 */
function getRevision() {
    return _cache ? _cache.revision : null;
}

export const ChatAdapter = {
    source: SOURCE,
    available,
    getSnapshot,
    getRevision,
};
