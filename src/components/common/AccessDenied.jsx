import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function AccessDenied({ message = "You don't have permission to access this page." }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#ffffff] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-[#111827] mb-2">Access Denied</h1>
        <p className="text-[#6B7280] mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}