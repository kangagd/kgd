import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  DollarSign,
  Key,
  Wrench,
  Truck,
  Star,
  Shield,
  Plus,
  X,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const FLAG_TYPES = {
  client_risk: { icon: AlertTriangle, label: "Client Risk", color: "text-red-600" },
  site_constraint: { icon: MapPin, label: "Site Constraint", color: "text-orange-600" },
  payment_hold: { icon: DollarSign, label: "Payment Hold", color: "text-red-600" },
  access_issue: { icon: Key, label: "Access Issue", color: "text-amber-600" },
  technical_risk: { icon: Wrench, label: "Technical Risk", color: "text-orange-600" },
  logistics_dependency: { icon: Truck, label: "Logistics Dependency", color: "text-blue-600" },
  vip_client: { icon: Star, label: "VIP Client", color: "text-purple-600" },
  internal_warning: { icon: Shield, label: "Internal Warning", color: "text-gray-600" }
};

const SEVERITY_STYLES = {
  info: {
    border: "border-l-4 border-l-blue-500",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700"
  },
  warning: {
    border: "border-l-4 border-l-amber-500",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700"
  },
  critical: {
    border: "border-l-4 border-l-red-500",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700"
  }
};

/**
 * AttentionPanel Component
 * Displays high-importance signals for Jobs, Projects, and Customers
 * Supports inheritance, auto-generation, and role-based editing
 */
export default function AttentionPanel({ 
  flags = [], 
  entityId,
  entityType, // "job" | "project" | "customer"
  onUpdate,
  currentUser,
  readonly = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(null);

  const canEdit = !readonly && (currentUser?.role === 'admin' || currentUser?.role === 'manager');

  // Sort flags: critical first, then pinned, then by created date
  const sortedFlags = useMemo(() => {
    const resolved = flags.filter(f => f.resolved_at);
    const active = flags.filter(f => !f.resolved_at);
    
    return active.sort((a, b) => {
      // Critical severity first
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      
      // Then pinned
      if (a.pinned && !b.pinned) return -1;
      if (b.pinned && !a.pinned) return 1;
      
      // Then by date
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [flags]);

  const activeFlags = sortedFlags.filter(f => !f.resolved_at);
  const hasCritical = activeFlags.some(f => f.severity === 'critical');
  const shouldAutoExpand = hasCritical || activeFlags.some(f => f.pinned);

  const visibleFlags = isExpanded ? activeFlags : activeFlags.slice(0, 3);

  const handleAcknowledge = async (flag) => {
    if (!currentUser) return;
    
    const acknowledged = flag.acknowledged_by || [];
    if (acknowledged.includes(currentUser.email)) return;
    
    const updatedFlags = flags.map(f => 
      f.id === flag.id 
        ? { ...f, acknowledged_by: [...acknowledged, currentUser.email] }
        : f
    );
    
    await onUpdate(updatedFlags);
  };

  const handleResolve = async (flag, reason) => {
    const updatedFlags = flags.map(f => 
      f.id === flag.id 
        ? { 
            ...f, 
            resolved_at: new Date().toISOString(),
            resolved_by: currentUser.email,
            resolved_reason: reason
          }
        : f
    );
    
    await onUpdate(updatedFlags);
    setShowResolveModal(false);
    setSelectedFlag(null);
  };

  const handleAddFlag = async (newFlag) => {
    const flagWithMeta = {
      ...newFlag,
      id: `flag_${Date.now()}`,
      created_by: currentUser.email,
      created_at: new Date().toISOString(),
      acknowledged_by: [],
      auto_generated: false
    };
    
    await onUpdate([...flags, flagWithMeta]);
    setShowAddModal(false);
  };

  const handleRemoveFlag = async (flagId) => {
    const updatedFlags = flags.filter(f => f.id !== flagId);
    await onUpdate(updatedFlags);
  };

  if (activeFlags.length === 0 && !canEdit) return null;

  return (
    <>
      <Card className={cn(
        "mb-6 border-2 transition-all",
        hasCritical ? "border-red-200 shadow-md" : "border-amber-100"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className={cn(
                "w-5 h-5",
                hasCritical ? "text-red-600" : "text-amber-600"
              )} />
              <h3 className="text-sm font-semibold text-gray-900">
                Attention Required
              </h3>
              {activeFlags.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFlags.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Flag
                </Button>
              )}
              {activeFlags.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show All ({activeFlags.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {visibleFlags.map((flag) => {
              const typeConfig = FLAG_TYPES[flag.type] || FLAG_TYPES.internal_warning;
              const Icon = typeConfig.icon;
              const severityStyle = SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.info;
              const isAcknowledged = flag.acknowledged_by?.includes(currentUser?.email);

              return (
                <div
                  key={flag.id}
                  className={cn(
                    "rounded-lg p-3 transition-all",
                    severityStyle.border,
                    severityStyle.bg
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", typeConfig.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">
                            {flag.label}
                          </span>
                          <Badge className={severityStyle.badge}>
                            {flag.severity}
                          </Badge>
                          {flag.pinned && (
                            <Badge variant="outline" className="text-xs">
                              Pinned
                            </Badge>
                          )}
                          {flag.source && (
                            <Badge variant="outline" className="text-xs text-gray-600">
                              {flag.source.replace('inherited_from_', 'From ')}
                            </Badge>
                          )}
                        </div>
                        {flag.details && (
                          <p className="text-xs text-gray-700 mb-2">{flag.details}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>by {flag.created_by}</span>
                          <span>•</span>
                          <span>{new Date(flag.created_at).toLocaleDateString()}</span>
                          {flag.acknowledged_by?.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">
                                Ack'd by {flag.acknowledged_by.length}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!isAcknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(flag)}
                          className="h-7 text-xs"
                          title="Acknowledge"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      {canEdit && !flag.auto_generated && !flag.source && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedFlag(flag);
                              setShowResolveModal(true);
                            }}
                            className="h-7 text-xs text-green-600 hover:text-green-700"
                          >
                            Resolve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFlag(flag.id)}
                            className="h-7 text-xs text-red-600 hover:text-red-700"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Flag Modal */}
      <AddFlagModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddFlag}
      />

      {/* Resolve Flag Modal */}
      <ResolveFlagModal
        open={showResolveModal}
        flag={selectedFlag}
        onClose={() => {
          setShowResolveModal(false);
          setSelectedFlag(null);
        }}
        onResolve={handleResolve}
      />
    </>
  );
}

function AddFlagModal({ open, onClose, onAdd }) {
  const [formData, setFormData] = useState({
    type: 'internal_warning',
    label: '',
    details: '',
    severity: 'warning',
    pinned: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.label.trim()) return;
    
    onAdd(formData);
    setFormData({
      type: 'internal_warning',
      label: '',
      details: '',
      severity: 'warning',
      pinned: false
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Attention Flag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Flag Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FLAG_TYPES).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Label (Required)</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Brief description"
              required
            />
          </div>

          <div>
            <Label>Details (Optional)</Label>
            <Textarea
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              placeholder="Additional context for internal use"
              rows={3}
            />
          </div>

          <div>
            <Label>Severity</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData({ ...formData, severity: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinned"
              checked={formData.pinned}
              onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="pinned" className="cursor-pointer">
              Pin this flag (always visible)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.label.trim()}>
              Add Flag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolveFlagModal({ open, flag, onClose, onResolve }) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    
    onResolve(flag, reason);
    setReason('');
  };

  if (!flag) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Attention Flag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-medium text-sm text-gray-900 mb-1">{flag.label}</p>
            {flag.details && (
              <p className="text-xs text-gray-600">{flag.details}</p>
            )}
          </div>

          <div>
            <Label>Resolution Reason (Required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this flag is being resolved..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reason.trim()}>
              Resolve Flag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}