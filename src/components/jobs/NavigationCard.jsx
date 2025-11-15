import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin, Clock, ArrowRight } from "lucide-react";

export default function NavigationCard({ currentJob, nextJob }) {
  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentJob.address)}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const openWaze = () => {
    const url = `https://waze.com/ul?q=${encodeURIComponent(currentJob.address)}&navigate=yes`;
    window.open(url, '_blank');
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Navigate to Job</h3>
        </div>

        <div className="flex items-start gap-2 mb-4 text-sm text-blue-800">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="font-medium">{currentJob.address}</span>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            onClick={openGoogleMaps}
            className="flex-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300"
          >
            Google Maps
          </Button>
          <Button
            onClick={openWaze}
            className="flex-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300"
          >
            Waze
          </Button>
        </div>

        {nextJob && (
          <div className="pt-3 border-t border-blue-200">
            <div className="flex items-center gap-2 text-xs text-blue-700 mb-2">
              <Clock className="w-3 h-3" />
              <span className="font-medium">Next Job Today</span>
            </div>
            <div className="bg-white rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-slate-900">{nextJob.customer_name}</span>
                {nextJob.scheduled_time && (
                  <span className="text-xs text-slate-500">@ {nextJob.scheduled_time}</span>
                )}
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{nextJob.address}</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-blue-600">
                <ArrowRight className="w-3 h-3" />
                <span>Plan your route accordingly</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}