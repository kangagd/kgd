import React, { useEffect, useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function JobMapView({ job }) {
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use address_full or fallback to address
  const address = job.address_full || job.address;
  const hasCoordinates = job.latitude && job.longitude;

  useEffect(() => {
    // Only fetch API key if we need to use the fallback Google Embed map
    if (!hasCoordinates && address) {
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
    } else {
      setLoading(false);
    }
  }, [hasCoordinates, address]);

  if (!address && !hasCoordinates) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No location data available</p>
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

  // Case 1: We have coordinates - use Leaflet (OpenStreetMap)
  // This avoids Google Maps API key issues for the visual map
  if (hasCoordinates) {
    const position = [job.latitude, job.longitude];
    return (
      <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 z-0 relative">
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>
              <div className="text-sm font-medium">
                {job.customer_name}
              </div>
              <div className="text-xs text-gray-600">
                {address}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    );
  }

  // Case 2: No coordinates, fallback to Google Maps Embed or Link
  if (!apiKey) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 p-6 text-center">
        <MapPin className="w-8 h-8 mb-3 text-gray-400" />
        <p className="text-sm mb-4">Map preview unavailable</p>
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Navigation className="w-4 h-4" />
          Open in Google Maps
        </a>
      </div>
    );
  }

  // Google Maps Embed API fallback
  const encodedAddress = encodeURIComponent(address);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}&zoom=15`;

  return (
    <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 relative bg-gray-100">
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
      {/* Overlay button in case embed fails */}
      <a 
        href={`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 bg-white shadow-md border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors z-10 flex items-center gap-1.5"
      >
        <Navigation className="w-3 h-3" />
        Open in Google Maps
      </a>
    </div>
  );
}