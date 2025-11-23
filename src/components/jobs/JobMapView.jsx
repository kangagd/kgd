import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function JobMapView({ job }) {
  if (!job.latitude || !job.longitude) {
    return (
      <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        <p className="text-sm">No location data available</p>
      </div>
    );
  }

  const position = [job.latitude, job.longitude];

  return (
    <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer
        center={position}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{job.customer_name}</p>
              <p className="text-gray-600">{job.address}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}