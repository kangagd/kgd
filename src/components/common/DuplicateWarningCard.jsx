import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Users, FolderKanban, Briefcase, Building2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const entityConfig = {
  Customer: {
    icon: Users,
    title: "Possible duplicate customers",
    urlParam: "customerId",
    page: "Customers",
    getDisplayFields: (match) => [
      { label: "Name", value: match.name },
      { label: "Email", value: match.email },
      { label: "Phone", value: match.phone },
      { label: "Address", value: match.address_full }
    ]
  },
  Project: {
    icon: FolderKanban,
    title: "Possible duplicate projects",
    urlParam: "projectId",
    page: "Projects",
    getDisplayFields: (match) => [
      { label: "Title", value: match.title },
      { label: "Customer", value: match.customer_name },
      { label: "Address", value: match.address_full },
      { label: "Status", value: match.status }
    ]
  },
  Job: {
    icon: Briefcase,
    title: "Possible duplicate jobs",
    urlParam: "jobId",
    page: "Jobs",
    getDisplayFields: (match) => [
      { label: "Job #", value: match.job_number },
      { label: "Date", value: match.scheduled_date },
      { label: "Customer", value: match.customer_name },
      { label: "Type", value: match.job_type_name },
      { label: "Address", value: match.address_full }
    ]
  },
  Organisation: {
    icon: Building2,
    title: "Possible duplicate organisations",
    urlParam: "organisationId",
    page: "Organisations",
    getDisplayFields: (match) => [
      { label: "Name", value: match.name },
      { label: "Type", value: match.organisation_type },
      { label: "Email", value: match.email },
      { label: "Phone", value: match.phone }
    ]
  }
};

export default function DuplicateWarningCard({ entityType, record, className = "" }) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const config = entityConfig[entityType];

  useEffect(() => {
    if (record?.is_potential_duplicate && record?.id) {
      loadMatches();
    }
  }, [record?.id, record?.is_potential_duplicate]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('checkDuplicates', {
        entity_type: entityType,
        record: record,
        exclude_id: record.id,
        auto_update: false
      });
      setMatches(response.data?.matches || []);
    } catch (error) {
      console.error('Error loading duplicate matches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!record?.is_potential_duplicate || !config) {
    return null;
  }

  const Icon = config.icon;

  const handleOpenRecord = (matchId) => {
    navigate(`${createPageUrl(config.page)}?${config.urlParam}=${matchId}`);
  };

  return (
    <Card className={`border-[#D97706]/30 bg-[#FFFBEB] shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#D97706]/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#D97706]" />
            </div>
            <div>
              <CardTitle className="text-[14px] font-semibold text-[#92400E]">
                {config.title}
              </CardTitle>
              <p className="text-[12px] text-[#B45309]">
                These records look similar. Review before creating a new one.
              </p>
            </div>
          </div>
          {record.duplicate_score > 0 && (
            <Badge className="bg-[#D97706] text-white border-0 text-[11px] font-semibold">
              Score: {record.duplicate_score}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="text-[13px] text-[#92400E]">Loading matches...</div>
        ) : matches.length === 0 ? (
          <div className="text-[13px] text-[#92400E]">No detailed match info available.</div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const displayFields = config.getDisplayFields(match);
              return (
                <div
                  key={match.id}
                  className="bg-white rounded-lg border border-[#D97706]/20 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      {displayFields.map((field, idx) => (
                        field.value && (
                          <div key={idx} className="flex items-center gap-2 text-[13px]">
                            <span className="text-[#6B7280] flex-shrink-0">{field.label}:</span>
                            <span className="text-[#111827] truncate">{field.value}</span>
                          </div>
                        )
                      ))}
                      {match.match_reasons && match.match_reasons.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[11px] text-[#92400E]">Matched on:</span>
                          {match.match_reasons.map((reason, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 border-[#D97706]/30 text-[#B45309]"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenRecord(match.id)}
                      className="flex-shrink-0 h-8 text-[12px] border-[#D97706]/30 text-[#92400E] hover:bg-[#FEF3C7] hover:border-[#D97706]"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Small inline badge for list views
export function DuplicateBadge({ record, size = "sm" }) {
  if (!record?.is_potential_duplicate) return null;

  return (
    <Badge 
      className={`bg-[#D97706]/10 text-[#D97706] border-0 font-medium ${
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-[11px] px-2 py-0.5"
      }`}
    >
      <AlertTriangle className={size === "sm" ? "w-2.5 h-2.5 mr-0.5" : "w-3 h-3 mr-1"} />
      Duplicate
    </Badge>
  );
}

// Small dot indicator for schedule views
export function DuplicateDot({ record, className = "" }) {
  if (!record?.is_potential_duplicate) return null;

  return (
    <div 
      className={`w-2 h-2 rounded-full bg-[#D97706] flex-shrink-0 ${className}`}
      title="Potential duplicate"
    />
  );
}