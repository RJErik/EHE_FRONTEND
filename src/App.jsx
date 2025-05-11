import { useState } from "react";
import Home from "./pages/Home";
import Account from "./pages/Account";
import StockMarket from "./pages/StockMarket";
import PaperTrading from "./pages/PaperTrading";
import Alerts from "./pages/Alerts.jsx";
import AutomaticTransactions from "./pages/AutomaticTransactions.jsx";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import { Toaster } from "./components/ui/toaster";
import { WebSocketProvider } from "./context/WebSocketContext";
import WatchlistTicker from "./components/watchlist/WatchlistTicker";
import { WatchlistProvider } from "./context/WatchlistContext";

function App() {
    // Simple routing implementation
    const [currentPage, setCurrentPage] = useState("home");

    // Function to navigate between pages
    const navigate = (page) => {
        setCurrentPage(page);
    };

    // Render the appropriate page
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
            default: return <Home navigate={navigate} />;
        }
    };

    return (
        <WebSocketProvider currentPage={currentPage}>
            <WatchlistProvider>
                <div className="flex flex-col min-h-screen">
                    {/* The main content with padding for both header and ticker */}
                    <div className="pt-[81px]"> {/* 60px header + 21px ticker collapsed height */}
                        {renderPage()}
                    </div>

                    {/* The watchlist ticker appears below the header */}
                    <WatchlistTicker />
                </div>
                <Toaster />
            </WatchlistProvider>
        </WebSocketProvider>
    );
}

export default App;
