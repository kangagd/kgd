import React from "react";

/**
 * ProjectOverviewLayout - Layout component for project overview sections
 * 
 * Renders four vertical zones in order:
 * 1. SnapshotZone - High-level project snapshot/summary
 * 2. AttentionZone - Items requiring attention
 * 3. NextActionsZone - Upcoming actions and tasks
 * 4. SummaryZone - Detailed summary and history
 * 
 * @param {React.ReactNode} snapshotZone - Content for the snapshot section
 * @param {React.ReactNode} attentionZone - Content for attention items
 * @param {React.ReactNode} nextActionsZone - Content for next actions
 * @param {React.ReactNode} summaryZone - Content for summary section
 */
export default function ProjectOverviewLayout({
  snapshotZone,
  attentionZone,
  nextActionsZone,
  summaryZone
}) {
  return (
    <div className="space-y-4">
      {/* Snapshot Zone */}
      {snapshotZone && (
        <div className="snapshot-zone">
          {snapshotZone}
        </div>
      )}

      {/* Attention Zone */}
      {attentionZone && (
        <div className="attention-zone">
          {attentionZone}
        </div>
      )}

      {/* Next Actions Zone */}
      {nextActionsZone && (
        <div className="next-actions-zone">
          {nextActionsZone}
        </div>
      )}

      {/* Summary Zone */}
      {summaryZone && (
        <div className="summary-zone">
          {summaryZone}
        </div>
      )}
    </div>
  );
}