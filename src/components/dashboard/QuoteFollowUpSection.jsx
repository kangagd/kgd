import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, TrendingDown, Mail, Phone } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import LogManualActivityModal from '@/components/projects/LogManualActivityModal';
import UnifiedEmailComposer from '@/components/inbox/UnifiedEmailComposer';

export default function QuoteFollowUpSection() {
  const navigate = useNavigate();
  const [selectedProjectForEmail, setSelectedProjectForEmail] = useState(null);
  const [selectedProjectForActivity, setSelectedProjectForActivity] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['quoteFollowUpData'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getQuoteFollowUpData', {});
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <Card className="bg-white border-[#E5E7EB]">
        <CardHeader>
          <CardTitle>Quote Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#6B7280]">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border-[#E5E7EB]">
        <CardHeader>
          <CardTitle>Quote Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#DC2626]">Error loading quote data</p>
        </CardContent>
      </Card>
    );
  }

  const { hot = [], warm = [], cold = [] } = data || {};
  const totalCount = hot.length + warm.length + cold.length;

  if (totalCount === 0) {
    return (
      <Card className="bg-white border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[16px]">Quote Follow-ups</CardTitle>
          <CardDescription>No quotes requiring follow-up</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const QuoteCard = ({ quote, category }) => {
    const bgColor = category === 'hot' ? 'bg-red-50' : category === 'warm' ? 'bg-amber-50' : 'bg-gray-50';
    const borderColor = category === 'hot' ? 'border-red-200' : category === 'warm' ? 'border-amber-200' : 'border-gray-200';
    const badgeColor = category === 'hot' ? 'bg-red-100 text-red-700' : category === 'warm' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700';
    const iconColor = category === 'hot' ? 'text-red-500' : category === 'warm' ? 'text-amber-500' : 'text-gray-500';

    return (
      <div className={`${bgColor} border ${borderColor} rounded-lg p-3 mb-2`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#111827] text-[13px] truncate">
              #{quote.project_number} — {quote.project_title}
            </p>
            <p className="text-[#6B7280] text-[12px]">{quote.customer_name}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {category === 'hot' && quote.hours_since_sent !== undefined && (
                <span className={`text-[11px] ${badgeColor} px-2 py-1 rounded`}>Sent {quote.hours_since_sent}h ago</span>
              )}
              {category === 'warm' && quote.hours_since_sent !== undefined && (
                <span className={`text-[11px] ${badgeColor} px-2 py-1 rounded`}>Sent {quote.hours_since_sent}h ago</span>
              )}
              {category === 'cold' && quote.days_until_expiry !== undefined && (
                <span className={`text-[11px] ${badgeColor} px-2 py-1 rounded`}>Expires in {quote.days_until_expiry}d</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedProjectForEmail(quote.project_id)}
            className="text-[11px] h-7 px-2 text-[#2563EB] hover:bg-blue-100 flex-1"
          >
            <Mail className="w-3 h-3 mr-1" />
            Email
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedProjectForActivity(quote.project_id)}
            className="text-[11px] h-7 px-2 text-[#2563EB] hover:bg-blue-100 flex-1"
          >
            <Phone className="w-3 h-3 mr-1" />
            Log Call
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(createPageUrl('Projects') + `?projectId=${quote.project_id}`)}
            className="text-[11px] h-7 px-2 text-[#6B7280] hover:bg-gray-200 flex-1"
          >
            View
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-white border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[16px]">Quote Follow-ups</CardTitle>
          <CardDescription>{totalCount} quote{totalCount !== 1 ? 's' : ''} need attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* HOT */}
            {hot.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-[#111827] text-[13px]">Hot ({hot.length})</h3>
                </div>
                <div className="space-y-0">
                  {hot.map(quote => (
                    <QuoteCard key={quote.id} quote={quote} category="hot" />
                  ))}
                </div>
              </div>
            )}

            {/* WARM */}
            {warm.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-[#111827] text-[13px]">Warm ({warm.length})</h3>
                </div>
                <div className="space-y-0">
                  {warm.map(quote => (
                    <QuoteCard key={quote.id} quote={quote} category="warm" />
                  ))}
                </div>
              </div>
            )}

            {/* COLD */}
            {cold.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-[#111827] text-[13px]">Cold ({cold.length})</h3>
                </div>
                <div className="space-y-0">
                  {cold.map(quote => (
                    <QuoteCard key={quote.id} quote={quote} category="cold" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Composer Modal */}
      {selectedProjectForEmail && (
        <UnifiedEmailComposer
          open={!!selectedProjectForEmail}
          onOpenChange={(open) => {
            if (!open) setSelectedProjectForEmail(null);
          }}
          defaultProject={selectedProjectForEmail}
        />
      )}

      {/* Log Call Modal */}
      {selectedProjectForActivity && (
        <LogManualActivityModal
          projectId={selectedProjectForActivity}
          open={!!selectedProjectForActivity}
          onOpenChange={(open) => {
            if (!open) setSelectedProjectForActivity(null);
          }}
          onSuccess={() => setSelectedProjectForActivity(null)}
        />
      )}
    </>
  );
}