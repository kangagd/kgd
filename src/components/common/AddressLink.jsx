import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AddressLink({ address, className = "" }) {
  if (!address) return null;

  const handleNavigate = () => {
    // Google Maps URL with directions from current location to the address
    // Using 'dir' with current location and destination
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <button
      onClick={handleNavigate}
      className={`inline-flex items-center gap-1.5 text-[13px] text-[#2563EB] hover:text-[#1E40AF] hover:underline transition-colors ${className}`}
    >
      <Navigation className="w-3.5 h-3.5" />
      {address}
    </button>
  );
}