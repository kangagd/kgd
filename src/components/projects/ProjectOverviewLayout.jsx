import React from "react";

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