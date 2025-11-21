import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Calendar, 
  Briefcase, 
  Users, 
  LayoutDashboard, 
  Wrench, 
  UserCircle, 
  DollarSign, 
  Archive as ArchiveIcon, 
  Building2, 
  FolderKanban,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  TestTube2,
  LogOut,
  Image as ImageIcon
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

const adminNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Schedule", url: createPageUrl("Calendar"), icon: Calendar },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
  { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
  { title: "Photos", url: createPageUrl("Photos"), icon: ImageIcon },
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
  const [user, setUser] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === null ? true : stored === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [testMode, setTestMode] = useState(() => {
    return localStorage.getItem('testMode') || 'off';
  });

  useEffect(() => {
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

  // Track check-ins/outs for admin notifications
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const shownNotifications = new Set();
    
    const pollCheckInOuts = async () => {
      try {
        const recentCheckInOuts = await base44.entities.CheckInOut.list('-updated_date', 10);
        const now = Date.now();
        
        recentCheckInOuts.forEach((checkInOut) => {
          const lastUpdate = new Date(checkInOut.updated_date).getTime();
          const isRecent = (now - lastUpdate) < 60000;
          
          if (isRecent && !shownNotifications.has(checkInOut.id)) {
            shownNotifications.add(checkInOut.id);
            
            if (checkInOut.check_out_time) {
              toast.success(
                `${checkInOut.technician_name} checked out`,
                {
                  description: `Job #${checkInOut.job_id}${checkInOut.check_out_notes ? ` • ${checkInOut.check_out_notes}` : ''}`,
                  duration: 5000,
                }
              );
            } else if (checkInOut.check_in_time) {
              toast.info(
                `${checkInOut.technician_name} checked in`,
                {
                  description: `Job #${checkInOut.job_id}`,
                  duration: 4000,
                }
              );
            }
          }
        });
      } catch (error) {
        console.error('Error polling check-ins/outs:', error);
      }
    };

    pollCheckInOuts();
    const interval = setInterval(pollCheckInOuts, 15000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('testMode', testMode);
  }, [testMode]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }, [isCollapsed]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

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

  // Mobile layout for technicians
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
                <h3 className="font-semibold text-[#111827]">KGD</h3>
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
                  <span className="text-[12px] font-medium leading-[1.35]">{item.title}</span>
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

  // Desktop/Admin layout
  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Toaster position="top-right" richColors />
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          hidden lg:flex fixed top-4 z-50 w-8 h-8
          items-center justify-center
          bg-white border border-[#E5E7EB] rounded-lg shadow-md
          hover:bg-[#F3F4F6] hover:border-[#FAE008]
          transition-all duration-300
          ${isCollapsed ? 'left-[84px]' : 'left-[272px]'}
        `}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-[#4B5563]" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-[#4B5563]" />
        )}
      </button>

      {/* Sidebar / Mobile Drawer */}
      <aside 
        className={`
          fixed lg:sticky top-0 h-screen bg-white border-r border-[#E5E7EB] z-50
          transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
          w-[260px]
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FAE008] rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <Wrench className="w-5 h-5 text-[#111827]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#111827] text-sm">FieldScheduler</h3>
                  <p className="text-[11px] text-[#4B5563]">Garage Door Services</p>
                </div>
              </div>
            )}
            {isCollapsed && (
              <div className="w-10 h-10 bg-[#FAE008] rounded-xl flex items-center justify-center shadow-md mx-auto">
                <Wrench className="w-5 h-5 text-[#111827]" />
              </div>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-[#111827]" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                      ${isActive 
                        ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                        : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                      group relative
                    `}
                    title={isCollapsed ? item.title : ''}
                  >
                    {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : ''}`} />
                    {!isCollapsed && (
                      <span className="text-[14px]">{item.title}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>



          {/* User Profile */}
          <div className="p-3 border-t border-[#E5E7EB]">
            <button
              onClick={() => navigate(createPageUrl("UserProfile"))}
              className={`w-full flex items-center gap-3 p-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
            >
              <div className="w-10 h-10 bg-[#F3F4F6] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#111827] font-semibold text-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-[#111827] text-[14px] truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-[12px] text-[#4B5563] truncate">{user?.email}</p>
                </div>
              )}
            </button>
            {!isCollapsed && (
              <button
                onClick={handleLogout}
                className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-[#4B5563] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors text-[14px]"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-6 h-6 text-[#111827]" />
            </button>
            <h1 className="font-semibold text-[#111827]">
              {navigationItems.find(item => item.url === location.pathname)?.title || 'FieldScheduler'}
            </h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Test Mode Toggle */}
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
  );
}