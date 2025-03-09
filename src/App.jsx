import { useState } from "react";
import { AuthProvider } from "./context/AuthContext";
import Home from "./pages/Home";
import Account from "./pages/Account";
import StockMarket from "./pages/StockMarket";
import PaperTrading from "./pages/PaperTrading";
import Alerts from "./pages/Alerts";
import AutomaticTransactions from "./pages/AutomaticTransactions";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";

function App() {
    const [currentPage, setCurrentPage] = useState("stockMarket"); // Default to stock market page

    const navigate = (page) => {
        setCurrentPage(page);
    };

    const renderPage = () => {
        switch (currentPage) {
            case "home": return <Home navigate={navigate} />;
            case "account": return <Account navigate={navigate} />;
            case "stockMarket": return <StockMarket navigate={navigate} />;
            case "paperTrading": return <PaperTrading navigate={navigate} />;
            case "alerts": return <Alerts navigate={navigate} />;
            case "automaticTransactions": return <AutomaticTransactions navigate={navigate} />;
            case "portfolio": return <Portfolio navigate={navigate} />;
            case "watchlist": return <Watchlist navigate={navigate} />;
            default: return <StockMarket navigate={navigate} />;
        }
    };

    return (
        <AuthProvider>
            {renderPage()}
        </AuthProvider>
    );
}

export default App;
