import React from "react";
import { MapPin } from "lucide-react";

export default function JobMapView({ job }) {
  // Use address_full or fallback to address
  const address = job.address_full || job.address;
  
  if (!address) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No address available</p>
        </div>
      </div>
    );
  }

  // Use Google Maps Embed API with the address
  const encodedAddress = encodeURIComponent(address);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8'}&q=${encodedAddress}&zoom=15`;

  return (
    <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200">
      <iframe
        title="Job Location Map"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
      />
    </div>
  );
}