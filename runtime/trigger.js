/* ==========================================================================
   Risveglio · Trigger（Phase 8）
   定位：Runtime 的「唤醒编排层」——接受外部触发信号，负责触发请求的合并与
         生命周期管理，并调用既有 runtime.run()。
   边界（本阶段严格只做这一件事，以下全部不做）：
   - 只「唤醒 + 合并并发触发」，绝不自行比较指纹、不缓存 revision、不重复造
     变化检测——「是否变化」的唯一判断权属于 Revision → Gate。
   - 不读任何数据（不碰 adapter / ST / window.getContext）；数据读取归 Adapter。
   - 不自动调用生成：「一次 run 最多一次生成」是 run() 与生成步骤之间的既有
     边界，Trigger 不重新定义、也不触发生成（A3 + B1）。
   - 不写回、不接 ST 自动事件（A1 留未来可插拔接线位，本阶段不接）。
   - Freshness 一跳滞后是既有契约，Trigger 不修。
   本文件零 import：结构上就无法接触指纹 / 变化检测 / 生成模块，也不读任何数据。
   ========================================================================== */

// 进行中的 run Promise（用于合并同一窗口内的多次触发请求，避免并行 run()）。
// 只在 run 完全 settle（含未来异步 run）后才清空，保证整个生命周期内并发触发都被合并。
let _inFlight = null;

/**
 * 手动触发一次 Runtime 分析（A3 + B1：只到 Core Input，绝不自动生成）。
 * @param {Function} run   runtime.run(adapters, matrix, coreConfig)
 * @param {object} [adapters]    window.Risveglio.adapters
 * @param {object} [matrix]      window.Risveglio.matrix
 * @param {object} [coreConfig]  window.Risveglio.coreConfig
 * @returns {Promise<object>} run() 的原始结果透传：
 *   changed:false → { stopped:true, reason:'no_change' }
 *   changed:true  → { stopped:false, context, world, actor, guard, coreInput }
 */
export function trigger(run, adapters = {}, matrix = {}, coreConfig = {}) {
    if (typeof run !== 'function') {
        return Promise.reject(new Error('[Risveglio][trigger] run 不是函数，无法唤醒 Runtime'));
    }
    // 合并：同一窗口内多次 trigger 复用同一次进行中的 run，绝不并行执行 run()。
    if (_inFlight) return _inFlight;
    _inFlight = Promise.resolve()
        .then(() => run(adapters, matrix, coreConfig))
        .finally(() => { _inFlight = null; });
    return _inFlight;
}
