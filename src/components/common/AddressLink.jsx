import React from "react";
import { MapPin } from "lucide-react";

export default function AddressLink({ address, className = "", showIcon = true }) {
  if (!address) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(mapsUrl, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-left hover:text-[#FAE008] transition-colors ${className}`}
      title="Open in Google Maps"
    >
      {showIcon && <MapPin className="w-3 h-3 flex-shrink-0" />}
      <span>{address}</span>
    </button>
  );
}