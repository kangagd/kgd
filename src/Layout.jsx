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
  Image as ImageIcon,
  TrendingUp,
  Mail,
  ChevronDown
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

const primaryNavigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { title: "Inbox", url: createPageUrl("Inbox"), icon: Mail },
  { title: "Schedule", url: createPageUrl("Calendar"), icon: Calendar },
  { title: "Projects", url: createPageUrl("Projects"), icon: FolderKanban },
  { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
  { title: "Customers", url: createPageUrl("Customers"), icon: UserCircle },
];

const secondaryNavigationItems = [
  { title: "Organisations", url: createPageUrl("Organisations"), icon: Building2 },
  { title: "Photos", url: createPageUrl("Photos"), icon: ImageIcon },
  { title: "Price List", url: createPageUrl("PriceList"), icon: DollarSign },
  { title: "Reports", url: createPageUrl("Reports"), icon: TrendingUp },
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
  const [isCollapsed, setIsCollapsed] = useState(() => 
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [testMode, setTestMode] = useState(() => 
    localStorage.getItem('testMode') || 'off'
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(() => 
    localStorage.getItem('moreMenuOpen') === 'true'
  );
  const [techMobileMenuOpen, setTechMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await base44.auth.me());
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  // Admin check-in/out notifications
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
              toast.success(`${checkInOut.technician_name} checked out`, {
                description: `Job #${checkInOut.job_id}${checkInOut.check_out_notes ? ` • ${checkInOut.check_out_notes}` : ''}`,
                duration: 5000,
              });
            } else if (checkInOut.check_in_time) {
              toast.info(`${checkInOut.technician_name} checked in`, {
                description: `Job #${checkInOut.job_id}`,
                duration: 4000,
              });
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

  // Persist state
  useEffect(() => { localStorage.setItem('testMode', testMode); }, [testMode]);
  useEffect(() => { localStorage.setItem('sidebarCollapsed', isCollapsed); }, [isCollapsed]);
  useEffect(() => { localStorage.setItem('moreMenuOpen', isMoreMenuOpen); }, [isMoreMenuOpen]);

  // Close mobile menu on route change or ESC key
  useEffect(() => { setIsMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    const handleEscape = (e) => e.key === 'Escape' && isMobileMenuOpen && setIsMobileMenuOpen(false);
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const handleLogout = () => base44.auth.logout();

  const handleTestModeToggle = () => {
    const modes = ['off', 'admin', 'technician'];
    setTestMode(modes[(modes.indexOf(testMode) + 1) % modes.length]);
  };

  const getTestModeLabel = () => 
    testMode === 'admin' ? 'Admin' : testMode === 'technician' ? 'Tech' : 'Off';

  const isTechnician = testMode === 'technician' 
    ? true 
    : testMode === 'admin' 
      ? false 
      : user?.is_field_technician && user?.role !== 'admin';
  
  const navigationItems = isTechnician ? technicianNavigationItems : primaryNavigationItems;

  // Mobile layout for technicians
  if (isTechnician) {
    return (
      <div className="min-h-screen flex flex-col bg-[#ffffff]">
        {/* Mobile Overlay */}
        {techMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setTechMobileMenuOpen(false)}
          />
        )}

        <header className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-50 shadow-sm safe-area-top">
          <div className="flex items-center justify-between min-h-[44px]">
            <button
              onClick={() => setTechMobileMenuOpen(!techMobileMenuOpen)}
              className="flex items-center gap-2 hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px] min-w-[44px]"
            >
              <div className="w-8 h-8 bg-[#FAE008] rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-[#111827]" />
              </div>
              <h3 className="font-semibold text-[#111827] text-[14px]">KGD</h3>
            </button>
            <button
              onClick={() => navigate(createPageUrl("UserProfile"))}
              className="flex items-center hover:bg-[#F3F4F6] rounded-lg p-2 transition-colors min-h-[44px] min-w-[44px] justify-center"
            >
              <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center">
                <span className="text-[#111827] font-semibold text-sm">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* Dropdown Menu */}
        <div 
          className={`fixed top-[60px] left-0 right-0 bg-white border-b border-[#E5E7EB] shadow-lg z-40 transition-all duration-300 ${
            techMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <nav className="p-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  onClick={() => setTechMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#FAE008] text-[#111827]'
                      : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[14px] font-medium">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 bg-[#ffffff]">
          {children}
        </main>

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
    <div className="min-h-screen flex bg-[#ffffff]">
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
          {/* Close button (mobile only) */}
          <div className="lg:hidden p-3 border-b border-[#E5E7EB] flex items-center justify-end">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-[#111827]" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {/* Primary Navigation */}
              {primaryNavigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative
                      ${isActive 
                        ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                        : 'text-[#111827] hover:bg-[#F3F4F6]'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? item.title : ''}
                  >
                    {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                    {!isCollapsed && <span className="text-[14px]">{item.title}</span>}
                  </Link>
                );
              })}

              {/* More Menu */}
              {!isCollapsed && (
                <div className="mt-2">
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#111827] hover:bg-[#F3F4F6] transition-all"
                  >
                    <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
                    <span className="text-[14px] font-medium">More</span>
                  </button>

                  {isMoreMenuOpen && (
                    <div className="mt-1 space-y-1 pl-3">
                      {secondaryNavigationItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <Link
                            key={item.title}
                            to={item.url}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative
                              ${isActive 
                                ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                                : 'text-[#111827] hover:bg-[#F3F4F6]'
                              }
                            `}
                          >
                            {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                            <span className="text-[14px]">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed Secondary Items */}
              {isCollapsed && secondaryNavigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all justify-center relative
                      ${isActive 
                        ? 'bg-[#FAE008]/10 text-[#111827] font-semibold' 
                        : 'text-[#111827] hover:bg-[#F3F4F6]'
                      }
                    `}
                    title={item.title}
                  >
                    {isActive && <div className="absolute left-0 w-1 h-6 bg-[#FAE008] rounded-r" />}
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#FAE008]' : 'text-[#111827]'}`} />
                  </Link>
                );
              })}
            </div>
          </nav>

{/* User Profile & Logout */}
<div className="p-3 border-t border-[#E5E7EB]">
  <button
    onClick={() => navigate(createPageUrl("UserProfile"))}
    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F4F6] rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
  >
    <div className="w-8 h-8 bg-[#F3F4F6] rounded-full flex items-center justify-center flex-shrink-0">
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
      className="w-full mt-2 flex items-center gap-2 px-3 py-2.5 text-[#4B5563] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors text-[14px]"
    >
      <LogOut className="w-4 h-4" />
      Logout
    </button>
  )}
</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#ffffff]">
        {/* Mobile Top Bar */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-30 safe-area-top">
          <div className="flex items-center justify-between min-h-[44px]">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Open navigation"
            >
              <Menu className="w-6 h-6 text-[#111827]" />
            </button>
            <h1 className="font-semibold text-[#111827] text-[14px] truncate px-2 flex-1 text-center">
              {[...primaryNavigationItems, ...secondaryNavigationItems].find(item => item.url === location.pathname)?.title || 'FieldScheduler'}
            </h1>
            <div className="w-[44px]" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#ffffff]">
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