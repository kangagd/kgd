import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { isPartsLogisticsV2PilotAllowed } from "@/components/utils/allowlist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Truck } from "lucide-react";

export default function V2Logistics() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isPartsLogisticsV2PilotAllowed(user)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              Not Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">This feature is not available for your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-8 h-8 text-green-600" />
          <h1 className="text-3xl font-bold text-gray-900">Logistics (V2)</h1>
        </div>
        <p className="text-gray-600">Plan runs, manage stops, and track deliveries</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logistics Runs V2 - Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This page will manage:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
            <li>Logistics runs (assign tech + vehicle)</li>
            <li>Stops (purpose, location, photos, confirmations)</li>
            <li>PO pickups and deliveries</li>
            <li>Loading Bay → Storage → Vehicle movements</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}