/* ==========================================================================
   Risveglio · Runtime Entry（Phase 6）
   流程（确定性部分）：computeRevision → gate → stop / (continue → Context → World → Actor → Guard → Core Input)。
   changed === true 且 gate 通过后：层层组装到 Guard（收口检查点，跨看 world+actor），
   再 assembleCore 组装 Core Input（最终消费者，跨看 context+world+actor+guard），然后停住。
   非确定性部分：generateCore(coreInput, coreConfig) 是独立显式步骤，run() 本身不发请求、不循环。
   跨层例外只有两处且均已写死：Guard=检查点、Core=最终消费者。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';
import { assembleContext } from './context.js';
import { assembleWorld } from './world.js';
import { assembleActor } from './actor.js';
import { assembleGuard } from './guard.js';
import { assembleCore, generateCore } from './core.js';

export { assembleContext, assembleWorld, assembleActor, assembleGuard, assembleCore, generateCore };

/**
 * 确定性 Pipeline（一次 run 最多到 Core Input，绝不发请求）。
 * @returns {{stopped: boolean, reason?: string, context?: object, world?: object, actor?: object, guard?: object, coreInput?: object}}
 */
export function run(adapters = {}, matrix = {}, coreConfig = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：层层组装；Guard 只吃 world+actor，Core 吃全景，均不回读 adapter。
    const context = assembleContext(adapters, matrix);
    const world = assembleWorld(context);
    const actor = assembleActor(context, world);
    const guard = assembleGuard(world, actor);
    const coreInput = assembleCore(context, world, actor, guard, coreConfig);
    return { stopped: false, context, world, actor, guard, coreInput };
}
