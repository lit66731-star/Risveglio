/* ==========================================================================
   Risveglio · Capability Probe（能力检测 / Adapter Matrix）
   只验证三层的 available / compatible，不启动任何能力（纯读，不触发总结/规划 AI）。
   产出稳定报告，供 Runtime 初始化时决定哪些上游可进入（Contract §8）。
   ========================================================================== */

/**
 * 探测单个 adapter。
 * @param {object|null} adapter  window.Risveglio.adapters 里的某个 adapter
 * @param {Function} readFn      做一次真实读取来验证 compatible（纯读，不触发 AI）
 * @returns {{available: boolean, compatible: boolean|null, reason: string|null}}
 *   compatible: true = 形状符合 / false = 形状不对（旧版）/ null = 环境原因（无当前聊天）无法判定
 */
function probeOne(adapter, readFn) {
    if (!adapter || typeof adapter.available !== 'function') {
        return { available: false, compatible: false, reason: 'missing' };
    }
    let available = false;
    try { available = adapter.available(); } catch { available = false; }
    if (!available) {
        return { available: false, compatible: false, reason: 'unavailable' };
    }

    // compatible 必须靠一次真实调用判断（Contract §8：调用后检查返回形状；纯读，不触发 AI）。
    let env = null;
    try { env = readFn ? readFn() : null; } catch (err) {
        console.warn('[Risveglio][capability] read threw:', err);
        return { available: true, compatible: false, reason: 'threw' };
    }

    if (env && env.meta && env.meta.error === 'no_scope') {
        // 环境原因（无当前聊天）≠ 不兼容，单独标 null，别误判成「旧版/形状不对」。
        return { available: true, compatible: null, reason: 'no_scope' };
    }
    if (env && env.compatible === true) {
        return { available: true, compatible: true, reason: null };
    }
    return { available: true, compatible: false, reason: env?.meta?.error || 'unexpected_shape' };
}

/**
 * 跑完整 Capability Test，返回 Adapter Matrix。
 * @param {object} adapters  window.Risveglio.adapters
 */
export function runCapabilityProbe(adapters = {}) {
    return {
        serendipity: probeOne(adapters.serendipity, () => adapters.serendipity.getContext()),
        amor: probeOne(adapters.amor, () => adapters.amor.getDirection()),
        chat: probeOne(adapters.chat, () => adapters.chat.getSnapshot()),
    };
}
