/* ==========================================================================
   Risveglio · Runtime Entry（Phase 5-C）
   流程：computeRevision → gate → stop / (continue → Context Assembly → World → Actor → Guard)。
   changed === true 之后：组装 Runtime Context（Phase 4）→ World（5-A）→ Actor（5-B）→ Guard（5-C），然后停住。
   Guard 是收口检查点：跨看 world + actor（Contract 明确授权），不是越层偷读。
   Core AI 等 downstream 尚未接入。
   每一层只消费上一层明确提供的数据；Guard 是唯一明确声明的多分支收口例外。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';
import { assembleContext } from './context.js';
import { assembleWorld } from './world.js';
import { assembleActor } from './actor.js';
import { assembleGuard } from './guard.js';

export { assembleContext, assembleWorld, assembleActor, assembleGuard };

/**
 * @returns {{stopped: boolean, reason?: string, context?: object, world?: object, actor?: object, guard?: object}}
 */
export function run(adapters = {}, matrix = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：层层组装；Guard 只吃 world + actor（跨层收口例外），不回读 context/adapter。
    const context = assembleContext(adapters, matrix);
    const world = assembleWorld(context);
    const actor = assembleActor(context, world);
    const guard = assembleGuard(world, actor);
    return { stopped: false, context, world, actor, guard };
}
