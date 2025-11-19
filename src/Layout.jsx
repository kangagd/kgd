import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Briefcase, Users, LayoutDashboard, Wrench, UserCircle, DollarSign, Archive as ArchiveIcon, Building2, FolderKanban, TestTube2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";

const adminNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Schedule", url: createPageUrl("Calendar"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
  { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
  { title: "Team", url: createPageUrl("Team"), icon: Users },
  { title: "Archive", url: createPageUrl("Archive"), icon: ArchiveIcon },
];

const technicianNavigationItems = [
  { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [testMode, setTestMode] = React.useState(() => {
    return localStorage.getItem('testMode') || 'off';
  });

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  React.useEffect(() => {
    localStorage.setItem('testMode', testMode);
  }, [testMode]);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleTestModeToggle = () => {
    const modes = ['off', 'admin', 'technician'];
    const currentIndex = modes.indexOf(testMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setTestMode(nextMode);
  };

  const getTestModeLabel = () => {
    if (testMode === 'admin') return 'Admin';
    if (testMode === 'technician') return 'Tech';
    return 'Off';
  };

  const isTechnician = testMode === 'technician' 
    ? true 
    : testMode === 'admin' 
      ? false 
      : user?.is_field_technician && user?.role !== 'admin';
  const navigationItems = isTechnician ? technicianNavigationItems : adminNavigationItems;

  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
        <header className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#FAE008] rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-[#111827]" />
              </div>
              <div>
                <h1 className="font-bold text-[#111827] text-base">KGD</h1>
              </div>
            </div>
            <button
              onClick={() => navigate(createPageUrl("UserProfile"))}
              className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px]"
            >
              <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center">
                <span className="text-[#111827] font-semibold text-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-20">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-2 py-2 shadow-lg">
          <div className="flex justify-around items-center max-w-screen-sm mx-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[44px] justify-center ${
                    isActive
                      ? 'text-[#111827] bg-[#FAE008]'
                      : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{item.title}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <button
          onClick={handleTestModeToggle}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-[#D97706] hover:bg-[#B45309] text-white rounded-full shadow-lg flex items-center justify-center transition-all"
          title={`Test Mode: ${getTestModeLabel()}`}
        >
          <TestTube2 className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-[#92400E] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {getTestModeLabel().charAt(0)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#F8F9FA]">
        <Sidebar className="border-r border-[#E5E7EB]">
          <SidebarHeader className="border-b border-[#E5E7EB] p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#FAE008] rounded-xl flex items-center justify-center shadow-md">
                <Wrench className="w-5 h-5 text-[#111827]" />
              </div>
              <div>
                <h2 className="font-bold text-[#111827] text-base">FieldScheduler</h2>
                <p className="text-xs text-[#4B5563]">Garage Door Services</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-[#4B5563] uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-[#FAE008] hover:text-[#111827] transition-colors duration-150 rounded-lg mb-1 min-h-[44px] ${
                          location.pathname === item.url ? 'bg-[#FAE008] text-[#111827] font-semibold' : 'text-[#4B5563]'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-[#E5E7EB] p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(createPageUrl("UserProfile"))}
                className="flex items-center gap-3 flex-1 min-w-0 hover:bg-[#F3F4F6] rounded-lg p-2.5 transition-colors min-h-[44px]"
              >
                <div className="w-10 h-10 bg-[#F3F4F6] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#111827] font-semibold text-sm">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold text-[#111827] text-sm truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-[#4B5563] truncate">{user?.email}</p>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-[#4B5563] hover:text-[#111827] px-2 font-medium"
              >
                Logout
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 lg:hidden shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-[#F3F4F6] p-2 rounded-lg transition-colors duration-150 min-h-[44px] min-w-[44px]" />
              <h1 className="text-xl font-bold text-[#111827]">FieldScheduler</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>

        <button
          onClick={handleTestModeToggle}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#D97706] hover:bg-[#B45309] text-white rounded-full shadow-lg flex items-center justify-center transition-all"
          title={`Test Mode: ${getTestModeLabel()}`}
        >
          <TestTube2 className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-[#92400E] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {getTestModeLabel().charAt(0)}
          </span>
        </button>
      </div>
    </SidebarProvider>
  );
}