/* ==========================================================================
   Risveglio · NO CHANGE Gate（Phase 3）
   唯一职责：根据 Revision 的 changed 决定 Runtime 是否继续。
   - 消费 revision.changed，不重新比较指纹（比较是 Revision 的职责，不在这里泄漏）。
   - reason 是「控制流」结果（Runtime 为什么停），与 adapter 的「能力」错误码
     （unavailable / no_scope / null_result / unexpected_shape / threw）是两个不同层级。
   ========================================================================== */

/**
 * @param {{changed: boolean}} revision  computeRevision() 的结果
 * @returns {{stopped: boolean, reason?: string}}  stopped=true 时 reason='no_change'
 */
export function gate(revision) {
    if (revision && revision.changed === false) {
        return { stopped: true, reason: 'no_change' };
    }
    return { stopped: false };
}
