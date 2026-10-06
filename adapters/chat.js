/* ==========================================================================
   Risveglio · ChatAdapter（聊天作用域 / chat 指纹）
   上游：SillyTavern 当前聊天数据（window.getContext）
   只读聊天「元数据」算 chat 指纹（作用域 + 消息数 + 末条消息），绝不碰聊天 AI 接口（Contract §11）。
   ========================================================================== */

import { makeEnvelope, deepClone, fingerprint, hashString, currentScopeKey } from './_shared.js';

const SOURCE = 'chat';

// Chat 指纹必须新鲜：每次询问都重新计算当前聊天状态，缓存只保存「上一次」的值供比较，
// 不能把 chat 指纹当成永久只读缓存（否则新消息进来永远不知道变了）。
const _cache = new Map(); // scopeKey -> { revision, messageCount, lastMessageHash, at }

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

// 重新计算当前 chat 快照 + 指纹（不读缓存）。
function _snapshot() {
    const c = _ctx();
    if (c == null || !Array.isArray(c.chat)) return null;
    const scopeKey = currentScopeKey(c);
    if (scopeKey == null) return null;
    const chat = c.chat;
    const last = chat.length ? chat[chat.length - 1] : null;
    const lastMes = last ? String(last.mes ?? '') : '';

    // chat 指纹 = 作用域 + 消息数 + 末条消息 hash（Contract §7）。
    const scope = {
        chatId: c.chatId ?? c.chatMetadata?.chat_id ?? null,
        messageCount: chat.length,
        lastRole: last ? (last.is_user ? 'user' : (last.is_system ? 'system' : 'char')) : null,
        lastMes,
    };

    return {
        scopeKey,
        revision: fingerprint(scope),
        data: deepClone(scope),
        messageCount: chat.length,
        lastMessageHash: hashString(lastMes),
    };
}

function getSnapshot() {
    const s = _snapshot();
    if (s == null) return _degraded('unavailable（无当前聊天）');
    _cache.set(s.scopeKey, {
        revision: s.revision,
        messageCount: s.messageCount,
        lastMessageHash: s.lastMessageHash,
        at: Date.now(),
    });
    return makeEnvelope(SOURCE, {
        available: true,
        compatible: true,
        revision: s.revision,
        data: s.data,
        meta: { source: SOURCE, degraded: false, error: null },
    });
}

// 每次询问都重新计算当前状态（chat 指纹必须新鲜），并刷新缓存供下次比较。
function getRevision() {
    const s = _snapshot();
    if (s == null) return null;
    _cache.set(s.scopeKey, {
        revision: s.revision,
        messageCount: s.messageCount,
        lastMessageHash: s.lastMessageHash,
        at: Date.now(),
    });
    return s.revision;
}

export const ChatAdapter = {
    source: SOURCE,
    available,
    getSnapshot,
    getRevision,
};
