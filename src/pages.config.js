import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import CheckIn from './pages/CheckIn';
import Team from './pages/Team';
import Schedule from './pages/Schedule';
import Customers from './pages/Customers';
import PriceList from './pages/PriceList';
import UserProfile from './pages/UserProfile';
import Archive from './pages/Archive';
import Organisations from './pages/Organisations';
import Projects from './pages/Projects';
import Photos from './pages/Photos';
import Reports from './pages/Reports';
import Inbox from './pages/Inbox';
import Tasks from './pages/Tasks';
import RoleSettings from './pages/RoleSettings';
import Notifications from './pages/Notifications';
import Logistics from './pages/Logistics';
import Contracts from './pages/Contracts';
import MyVehicle from './pages/MyVehicle';
import Fleet from './pages/Fleet';
import Analytics from './pages/Analytics';
import TechnicianPerformance from './pages/TechnicianPerformance';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Jobs": Jobs,
    "CheckIn": CheckIn,
    "Team": Team,
    "Schedule": Schedule,
    "Customers": Customers,
    "PriceList": PriceList,
    "UserProfile": UserProfile,
    "Archive": Archive,
    "Organisations": Organisations,
    "Projects": Projects,
    "Photos": Photos,
    "Reports": Reports,
    "Inbox": Inbox,
    "Tasks": Tasks,
    "RoleSettings": RoleSettings,
    "Notifications": Notifications,
    "Logistics": Logistics,
    "Contracts": Contracts,
    "MyVehicle": MyVehicle,
    "Fleet": Fleet,
    "Analytics": Analytics,
    "TechnicianPerformance": TechnicianPerformance,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};