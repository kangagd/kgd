import BaselineStockSeed from './pages/BaselineStockSeed';
import CheckIn from './pages/CheckIn';
import Contracts from './pages/Contracts';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import EmailSettings from './pages/EmailSettings';
import EmailTemplates from './pages/EmailTemplates';
import Fleet from './pages/Fleet';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Logistics from './pages/Logistics';
import ModelHealth from './pages/ModelHealth';
import MyVehicle from './pages/MyVehicle';
import Notifications from './pages/Notifications';
import Organisations from './pages/Organisations';
import OutstandingBalances from './pages/OutstandingBalances';
import PartsHardwareAdmin from './pages/PartsHardwareAdmin';
import Photos from './pages/Photos';
import PriceList from './pages/PriceList';
import PurchaseOrders from './pages/PurchaseOrders';
import Reports from './pages/Reports';
import RoleSettings from './pages/RoleSettings';
import SamplesLibrary from './pages/SamplesLibrary';
import Suppliers from './pages/Suppliers';
import SupplyLogistics from './pages/SupplyLogistics';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import ToolsAdmin from './pages/ToolsAdmin';
import UserProfile from './pages/UserProfile';
import WarehouseInventory from './pages/WarehouseInventory';
import Jobs from './pages/Jobs';
import Projects from './pages/Projects';
import Schedule from './pages/Schedule';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BaselineStockSeed": BaselineStockSeed,
    "CheckIn": CheckIn,
    "Contracts": Contracts,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "EmailSettings": EmailSettings,
    "EmailTemplates": EmailTemplates,
    "Fleet": Fleet,
    "Home": Home,
    "Inbox": Inbox,
    "Logistics": Logistics,
    "ModelHealth": ModelHealth,
    "MyVehicle": MyVehicle,
    "Notifications": Notifications,
    "Organisations": Organisations,
    "OutstandingBalances": OutstandingBalances,
    "PartsHardwareAdmin": PartsHardwareAdmin,
    "Photos": Photos,
    "PriceList": PriceList,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "RoleSettings": RoleSettings,
    "SamplesLibrary": SamplesLibrary,
    "Suppliers": Suppliers,
    "SupplyLogistics": SupplyLogistics,
    "Tasks": Tasks,
    "Team": Team,
    "ToolsAdmin": ToolsAdmin,
    "UserProfile": UserProfile,
    "WarehouseInventory": WarehouseInventory,
    "Jobs": Jobs,
    "Projects": Projects,
    "Schedule": Schedule,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};