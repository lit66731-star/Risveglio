/* ==========================================================================
   Risveglio · World（Phase 5-A）
   回答一个问题：「当前剧情的世界状态是什么？」
   边界（本阶段严格只做这一件事）：
   - 只从 Runtime Context（Phase 4 产出）消费，绝不重新去 Serendipity/Amor 捞数据（不越层偷读）。
   - 世界事实来自 Fact 层（Serendipity）的 section，不是 Interpretation 层（Amor）的 plan/归纳。
   - 只读：只搬运/整理，不写、不注入、不召回、不归档、不改世界状态。
   - source-faithful：section 名沿用 Serendipity 自己的 key（storyTime/worldState/timeline），不语义化。
   - 确定性：纯函数，无随机/时间戳/累积状态。
   世界字段语义：null = 无该世界事实（无来源或该事实尚未建立）；字符串 = 有该事实。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';

/**
 * 从 Runtime Context 组装 World Context（Phase 5-A 唯一产出）。
 * @param {object} runtimeContext  assembleContext() 的产出
 * @returns {{scope: object, storyTime: (string|null), worldState: (string|null), timeline: (string|null)}}
 */
export function assembleWorld(runtimeContext = {}) {
    // Serendipity fact 层的 sections：data=null（无来源）时 sections 拿不到 → 三个字段全 null。
    const sections = runtimeContext.serendipity?.data?.sections ?? null;

    return {
        scope: deepClone(runtimeContext.scope ?? null),   // 透传身份：这是哪段剧情的世界
        storyTime: sections?.storyTime ?? null,           // 剧情时间（第X天 · 时间 · 地点）
        worldState: sections?.worldState ?? null,         // 世界状态
        timeline: sections?.timeline ?? null,             // 时间线（最近）
    };
}
