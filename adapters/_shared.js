/* ==========================================================================
   Risveglio · Adapter 共享工具（防火墙底层）
   —— 所有 adapter 共用的规范化 / 能力探测 / 安全调用 / 指纹工具。
   本文件不接触任何上游插件的具体 API，只提供稳定契约的基础件。
   ========================================================================== */

/**
 * 统一返回信封：Runtime 只消费这个形状，永远不直接接触上游原始返回（Contract §5 / §6）。
 * @param {string} source 'serendipity' | 'amor' | 'chat'
 * @param {object} [patch] 覆盖字段
 */
export function makeEnvelope(source, patch = {}) {
    return {
        available: false,      // 上游存在且方法存在
        compatible: false,     // 能力探测通过（返回含期望字段）
        revision: null,        // 该来源的指纹（string | null）；见 Contract §7
        data: null,            // 规范化后的快照（深拷贝；函数已替换为 safeCall 结果）
        meta: { source, degraded: true, error: null },
        ...patch,
    };
}

/** 能力探测：上游命名空间下某方法是否存在（Contract §8）。 */
export function probe(ns, method) {
    try {
        return ns != null && typeof ns[method] === 'function';
    } catch {
        return false;
    }
}

/** 安全调用：函数（如 Amor 的 inspection/storyHealth）用 try/catch 包裹，失败返回 null。 */
export function safeCall(fn, ...args) {
    try {
        return typeof fn === 'function' ? fn(...args) : null;
    } catch {
        return null;
    }
}

/** 深拷贝：优先 structuredClone，回退 JSON。 */
export function deepClone(value) {
    if (value == null) return null;
    if (typeof structuredClone === 'function') return structuredClone(value);
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

/** 稳定字符串化：对象 key 排序，用于把对象 revision 变成可比较的字符串指纹（Contract §7）。 */
export function stableStringify(value) {
    if (value == null) return 'null';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** djb2 哈希：把稳定字符串化结果变成短指纹（只用于相等比较，非密码学）。 */
export function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
}

/** 对象 → 规范指纹字符串（Amor 的 object revision 用这个统一成 string，Contract §7）。 */
export function fingerprint(value) {
    return hashString(stableStringify(value));
}
