import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Sparkles, 
  Check, 
  X, 
  Edit, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  MapPin,
  DollarSign,
  Key,
  Wrench,
  Truck,
  Star,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

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

/**
 * AISuggestedFlag Component
 * Displays AI-suggested flags with Accept/Dismiss actions
 * Allows editing before acceptance
 */
export default function AISuggestedFlag({ flag, onAccept, onDismiss }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  
  const [editedData, setEditedData] = useState({
    type: flag.type,
    label: flag.label,
    details: flag.details || '',
    severity: flag.severity,
    pinned: false
  });

  const typeConfig = FLAG_TYPES[flag.type] || FLAG_TYPES.internal_warning;
  const Icon = typeConfig.icon;
  const confidencePercent = Math.round((flag.confidence || 0) * 100);

  const handleAccept = () => {
    if (isEditing) {
      onAccept(editedData);
    } else {
      onAccept({
        type: flag.type,
        label: flag.label,
        details: flag.details,
        severity: flag.severity,
        pinned: false
      });
    }
  };

  const handleDismiss = () => {
    if (!dismissReason.trim()) return;
    onDismiss(dismissReason);
    setIsDismissing(false);
    setDismissReason("");
  };

  return (
    <div className="border-l-4 border-l-purple-400 bg-purple-50 rounded-r-lg p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", typeConfig.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Sparkles className="w-3 h-3 text-purple-600" />
              {!isEditing ? (
                <>
                  <span className="font-medium text-sm text-gray-900">{flag.label}</span>
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {flag.severity}
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                    {confidencePercent}% confidence
                  </Badge>
                </>
              ) : (
                <span className="text-xs text-purple-700 font-medium">Editing suggestion</span>
              )}
            </div>

            {!isEditing && flag.details && (
              <p className="text-xs text-gray-700 mb-2">{flag.details}</p>
            )}

            {isEditing && (
              <div className="space-y-2 mt-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={editedData.type}
                    onValueChange={(value) => setEditedData({ ...editedData, type: value })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FLAG_TYPES).map(([value, config]) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={editedData.label}
                    onChange={(e) => setEditedData({ ...editedData, label: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Details</Label>
                  <Textarea
                    value={editedData.details}
                    onChange={(e) => setEditedData({ ...editedData, details: e.target.value })}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Severity</Label>
                  <Select
                    value={editedData.severity}
                    onValueChange={(value) => setEditedData({ ...editedData, severity: value })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info" className="text-xs">Info</SelectItem>
                      <SelectItem value="warning" className="text-xs">Warning</SelectItem>
                      <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`pinned-${flag.id}`}
                    checked={editedData.pinned}
                    onChange={(e) => setEditedData({ ...editedData, pinned: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor={`pinned-${flag.id}`} className="text-xs cursor-pointer">
                    Pin this flag
                  </Label>
                </div>
              </div>
            )}

            {isDismissing && (
              <div className="space-y-2 mt-2">
                <Label className="text-xs">Why dismiss this suggestion?</Label>
                <Textarea
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="Help improve AI suggestions..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            )}

            {/* Source References */}
            {!isEditing && flag.source_refs && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-800 mt-2"
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide source
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show source
                  </>
                )}
              </button>
            )}

            {showDetails && flag.source_refs && (
              <div className="mt-2 p-2 bg-white/50 rounded text-xs text-gray-600">
                {flag.source_refs.email_thread_id && (
                  <div>📧 From email thread</div>
                )}
                {flag.source_refs.note_excerpt && (
                  <div className="italic mt-1">"{flag.source_refs.note_excerpt}"</div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
              <Sparkles className="w-3 h-3" />
              <span>Suggested by AI</span>
              <span>•</span>
              <span>Review before applying</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {!isEditing && !isDismissing && (
          <>
            <Button
              size="sm"
              onClick={handleAccept}
              className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            >
              <Check className="w-3 h-3 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="h-7 text-xs"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit & Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissing(true)}
              className="h-7 text-xs text-gray-600"
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </>
        )}

        {isEditing && (
          <>
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={!editedData.label.trim()}
              className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            >
              Accept Changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </>
        )}

        {isDismissing && (
          <>
            <Button
              size="sm"
              onClick={handleDismiss}
              disabled={!dismissReason.trim()}
              className="h-7 text-xs"
            >
              Confirm Dismiss
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsDismissing(false);
                setDismissReason("");
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}