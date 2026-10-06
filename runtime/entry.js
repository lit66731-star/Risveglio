/* ==========================================================================
   Risveglio · Runtime Entry（Phase 5-B）
   流程：computeRevision → gate → stop / (continue → Context Assembly → World → Actor)。
   changed === true 之后：组装 Runtime Context（Phase 4）→ World（5-A）→ Actor（5-B），然后停住。
   Guard / Core AI 等 downstream 尚未接入。
   每一层只消费上一层明确提供的数据，不越层偷读。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';
import { assembleContext } from './context.js';
import { assembleWorld } from './world.js';
import { assembleActor } from './actor.js';

export { assembleContext, assembleWorld, assembleActor };

/**
 * @returns {{stopped: boolean, reason?: string, context?: object, world?: object, actor?: object}}
 */
export function run(adapters = {}, matrix = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：层层组装，每一层只消费上一层的产出，不越层偷读。
    const context = assembleContext(adapters, matrix);
    const world = assembleWorld(context);
    const actor = assembleActor(context, world);
    return { stopped: false, context, world, actor };
}
