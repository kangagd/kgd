import React, { useEffect, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function JobMapView({ job }) {
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await base44.functions.invoke('getGoogleMapsKey', {});
        setApiKey(response.data?.apiKey);
      } catch (error) {
        console.error('Failed to fetch Google Maps API key:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApiKey();
  }, []);

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

  if (loading) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Map unavailable</p>
        </div>
      </div>
    );
  }

  // Use Google Maps Embed API with the address
  const encodedAddress = encodeURIComponent(address);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15`;

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