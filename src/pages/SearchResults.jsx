import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Briefcase, 
  UserCircle, 
  FolderKanban, 
  Building2, 
  DollarSign,
  Filter,
  X
} from "lucide-react";

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    technician: "all",
    dateFrom: "",
    dateTo: ""
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ['globalSearch', searchTerm, filters],
    queryFn: async () => {
      const response = await base44.functions.invoke('globalSearch', {
        searchTerm,
        filters
      });
      return response.data;
    },
    enabled: searchTerm.length > 0
  });

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSearchParams({ q: searchTerm });
      refetch();
    }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      technician: "all",
      dateFrom: "",
      dateTo: ""
    });
  };

  const activeFiltersCount = 
    (filters.status !== "all" ? 1 : 0) +
    (filters.technician !== "all" ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const totalResults = results ? 
    results.jobs.length + 
    results.customers.length + 
    results.projects.length + 
    results.organisations.length +
    results.priceListItems.length : 0;

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Search</h1>
          <p className="text-sm text-[#4B5563]">Search across jobs, customers, projects, and more</p>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <Input
                placeholder="Search by job #, customer name, address, etc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
              />
            </div>
            <Button
              type="submit"
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold h-12 px-6"
            >
              Search
            </Button>
          </div>
        </form>

        {searchTerm && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[#4B5563]">
                {isLoading ? "Searching..." : `${totalResults} results found`}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={`border border-[#E5E7EB] hover:bg-[#F3F4F6] font-semibold transition-all ${
                  activeFiltersCount > 0 ? "border-[#FAE008] bg-[#FAE008]/10" : ""
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 bg-[#FAE008] text-[#111827] px-2 py-0.5 text-xs font-bold">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {showFilters && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Status
                      </label>
                      <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Scheduled">Scheduled</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Lead">Lead</SelectItem>
                          <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Technician
                      </label>
                      <Select value={filters.technician} onValueChange={(value) => updateFilter('technician', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Technicians</SelectItem>
                          {technicians.map(tech => (
                            <SelectItem key={tech.email} value={tech.email}>
                              {tech.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Date From
                      </label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => updateFilter('dateFrom', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Date To
                      </label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => updateFilter('dateTo', e.target.value)}
                      />
                    </div>
                  </div>

                  {activeFiltersCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-3"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-[#E5E7EB] rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-[#E5E7EB] rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results && totalResults > 0 ? (
              <div className="space-y-6">
                {results.jobs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="w-5 h-5 text-[#4B5563]" />
                      <h2 className="text-lg font-semibold text-[#111827]">
                        Jobs ({results.jobs.length})
                      </h2>
                    </div>
                    <div className="grid gap-3">
                      {results.jobs.map(job => (
                        <Card
                          key={job.id}
                          className="cursor-pointer hover:border-[#FAE008] transition-all"
                          onClick={() => navigate(`${createPageUrl("Jobs")}?jobId=${job.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-[#111827]">
                                    #{job.job_number}
                                  </span>
                                  <Badge variant={
                                    job.status === 'Completed' ? 'success' :
                                    job.status === 'Scheduled' ? 'primary' :
                                    'default'
                                  }>
                                    {job.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-[#111827] font-medium">{job.customer_name}</p>
                                <p className="text-sm text-[#6B7280]">{job.address_full || job.address}</p>
                                {job.scheduled_date && (
                                  <p className="text-xs text-[#6B7280] mt-1">
                                    {new Date(job.scheduled_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {results.projects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FolderKanban className="w-5 h-5 text-[#4B5563]" />
                      <h2 className="text-lg font-semibold text-[#111827]">
                        Projects ({results.projects.length})
                      </h2>
                    </div>
                    <div className="grid gap-3">
                      {results.projects.map(project => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:border-[#FAE008] transition-all"
                          onClick={() => navigate(`${createPageUrl("Projects")}?projectId=${project.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-[#111827]">
                                    {project.title}
                                  </span>
                                  <Badge>{project.status}</Badge>
                                </div>
                                <p className="text-sm text-[#111827]">{project.customer_name}</p>
                                <p className="text-sm text-[#6B7280]">{project.address_full || project.address}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {results.customers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <UserCircle className="w-5 h-5 text-[#4B5563]" />
                      <h2 className="text-lg font-semibold text-[#111827]">
                        Customers ({results.customers.length})
                      </h2>
                    </div>
                    <div className="grid gap-3">
                      {results.customers.map(customer => (
                        <Card
                          key={customer.id}
                          className="cursor-pointer hover:border-[#FAE008] transition-all"
                          onClick={() => navigate(`${createPageUrl("Customers")}?customerId=${customer.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-[#111827] mb-1">{customer.name}</p>
                                <p className="text-sm text-[#6B7280]">{customer.email || customer.phone}</p>
                                {customer.address_full && (
                                  <p className="text-sm text-[#6B7280]">{customer.address_full}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {results.organisations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-5 h-5 text-[#4B5563]" />
                      <h2 className="text-lg font-semibold text-[#111827]">
                        Organisations ({results.organisations.length})
                      </h2>
                    </div>
                    <div className="grid gap-3">
                      {results.organisations.map(org => (
                        <Card
                          key={org.id}
                          className="cursor-pointer hover:border-[#FAE008] transition-all"
                          onClick={() => navigate(`${createPageUrl("Organisations")}?organisationId=${org.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-[#111827] mb-1">{org.name}</p>
                                <Badge variant="outline">{org.organisation_type}</Badge>
                                {org.sp_number && (
                                  <p className="text-sm text-[#6B7280] mt-1">SP: {org.sp_number}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {results.priceListItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-5 h-5 text-[#4B5563]" />
                      <h2 className="text-lg font-semibold text-[#111827]">
                        Price List Items ({results.priceListItems.length})
                      </h2>
                    </div>
                    <div className="grid gap-3">
                      {results.priceListItems.map(item => (
                        <Card key={item.id} className="hover:border-[#FAE008] transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-[#111827] mb-1">{item.item}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{item.category}</Badge>
                                  <span className="text-sm font-semibold text-[#111827]">
                                    ${item.price?.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Search className="w-16 h-16 mx-auto text-[#E5E7EB] mb-4" />
                <h3 className="text-lg font-semibold text-[#111827] mb-2">No results found</h3>
                <p className="text-[#6B7280]">Try adjusting your search term or filters</p>
              </Card>
            )}
          </>
        )}

        {!searchTerm && (
          <Card className="p-12 text-center">
            <Search className="w-16 h-16 mx-auto text-[#E5E7EB] mb-4" />
            <h3 className="text-lg font-semibold text-[#111827] mb-2">Start searching</h3>
            <p className="text-[#6B7280]">Enter a search term to find jobs, customers, projects, and more</p>
          </Card>
        )}
      </div>
    </div>
  );
}