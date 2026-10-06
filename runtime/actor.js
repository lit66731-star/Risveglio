/* ==========================================================================
   Risveglio · Actor（Phase 5-B）
   把结构化 entities 转成 Runtime 可识别的 actor 集合，同时保持身份边界。
   身份规则（硬编码为 Contract）：
   - entity.id = 身份主键（唯一依据）
   - entity.name = 显示属性（绝不作为身份依据）
   - entity.world / entity.timeline / entity.identity = 身份域
   因此：name 相同 ≠ 同一实体；甚至 world/timeline/identity 全相同也不合并——只有 id 是主键。
   边界（本阶段严格只做这一件事）：
   - 只消费 Runtime Context；worldContext 预留但 v1 不消费（不做「人物是否属于当前世界」筛选）。
   - 只读/整理：不 merge、不猜、不补、不反解析 characters 文本、不做关系/好感/相关性推理、不修改实体。
   - 纯函数：无随机/时间戳/累积状态。
   actors 语义：null = 无结构化实体来源；[] = 有来源但 0 个实体（Guard/Recall 后续可能区分）。
   ========================================================================== */

import { deepClone } from '../adapters/_shared.js';

/**
 * 从 Runtime Context 组装 Actor Context（Phase 5-B 唯一产出）。
 * @param {object} runtimeContext  assembleContext() 的产出
 * @param {object} [worldContext]  预留：v1 不消费，未来按世界筛人时再启用
 * @returns {{scope: object, actors: (Array|null)}}
 */
export function assembleActor(runtimeContext = {}, worldContext = null) {
    // 结构化实体来自 Phase 4 rev 的 serendipity.data.entities（含 id/身份域），不是 sections.characters 文本。
    const entities = runtimeContext.serendipity?.data?.entities;
    // null = 无结构化实体来源（保持 null，绝不回退解析 characters 文本）；[] = 有来源但 0 个实体。
    // 每个 actor 只是实体的受控 deep clone：source-faithful、不新增字段、1:1 保留 id，构造上即不 merge。
    const actors = entities == null ? null : entities.map(e => deepClone(e));
    return {
        scope: deepClone(runtimeContext.scope ?? null),
        actors,
    };
}
