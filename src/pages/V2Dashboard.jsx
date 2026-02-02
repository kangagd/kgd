import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isPartsLogisticsV2PilotAllowed } from "@/components/utils/allowlist";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, Warehouse, AlertCircle } from "lucide-react";

export default function V2Dashboard() {
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

  const pilotCards = [
    {
      title: "Parts (V2)",
      description: "Manage project requirements, allocations, and usage",
      icon: Package,
      url: createPageUrl("V2Parts"),
      color: "text-blue-600"
    },
    {
      title: "Logistics (V2)",
      description: "Plan runs, manage stops, and track deliveries",
      icon: Truck,
      url: createPageUrl("V2Logistics"),
      color: "text-green-600"
    },
    {
      title: "Loading Bay (V2)",
      description: "View receipts, track SLA, and clear inventory",
      icon: Warehouse,
      url: createPageUrl("V2LoadingBay"),
      color: "text-purple-600"
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">V2 Pilot Dashboard</h1>
        <p className="text-gray-600">
          Pilot access restricted to <span className="font-medium">admin@kangaroogd.com.au</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pilotCards.map((card) => (
          <Link key={card.title} to={card.url} className="no-underline">
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <card.icon className={`w-8 h-8 ${card.color}`} />
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> This is a pilot environment. Features are under active development.
        </p>
      </div>
    </div>
  );
}