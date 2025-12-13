import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Eye, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function AttentionFlagItem({ 
  flag, 
  config, 
  severityConfig, 
  entity,
  entityType,
  onUpdate,
  canEdit,
  isInherited
}) {
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionReason, setResolutionReason] = useState("");
  const Icon = config.icon;

  const handleAcknowledge = async () => {
    if (isInherited) return; // Can't modify inherited flags
    
    const updated = {
      ...entity,
      attention_flags: entity.attention_flags.map(f =>
        f.id === flag.id ? { ...f, acknowledged: true } : f
      )
    };
    
    try {
      await base44.entities[entityType].update(entity.id, updated);
      onUpdate();
    } catch (error) {
      console.error('Failed to acknowledge flag:', error);
    }
  };

  const handleResolve = async () => {
    if (isInherited) return;
    if (!resolutionReason.trim()) return;

    const user = await base44.auth.me();
    const updated = {
      ...entity,
      attention_flags: entity.attention_flags.map(f =>
        f.id === flag.id 
          ? { 
              ...f, 
              resolved: true, 
              resolution_reason: resolutionReason,
              resolved_by: user.email,
              resolved_at: new Date().toISOString()
            } 
          : f
      )
    };

    try {
      await base44.entities[entityType].update(entity.id, updated);
      
      // Log to change history
      await base44.entities.ChangeHistory.create({
        [`${entityType.toLowerCase()}_id`]: entity.id,
        field_name: 'attention_flags',
        old_value: `Flag: ${flag.label}`,
        new_value: `Resolved: ${resolutionReason}`,
        changed_by: user.email,
        changed_by_name: user.full_name
      });
      
      onUpdate();
    } catch (error) {
      console.error('Failed to resolve flag:', error);
    }
  };

  return (
    <div 
      className={`border-l-4 ${severityConfig.border} ${severityConfig.bg} rounded-r-lg p-3 transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-medium text-[14px] ${severityConfig.text}`}>
                {flag.label}
              </span>
              {isInherited && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Inherited
                </Badge>
              )}
              {flag.pinned && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Pinned
                </Badge>
              )}
              {flag.acknowledged && !resolving && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  Seen
                </Badge>
              )}
            </div>
            <p className="text-[13px] text-[#4B5563]">
              {config.label} • {format(new Date(flag.created_at), 'dd MMM yyyy')}
            </p>
            
            {expanded && flag.details && (
              <div className="mt-2 p-2 bg-white/50 rounded text-[13px] text-[#4B5563]">
                {flag.details}
              </div>
            )}
            
            {resolving && !isInherited && (
              <div className="mt-3 space-y-2">
                <Textarea
                  placeholder="Why is this being resolved?"
                  value={resolutionReason}
                  onChange={(e) => setResolutionReason(e.target.value)}
                  className="text-[13px]"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleResolve}
                    disabled={!resolutionReason.trim()}
                    className="h-7 text-[12px]"
                  >
                    Confirm Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setResolving(false);
                      setResolutionReason("");
                    }}
                    className="h-7 text-[12px]"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {!isInherited && (
          <div className="flex items-center gap-1 ml-2">
            {flag.details && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-7 px-2"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            )}
            {canEdit && !flag.acknowledged && !resolving && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAcknowledge}
                className="h-7 px-2"
                title="Mark as seen"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </Button>
            )}
            {canEdit && !resolving && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResolving(true)}
                className="h-7 px-2"
                title="Resolve flag"
              >
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}