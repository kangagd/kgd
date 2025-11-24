import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Send, Eye, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const eventIcons = {
  created: Clock,
  updated: Clock,
  sent: Send,
  viewed: Eye,
  accepted: CheckCircle,
  declined: XCircle,
  expired: AlertCircle,
  reminder_sent: Send
};

const eventColors = {
  created: "text-[#6B7280]",
  updated: "text-blue-600",
  sent: "text-[#FAE008]",
  viewed: "text-purple-600",
  accepted: "text-green-600",
  declined: "text-red-600",
  expired: "text-orange-600",
  reminder_sent: "text-blue-600"
};

export default function QuoteTimeline({ events }) {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.occurred_at) - new Date(a.occurred_at)
  );

  return (
    <div className="space-y-4">
      {sortedEvents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-[#E5E7EB]">
          <p className="text-[#6B7280]">No activity yet</p>
        </div>
      ) : (
        sortedEvents.map((event) => {
          const Icon = eventIcons[event.event_type] || Clock;
          const color = eventColors[event.event_type] || "text-[#6B7280]";

          return (
            <Card key={event.id} className="bg-white border border-[#E5E7EB]">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-[#111827] capitalize">
                        {event.event_type.replace('_', ' ')}
                      </h4>
                      <span className="text-sm text-[#6B7280]">
                        {format(parseISO(event.occurred_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {event.user_name && (
                      <p className="text-sm text-[#6B7280]">
                        by {event.user_name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}