/* ==========================================================================
   Risveglio · Runtime Entry（Phase 3，最小版）
   流程：computeRevision → gate → stop / continue。
   changed === true 之后该做什么（Context Assembly / World / Actor / Guard / Core AI）
   尚未实现，留到后续 Phase。本阶段只保证：NO CHANGE 时在 Gate 处停止，任何 downstream 不执行。
   ========================================================================== */

import { computeRevision } from './revision.js';
import { gate } from './gate.js';

/**
 * @returns {{stopped: boolean, reason?: string}}
 */
export function run(adapters = {}, matrix = {}) {
    const revision = computeRevision(adapters, matrix);
    const decision = gate(revision);
    if (decision.stopped) return decision;
    // changed === true：允许继续（downstream 尚未接入）。
    return { stopped: false };
}
