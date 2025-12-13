import React, { useState, useMemo } from "react";
import { 
  AlertTriangle, 
  MapPin, 
  DollarSign, 
  KeyRound, 
  Wrench, 
  Truck, 
  Star, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  CheckCircle,
  Plus
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/components/common/PermissionsContext";
import CreateAttentionFlagModal from "./CreateAttentionFlagModal";
import AttentionFlagItem from "./AttentionFlagItem";

const FLAG_TYPE_CONFIG = {
  client_risk: { 
    icon: AlertTriangle, 
    label: "Client Risk",
    color: "text-red-600"
  },
  site_constraint: { 
    icon: MapPin, 
    label: "Site Constraint",
    color: "text-amber-600"
  },
  payment_hold: { 
    icon: DollarSign, 
    label: "Payment Hold",
    color: "text-red-600"
  },
  access_issue: { 
    icon: KeyRound, 
    label: "Access Issue",
    color: "text-amber-600"
  },
  technical_risk: { 
    icon: Wrench, 
    label: "Technical Risk",
    color: "text-orange-600"
  },
  logistics_dependency: { 
    icon: Truck, 
    label: "Logistics Dependency",
    color: "text-blue-600"
  },
  vip_client: { 
    icon: Star, 
    label: "VIP Client",
    color: "text-purple-600"
  },
  internal_warning: { 
    icon: AlertCircle, 
    label: "Internal Warning",
    color: "text-red-600"
  }
};

const SEVERITY_CONFIG = {
  info: {
    bg: "bg-blue-50",
    border: "border-l-blue-500",
    text: "text-blue-900"
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    text: "text-amber-900"
  },
  critical: {
    bg: "bg-red-50",
    border: "border-l-red-500",
    text: "text-red-900"
  }
};

export default function AttentionPanel({ 
  entity, 
  entityType, 
  onUpdate,
  inheritedFlags = [] // Flags from customer/project
}) {
  const { canWrite } = usePermissions();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const allFlags = useMemo(() => {
    const entityFlags = entity?.attention_flags || [];
    return [...inheritedFlags, ...entityFlags];
  }, [entity?.attention_flags, inheritedFlags]);

  // Sort: critical first, then pinned, then by creation date
  const sortedFlags = useMemo(() => {
    return [...allFlags]
      .filter(f => !f.resolved)
      .sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (b.severity === 'critical' && a.severity !== 'critical') return 1;
        if (a.pinned && !b.pinned) return -1;
        if (b.pinned && !a.pinned) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [allFlags]);

  const hasCritical = sortedFlags.some(f => f.severity === 'critical');
  const visibleFlags = isCollapsed ? [] : sortedFlags.slice(0, 3);
  const remainingCount = sortedFlags.length - visibleFlags.length;

  if (sortedFlags.length === 0) {
    return null;
  }

  // Auto-expand if critical flags exist
  React.useEffect(() => {
    if (hasCritical && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [hasCritical, isCollapsed]);

  return (
    <>
      <Card className={`mb-6 border-2 ${hasCritical ? 'border-red-500' : 'border-amber-500'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${hasCritical ? 'text-red-600' : 'text-amber-600'}`} />
              <h3 className="font-semibold text-[16px]">Attention Required</h3>
              <Badge variant={hasCritical ? "error" : "warning"}>
                {sortedFlags.length} {sortedFlags.length === 1 ? 'flag' : 'flags'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {canWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Flag
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="gap-2"
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide
                  </>
                )}
              </Button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="space-y-2">
              {visibleFlags.map((flag) => (
                <AttentionFlagItem
                  key={flag.id}
                  flag={flag}
                  config={FLAG_TYPE_CONFIG[flag.type]}
                  severityConfig={SEVERITY_CONFIG[flag.severity]}
                  entity={entity}
                  entityType={entityType}
                  onUpdate={onUpdate}
                  canEdit={canWrite}
                  isInherited={inheritedFlags.some(f => f.id === flag.id)}
                />
              ))}
              
              {remainingCount > 0 && (
                <div className="text-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {/* TODO: Show all modal */}}
                    className="text-[#6B7280] hover:text-[#111827]"
                  >
                    + {remainingCount} more {remainingCount === 1 ? 'flag' : 'flags'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {showCreateModal && (
        <CreateAttentionFlagModal
          entity={entity}
          entityType={entityType}
          onClose={() => setShowCreateModal(false)}
          onSuccess={onUpdate}
        />
      )}
    </>
  );
}