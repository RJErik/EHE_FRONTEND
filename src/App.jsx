import { useState } from "react";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Account from "./pages/Account";
import StockMarket from "./pages/StockMarket";
import PaperTrading from "./pages/PaperTrading";
import Alerts from "./pages/Alerts.jsx";
import AutomaticTransactions from "./pages/AutomaticTransactions.jsx";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";

function App() {
    // Simple routing implementation
    const [currentPage, setCurrentPage] = useState("home");

    // Function to navigate between pages
    const navigate = (page) => {
        setCurrentPage(page);
    };

    // Render the appropriate page based on currentPage state
    const renderPage = () => {
        switch (currentPage) {
            case "home":
                return <Home navigate={navigate} />;
            case "register":
                return <Register navigate={navigate} />;
            case "login":
                return <Login navigate={navigate} />;
            case "account":
                return <Account navigate={navigate} />;
            case "stockMarket":
                return <StockMarket navigate={navigate} />;
            case "paperTrading":
                return <PaperTrading navigate={navigate} />;
            case "alerts":
                return <Alerts navigate={navigate} />;
            case "automaticTransactions":
                return <AutomaticTransactions navigate={navigate} />;
            case "portfolio":
                return <Portfolio navigate={navigate} />;
            case "watchlist":
                return <Watchlist navigate={navigate} />;
            default:
                return <Home navigate={navigate} />;
        }
    };

    return renderPage();
}

export default App;
