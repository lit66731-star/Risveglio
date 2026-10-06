/* ==========================================================================
   Risveglio · Runtime Entry（Phase 4）
   流程：computeRevision → gate → stop / (continue → Context Assembly)。
   changed === true 之后只做一件事：组装 Runtime Context（Phase 4），然后停住。
   World / Actor / Guard / Core AI 等 downstream 尚未接入。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';
import { assembleContext } from './context.js';

export { assembleContext };

/**
 * @returns {{stopped: boolean, reason?: string, context?: object}}
 */
export function run(adapters = {}, matrix = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：组装当前事实上下文（Assembly 纯搬运，不做 Recall/筛选）。
    const context = assembleContext(adapters, matrix);
    return { stopped: false, context };
}
