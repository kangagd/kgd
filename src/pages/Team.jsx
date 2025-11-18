
import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, User, Phone, Mail, Shield } from "lucide-react";

export default function Team() {
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const technicians = allUsers.filter(user => user.is_field_technician && user.role !== 'admin');
  const admins = allUsers.filter(user => user.role === 'admin');

  return (
    <div className="p-4 md:p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Team</h1>
          <p className="text-[hsl(25,8%,45%)] mt-2">View team members</p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse border-2 border-[hsl(32,15%,88%)] rounded-2xl">
                <CardContent className="p-4 md:p-6">
                  <div className="h-6 bg-[hsl(32,15%,88%)] rounded w-1/4 mb-4"></div>
                  <div className="h-4 bg-[hsl(32,15%,88%)] rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-[#fae008]" />
                  <h2 className="text-xl font-bold text-[hsl(25,10%,12%)]">Field Technicians</h2>
                  <Badge className="bg-[#FEF8C8] text-slate-700 border-slate-200 font-semibold border-2">
                    {technicians.length}
                  </Badge>
                </div>

                {technicians.length === 0 ? (
                  <p className="text-[hsl(25,8%,45%)] text-center py-8">No field technicians</p>
                ) : (
                  <div className="grid gap-3">
                    {technicians.map((tech) => (
                      <Card key={tech.id} className="border-2 border-[hsl(32,15%,88%)] rounded-xl">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-bold text-[hsl(25,10%,12%)]">{tech.full_name}</h3>
                                <Badge variant="outline" className="text-xs">Technician</Badge>
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2 text-[hsl(25,8%,45%)]">
                                  <Mail className="w-4 h-4" />
                                  <span>{tech.email}</span>
                                </div>
                                {tech.phone && (
                                  <div className="flex items-center gap-2 text-[hsl(25,8%,45%)]">
                                    <Phone className="w-4 h-4" />
                                    <span>{tech.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-[#fae008]" />
                  <h2 className="text-xl font-bold text-[hsl(25,10%,12%)]">Administrators</h2>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2">
                    {admins.length}
                  </Badge>
                </div>

                {admins.length === 0 ? (
                  <p className="text-[hsl(25,8%,45%)] text-center py-8">No administrators</p>
                ) : (
                  <div className="grid gap-3">
                    {admins.map((admin) => (
                      <Card key={admin.id} className="border-2 border-[hsl(32,15%,88%)] rounded-xl">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-bold text-[hsl(25,10%,12%)]">{admin.full_name}</h3>
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold border-2">
                                  Admin
                                </Badge>
                                {admin.is_field_technician && (
                                  <Badge variant="outline" className="text-xs">Technician</Badge>
                                )}
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2 text-[hsl(25,8%,45%)]">
                                  <Mail className="w-4 h-4" />
                                  <span>{admin.email}</span>
                                </div>
                                {admin.phone && (
                                  <div className="flex items-center gap-2 text-[hsl(25,8%,45%)]">
                                    <Phone className="w-4 h-4" />
                                    <span>{admin.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-[hsl(32,15%,88%)] rounded-2xl bg-blue-50">
              <CardContent className="p-4">
                <p className="text-sm text-[hsl(25,8%,45%)]">
                  <strong>Note:</strong> Team members can be managed in the dashboard settings under User Management.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
