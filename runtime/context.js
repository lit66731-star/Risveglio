/* ==========================================================================
   Risveglio · Runtime Context Assembly（Phase 4）
   定位：Gate 判定 changed === true 之后，把「当前事实上下文」组装成统一的 Runtime Context。
   边界（本阶段严格只做这一件事，以下全部不做）：
   - 只「搬运 / 规范化」当前事实，不判断哪些事实重要（排序/筛选/召回/摘要/压缩/冲突判断都归后面）。
   - 只读：只通过 adapter 读上游，绝不写回（Adapter → Assembly 单向，无 write 通道）。
   - 不执行 Recall / semantic search（不调用任何 buildRecallItems 之类）。
   - 能力判断交给 Adapter Matrix（available/compatible），Assembly 不重新解释 Capability。
   - 确定性：相同 adapter state → 相同输出（无随机、无时间戳、无累积状态）。
   data 语义：null = 无此来源（unavailable/no_scope/threw...）；对象 = 有来源（可为空 {}）。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';

// 单来源 section：Matrix 能力（会话级）+ 一次读结果的当前事实快照（深拷贝，与 adapter 缓存隔离）。
function _section(matrixEntry, env) {
    return {
        available: matrixEntry?.available ?? false,
        compatible: matrixEntry?.compatible ?? null,
        data: env ? deepClone(env.data) : null,
    };
}

/**
 * 组装 Runtime Context（Phase 4 唯一产出）。
 * @param {object} adapters  window.Risveglio.adapters
 * @param {object} matrix    window.Risveglio.matrix（Adapter Matrix）
 * @returns {{scope: {characterId: (string|null), chatId: (string|null)}, serendipity: object, amor: object, chat: object}}
 */
export function assembleContext(adapters = {}, matrix = {}) {
    // 每个来源只读一次：既避免重复读，也保证同一次组装内 scope 与 facts 出自同一快照。
    const s = adapters.serendipity ? adapters.serendipity.getContext() : null;
    const a = adapters.amor ? adapters.amor.getDirection() : null;
    const c = adapters.chat ? adapters.chat.getSnapshot() : null;

    return {
        scope: {
            characterId: c?.data?.characterId ?? null,
            chatId: c?.data?.chatId ?? null,
        },
        serendipity: _section(matrix.serendipity, s),
        amor: _section(matrix.amor, a),
        chat: _section(matrix.chat, c),
    };
}
