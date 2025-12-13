import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  AlertTriangle, 
  AlertCircle, 
  Plus, 
  Shield, 
  Truck,
  DollarSign,
  Key,
  Wrench,
  Star,
  Check,
  ChevronDown,
  ChevronUp,
  Quote
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const FLAG_TYPES = {
  client_risk: { icon: AlertTriangle, color: "border-red-200 bg-red-50", iconColor: "text-red-600", template: "Sensitive client" },
  site_constraint: { icon: AlertCircle, color: "border-orange-200 bg-orange-50", iconColor: "text-orange-600", template: "Site access or physical constraint" },
  payment_hold: { icon: DollarSign, color: "border-red-200 bg-red-50", iconColor: "text-red-600", template: "Invoice outstanding" },
  access_issue: { icon: Key, color: "border-amber-200 bg-amber-50", iconColor: "text-amber-600", template: "Access or coordination required" },
  technical_risk: { icon: Wrench, color: "border-orange-200 bg-orange-50", iconColor: "text-orange-600", template: "Technical risk — review before scheduling" },
  logistics_dependency: { icon: Truck, color: "border-blue-200 bg-blue-50", iconColor: "text-blue-600", template: "Parts have not arrived" },
  vip_client: { icon: Star, color: "border-purple-200 bg-purple-50", iconColor: "text-purple-600", template: "VIP client — prioritize" },
  internal_warning: { icon: Shield, color: "border-gray-200 bg-gray-50", iconColor: "text-gray-600", template: "Internal note or warning" }
};

const generateCanonicalKey = (flag) => {
  if (flag.canonical_key) return flag.canonical_key;
  const normalizedLabel = (flag.label || '').toLowerCase().trim();
  return `${flag.type}:${normalizedLabel}`;
};

export default function AttentionPanel({ flags = [], inheritedFlags = [], entityId, entityType, onUpdate, currentUser }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [flagToResolve, setFlagToResolve] = useState(null);
  const [showAllFlags, setShowAllFlags] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';
  const canManageFlags = isAdmin || isManager;

  // Build canonical keys for inherited flags
  const inheritedCanonicalKeys = useMemo(() => {
    return new Set(
      inheritedFlags
        .filter(f => !f.resolved_at && !f.dismissed_at)
        .map(f => generateCanonicalKey(f))
    );
  }, [inheritedFlags]);

  // Separate manual/accepted and AI-suggested flags
  const manualFlags = flags.filter(f => f.origin === 'manual' && !f.resolved_at && !f.dismissed_at);
  
  // Filter AI suggestions to exclude duplicates
  const aiSuggestedFlags = useMemo(() => {
    return flags
      .filter(f => f.origin === 'ai_suggested' && !f.accepted_at && !f.dismissed_at)
      .filter(f => {
        const key = generateCanonicalKey(f);
        return !inheritedCanonicalKeys.has(key);
      });
  }, [flags, inheritedCanonicalKeys]);

  // Sort manual flags: pinned first, then severity (internal), then newest
  const sortedManualFlags = useMemo(() => {
    return [...manualFlags].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aSeverity = severityOrder[a.severity] ?? 3;
      const bSeverity = severityOrder[b.severity] ?? 3;
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [manualFlags]);

  // Sort inherited flags same way
  const sortedInheritedFlags = useMemo(() => {
    return [...inheritedFlags].filter(f => !f.resolved_at && !f.dismissed_at).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aSeverity = severityOrder[a.severity] ?? 3;
      const bSeverity = severityOrder[b.severity] ?? 3;
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [inheritedFlags]);

  // Combine manual and inherited for display (inherited don't count in total)
  const allDisplayFlags = [...sortedManualFlags, ...sortedInheritedFlags];
  const visibleFlags = showAllFlags ? allDisplayFlags : allDisplayFlags.slice(0, 3);
  const hasMoreFlags = allDisplayFlags.length > 3;
  const totalCount = sortedManualFlags.length;

  const handleAddFlag = async (newFlag) => {
    const flagWithId = {
      ...newFlag,
      id: `flag-${Date.now()}`,
      origin: 'manual',
      canonical_key: generateCanonicalKey(newFlag),
      scope_source: entityType,
      created_by: currentUser?.email,
      created_at: new Date().toISOString(),
      acknowledged_by: []
    };

    const updatedFlags = [...flags, flagWithId];
    await onUpdate(updatedFlags);
    setShowAddModal(false);
  };

  const handleResolveFlag = async (flag, reason) => {
    const updatedFlag = {
      ...flag,
      resolved_at: new Date().toISOString(),
      resolved_by: currentUser?.email,
      resolved_reason: reason
    };

    const updatedFlags = flags.map(f => f.id === flag.id ? updatedFlag : f);
    await onUpdate(updatedFlags);
    setShowResolveModal(false);
    setFlagToResolve(null);
  };

  const handleAcceptAI = async (suggestion) => {
    const acceptedFlag = {
      ...suggestion,
      origin: 'manual',
      canonical_key: generateCanonicalKey(suggestion),
      scope_source: entityType,
      accepted_at: new Date().toISOString(),
      accepted_by: currentUser?.email,
      original_ai_suggestion: { ...suggestion }
    };

    const updatedFlags = flags.map(f => f.id === suggestion.id ? acceptedFlag : f);
    await onUpdate(updatedFlags);
  };

  const handleDismissAI = async (suggestion) => {
    const dismissedFlag = {
      ...suggestion,
      dismissed_at: new Date().toISOString(),
      dismissed_by: currentUser?.email
    };

    const updatedFlags = flags.map(f => f.id === suggestion.id ? dismissedFlag : f);
    await onUpdate(updatedFlags);
  };

  // Don't render if no flags
  if (totalCount === 0 && sortedInheritedFlags.length === 0 && aiSuggestedFlags.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border border-[#E5E7EB] bg-white shadow-sm rounded-lg">
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-[#111827]">Attention</CardTitle>
              {totalCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-medium">
                  {totalCount}
                </span>
              )}
            </div>
            {canManageFlags && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(true)}
                className="h-8 gap-1.5 text-xs font-medium hover:bg-[#F3F4F6]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Flag
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4">
          {/* Manual & Inherited Flags */}
          {visibleFlags.length > 0 && (
            <div className="space-y-2">
              {visibleFlags.map(flag => {
                const isInherited = inheritedFlags.some(f => f.id === flag.id);
                return isInherited ? (
                  <InheritedFlagItem key={flag.id} flag={flag} />
                ) : (
                  <FlagItem
                    key={flag.id}
                    flag={flag}
                    onUpdate={onUpdate}
                    allFlags={flags}
                    onResolve={() => {
                      setFlagToResolve(flag);
                      setShowResolveModal(true);
                    }}
                    currentUser={currentUser}
                    canManageFlags={canManageFlags}
                  />
                );
              })}
            </div>
          )}

          {hasMoreFlags && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllFlags(!showAllFlags)}
              className="w-full text-xs text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
            >
              {showAllFlags ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show all ({allDisplayFlags.length})
                </>
              )}
            </Button>
          )}

          {/* AI Suggested Flags - Only show if there are suggestions after dedupe */}
          {aiSuggestedFlags.length > 0 && (
            <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
              <div className="text-xs font-medium text-[#6B7280] mb-2">Suggested</div>
              {aiSuggestedFlags.map(suggestion => (
                <AISuggestedFlag
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => handleAcceptAI(suggestion)}
                  onDismiss={() => handleDismissAI(suggestion)}
                  onEditAccept={(editedSuggestion) => handleAcceptAI(editedSuggestion)}
                  allFlags={flags}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddFlagModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddFlag}
      />

      <ResolveFlagModal
        open={showResolveModal}
        flag={flagToResolve}
        onClose={() => {
          setShowResolveModal(false);
          setFlagToResolve(null);
        }}
        onResolve={handleResolveFlag}
      />
    </>
  );
}

function FlagItem({ flag, onUpdate, allFlags, onResolve, currentUser, canManageFlags }) {
  const flagType = FLAG_TYPES[flag.type] || FLAG_TYPES.internal_warning;
  const Icon = flagType.icon;
  const [showAllSources, setShowAllSources] = useState(false);
  
  const isAcknowledgedByMe = flag.acknowledged_by?.includes(currentUser?.email);
  const sourceRefs = Array.isArray(flag.source_refs) ? flag.source_refs : [];
  const visibleSources = showAllSources ? sourceRefs : sourceRefs.slice(0, 1);

  const handleAcknowledge = async () => {
    if (isAcknowledgedByMe) return;
    
    const updatedFlag = {
      ...flag,
      acknowledged_by: [...(flag.acknowledged_by || []), currentUser.email]
    };
    
    const updatedFlags = allFlags.map(f => f.id === flag.id ? updatedFlag : f);
    await onUpdate(updatedFlags);
  };

  return (
    <div className={`border ${flagType.color} rounded-lg p-3 relative`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${flagType.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="font-semibold text-[#111827] text-sm leading-tight">
            {flag.label}
          </div>
          {flag.details && (
            <p className="text-sm text-[#4B5563] leading-snug">{flag.details}</p>
          )}
          
          {/* Evidence Block */}
          {sourceRefs.length > 0 ? (
            <div className="space-y-1.5 mt-2">
              {visibleSources.map((ref, idx) => (
                <div key={idx} className="bg-white/60 border border-slate-200 rounded-md p-2">
                  <div className="flex items-start gap-1.5">
                    <Quote className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 italic leading-relaxed">{ref.excerpt}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        {ref.label && <span className="font-medium">{ref.label}</span>}
                        {ref.meta?.date && <span>• {new Date(ref.meta.date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {sourceRefs.length > 1 && (
                <button
                  onClick={() => setShowAllSources(!showAllSources)}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  {showAllSources ? 'Hide sources' : `Show ${sourceRefs.length - 1} more source${sourceRefs.length - 1 > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          ) : (
            canManageFlags && (
              <p className="text-xs text-slate-400 italic">No reference available</p>
            )
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isAcknowledgedByMe && (
            <button
              onClick={handleAcknowledge}
              className="p-1.5 hover:bg-green-50 rounded-md transition-colors"
              title="Acknowledge"
            >
              <Check className="w-4 h-4 text-green-600" />
            </button>
          )}
          {canManageFlags && (
            <button
              onClick={onResolve}
              className="p-1.5 hover:bg-blue-50 rounded-md transition-colors text-blue-600"
              title="Resolve"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InheritedFlagItem({ flag }) {
  const flagType = FLAG_TYPES[flag.type] || FLAG_TYPES.internal_warning;
  const Icon = flagType.icon;
  const [showAllSources, setShowAllSources] = useState(false);
  
  const sourceRefs = Array.isArray(flag.source_refs) ? flag.source_refs : [];
  const visibleSources = showAllSources ? sourceRefs : sourceRefs.slice(0, 1);

  return (
    <div className={`border ${flagType.color} rounded-lg p-3 opacity-75`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${flagType.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-xs text-slate-600 font-medium">
              🔁 From Project
            </span>
          </div>
          <div className="font-medium text-[#111827] text-sm leading-tight">
            {flag.label}
          </div>
          
          {/* Evidence Block (read-only) */}
          {sourceRefs.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {visibleSources.map((ref, idx) => (
                <div key={idx} className="bg-white/40 border border-slate-200 rounded-md p-2">
                  <div className="flex items-start gap-1.5">
                    <Quote className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-600 italic leading-relaxed">{ref.excerpt}</p>
                      {ref.label && (
                        <div className="text-[10px] text-slate-400 mt-1">{ref.label}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sourceRefs.length > 1 && (
                <button
                  onClick={() => setShowAllSources(!showAllSources)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  {showAllSources ? 'Hide sources' : `Show ${sourceRefs.length - 1} more`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddFlagModal({ open, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    type: "internal_warning",
    label: "",
    details: "",
    severity: "warning",
    pinned: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.label.trim()) return;
    onSubmit(formData);
    setFormData({
      type: "internal_warning",
      label: "",
      details: "",
      severity: "warning",
      pinned: false
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Attention Flag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(val) => {
                const flagType = FLAG_TYPES[val];
                setFormData({ 
                  ...formData, 
                  type: val,
                  label: flagType?.template || ""
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_risk">Client Risk</SelectItem>
                <SelectItem value="site_constraint">Site Constraint</SelectItem>
                <SelectItem value="payment_hold">Payment Hold</SelectItem>
                <SelectItem value="access_issue">Access Issue</SelectItem>
                <SelectItem value="technical_risk">Technical Risk</SelectItem>
                <SelectItem value="logistics_dependency">Logistics Dependency</SelectItem>
                <SelectItem value="vip_client">VIP Client</SelectItem>
                <SelectItem value="internal_warning">Internal Warning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Label (max 48 chars)</Label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Brief factual statement"
              maxLength={48}
              required
            />
          </div>

          <div>
            <Label>Details (max 120 chars, optional)</Label>
            <Textarea
              value={formData.details}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              placeholder="One-line context..."
              className="min-h-[60px]"
              maxLength={120}
            />
          </div>

          <div>
            <Label>Severity</Label>
            <Select
              value={formData.severity}
              onValueChange={(val) => setFormData({ ...formData, severity: val })}
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
            <Checkbox
              id="pinned"
              checked={formData.pinned}
              onCheckedChange={(checked) => setFormData({ ...formData, pinned: checked })}
            />
            <Label htmlFor="pinned" className="text-sm cursor-pointer">
              Pin to top
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
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim() || !flag) return;
    
    onResolve(flag, reason);
    setReason("");
  };

  if (!flag) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Attention Flag</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="font-medium text-sm text-[#111827] mb-1">{flag.label}</p>
            {flag.details && (
              <p className="text-xs text-[#6B7280]">{flag.details}</p>
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