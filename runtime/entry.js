/* ==========================================================================
   Risveglio · Runtime Entry（Phase 5-A）
   流程：computeRevision → gate → stop / (continue → Context Assembly → World)。
   changed === true 之后：组装 Runtime Context（Phase 4），再从它组装 World（Phase 5-A），然后停住。
   Actor / Guard / Core AI 等 downstream 尚未接入。
   每一层只消费上一层明确提供的数据，不越层偷读。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';
import { assembleContext } from './context.js';
import { assembleWorld } from './world.js';

export { assembleContext, assembleWorld };

/**
 * @returns {{stopped: boolean, reason?: string, context?: object, world?: object}}
 */
export function run(adapters = {}, matrix = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：组装 Runtime Context（纯搬运），再从它组装 World（纯读，不重捞上游）。
    const context = assembleContext(adapters, matrix);
    const world = assembleWorld(context);
    return { stopped: false, context, world };
}
