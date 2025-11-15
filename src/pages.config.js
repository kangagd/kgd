import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import CheckIn from './pages/CheckIn';
import Team from './pages/Team';
import Schedule from './pages/Schedule';
import Customers from './pages/Customers';
import PriceList from './pages/PriceList';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Jobs": Jobs,
    "CheckIn": CheckIn,
    "Team": Team,
    "Schedule": Schedule,
    "Customers": Customers,
    "PriceList": PriceList,
}

export const pagesConfig = {
    mainPage: "Schedule",
    Pages: PAGES,
    Layout: Layout,
};