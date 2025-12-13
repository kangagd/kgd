import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  ThumbsUp,
  ThumbsDown,
  Edit,
  AlertTriangle,
  Shield,
  AlertCircle,
  Truck,
  DollarSign,
  Key,
  Wrench,
  Star,
  Quote
} from "lucide-react";

const FLAG_TYPES = {
  client_risk: { icon: AlertTriangle, color: "border-red-200 bg-red-50", iconColor: "text-red-600" },
  site_constraint: { icon: AlertCircle, color: "border-orange-200 bg-orange-50", iconColor: "text-orange-600" },
  payment_hold: { icon: DollarSign, color: "border-red-200 bg-red-50", iconColor: "text-red-600" },
  access_issue: { icon: Key, color: "border-amber-200 bg-amber-50", iconColor: "text-amber-600" },
  technical_risk: { icon: Wrench, color: "border-orange-200 bg-orange-50", iconColor: "text-orange-600" },
  logistics_dependency: { icon: Truck, color: "border-blue-200 bg-blue-50", iconColor: "text-blue-600" },
  vip_client: { icon: Star, color: "border-purple-200 bg-purple-50", iconColor: "text-purple-600" },
  internal_warning: { icon: Shield, color: "border-gray-200 bg-gray-50", iconColor: "text-gray-600" }
};

export default function AISuggestedFlag({ suggestion, onAccept, onDismiss, onEditAccept, allFlags, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const [editedSuggestion, setEditedSuggestion] = useState(suggestion);

  const flagType = FLAG_TYPES[suggestion.type] || FLAG_TYPES.internal_warning;
  const Icon = flagType.icon;
  const sourceRefs = Array.isArray(suggestion.source_refs) ? suggestion.source_refs : [];
  const visibleSources = showAllSources ? sourceRefs : sourceRefs.slice(0, 1);

  const handleAcceptClick = () => {
    if (isEditing) {
      onEditAccept(editedSuggestion);
    } else {
      onAccept(suggestion);
    }
  };

  const handleDismissConfirm = async () => {
    const dismissedFlag = {
      ...suggestion,
      dismissed_at: new Date().toISOString(),
      dismissed_by: "current_user"
    };
    
    const updatedFlags = allFlags.map(f => f.id === suggestion.id ? dismissedFlag : f);
    await onUpdate(updatedFlags);
    setIsDismissing(false);
  };

  return (
    <div className={`border ${flagType.color} rounded-lg p-3`}>
      {isDismissing ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-[#111827]">
            Dismiss this suggestion? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDismissing(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDismissConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Icon className={`w-5 h-5 ${flagType.iconColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0 space-y-2">
              {!isEditing ? (
                <>
                  <div className="font-semibold text-[#111827] text-sm leading-tight">
                    {suggestion.label}
                  </div>
                  {suggestion.details && (
                    <p className="text-sm text-[#4B5563] leading-snug">{suggestion.details}</p>
                  )}
                  
                  {/* Evidence Block */}
                  {sourceRefs.length > 0 && (
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
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1">Type</Label>
                    <Select
                      value={editedSuggestion.type}
                      onValueChange={(val) => setEditedSuggestion({ ...editedSuggestion, type: val })}
                    >
                      <SelectTrigger className="h-9 text-sm">
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
                    <Label className="text-xs mb-1">Label (max 48 chars)</Label>
                    <Input
                      value={editedSuggestion.label}
                      onChange={(e) => setEditedSuggestion({ ...editedSuggestion, label: e.target.value })}
                      className="h-9 text-sm"
                      maxLength={48}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Details (max 120 chars, optional)</Label>
                    <Textarea
                      value={editedSuggestion.details}
                      onChange={(e) => setEditedSuggestion({ ...editedSuggestion, details: e.target.value })}
                      className="text-sm min-h-[60px]"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Severity</Label>
                    <Select
                      value={editedSuggestion.severity}
                      onValueChange={(val) => setEditedSuggestion({ ...editedSuggestion, severity: val })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleAcceptClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-medium flex-1"
                >
                  <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="h-8 text-xs font-medium"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsDismissing(true)}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900"
                >
                  <ThumbsDown className="w-3.5 h-3.5 mr-1" />
                  Dismiss
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleAcceptClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs font-medium flex-1"
                >
                  Accept Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSuggestion(suggestion);
                  }}
                  className="h-8 text-xs font-medium"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}