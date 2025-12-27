import Archive from './pages/Archive';
import CheckIn from './pages/CheckIn';
import Contracts from './pages/Contracts';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import EmailSettings from './pages/EmailSettings';
import Fleet from './pages/Fleet';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Jobs from './pages/Jobs';
import Logistics from './pages/Logistics';
import MyVehicle from './pages/MyVehicle';
import Notifications from './pages/Notifications';
import Organisations from './pages/Organisations';
import PartsHardwareAdmin from './pages/PartsHardwareAdmin';
import Photos from './pages/Photos';
import PriceList from './pages/PriceList';
import Projects from './pages/Projects';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import RoleSettings from './pages/RoleSettings';
import SamplesLibrary from './pages/SamplesLibrary';
import Schedule from './pages/Schedule';
import Suppliers from './pages/Suppliers';
import SupplyLogistics from './pages/SupplyLogistics';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import ToolsAdmin from './pages/ToolsAdmin';
import UserProfile from './pages/UserProfile';
import PurchaseOrdersV2 from './pages/PurchaseOrdersV2';
import PurchaseOrderV2Detail from './pages/PurchaseOrderV2Detail';
import InventoryV2 from './pages/InventoryV2';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Archive": Archive,
    "CheckIn": CheckIn,
    "Contracts": Contracts,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "EmailSettings": EmailSettings,
    "Fleet": Fleet,
    "Home": Home,
    "Inbox": Inbox,
    "Jobs": Jobs,
    "Logistics": Logistics,
    "MyVehicle": MyVehicle,
    "Notifications": Notifications,
    "Organisations": Organisations,
    "PartsHardwareAdmin": PartsHardwareAdmin,
    "Photos": Photos,
    "PriceList": PriceList,
    "Projects": Projects,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "RoleSettings": RoleSettings,
    "SamplesLibrary": SamplesLibrary,
    "Schedule": Schedule,
    "Suppliers": Suppliers,
    "SupplyLogistics": SupplyLogistics,
    "Tasks": Tasks,
    "Team": Team,
    "ToolsAdmin": ToolsAdmin,
    "UserProfile": UserProfile,
    "PurchaseOrdersV2": PurchaseOrdersV2,
    "PurchaseOrderV2Detail": PurchaseOrderV2Detail,
    "InventoryV2": InventoryV2,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};