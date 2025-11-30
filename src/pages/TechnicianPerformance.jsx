import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Users, Clock, RotateCcw, Filter, Map as MapIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function TechnicianPerformance() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTech, setSelectedTech] = useState("all");
  const [selectedJobType, setSelectedJobType] = useState("all");

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const { data: jobTypes = [] } = useQuery({
    queryKey: ['jobTypes'],
    queryFn: () => base44.entities.JobType.list()
  });

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['technicianStats', dateFrom, dateTo, selectedTech, selectedJobType],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTechnicianStats', {
        technician_email: selectedTech,
        date_from: dateFrom,
        date_to: dateTo,
        job_type: selectedJobType
      });
      return res.data;
    },
    keepPreviousData: true
  });

  useEffect(() => {
      refetch();
  }, [dateFrom, dateTo, selectedTech, selectedJobType, refetch]);

  if (isLoading && !stats) {
    return <div className="p-10 text-center text-gray-500">Loading performance data...</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="p-4 lg:p-10 max-w-7xl mx-auto bg-[#f8f9fa] min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#111827]">Technician Performance</h1>
        <p className="text-gray-500 mt-1">Analyze team efficiency and job outcomes</p>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Technician</label>
              <Select value={selectedTech} onValueChange={setSelectedTech}>
                <SelectTrigger>
                  <SelectValue placeholder="All Technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  {technicians.map(t => (
                    <SelectItem key={t.email} value={t.email}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Job Type</label>
              <Select value={selectedJobType} onValueChange={setSelectedJobType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Types</SelectItem>
                  {jobTypes.map(t => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">From Date</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">To Date</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Jobs Completed</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats?.total_jobs || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Return Visit Rate</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats?.return_visit_rate || 0}%</h3>
                <p className="text-xs text-gray-500 mt-1">{stats?.return_visit_count || 0} return visits</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <RotateCcw className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-6">
                <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm font-medium text-gray-500">Avg Job Duration</p>
                     {/* Just showing an average of averages for quick glance if array not empty */}
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                         {stats?.avg_duration_by_type?.length > 0 
                            ? Math.round(stats.avg_duration_by_type.reduce((a,b) => a + b.avg_minutes, 0) / stats.avg_duration_by_type.length)
                            : 0} min
                    </h3>
                </div>
                <div className="p-3 bg-purple-50 rounded-full">
                    <Clock className="w-6 h-6 text-purple-600" />
                </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Jobs by Technician Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs Completed by Technician</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.jobs_by_technician || []} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Jobs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Avg Duration Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Avg Duration by Job Type (Minutes)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.avg_duration_by_type || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg_minutes" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Minutes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap / Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="w-5 h-5" />
            Service Locations Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[400px] relative">
             {(stats?.locations?.length > 0) ? (
                 <MapContainer 
                    center={[stats.locations[0].lat, stats.locations[0].lng]} 
                    zoom={10} 
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                 >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {stats.locations.map((loc, idx) => (
                        <Marker key={idx} position={[loc.lat, loc.lng]}>
                            <Popup>Job #{loc.title}</Popup>
                        </Marker>
                    ))}
                 </MapContainer>
             ) : (
                 <div className="flex items-center justify-center h-full bg-slate-50 text-gray-500">
                     No location data available for current filters
                 </div>
             )}
        </CardContent>
      </Card>
    </div>
  );
}