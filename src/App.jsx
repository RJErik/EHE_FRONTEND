// App.jsx
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
import { WebSocketProvider } from "./context/CandleWebSocketContext";
import { AlertWebSocketProvider } from "./context/AlertWebSocketContext";
import WatchlistTicker from "./components/watchlist/WatchlistTicker";
import { WatchlistProvider } from "./context/WatchlistContext";
import Header from "./components/Header";
import { AutomaticTradeProvider } from "@/context/AutomaticTradeContext.jsx";
import { AutomatedTradeWebSocketProvider } from "./context/AutomatedTradeWebSocketContext"; // Import here

function App() {
    // Simple routing implementation
    const [currentPage, setCurrentPage] = useState("home");

    // Function to navigate between pages
    const navigate = (page) => {
        setCurrentPage(page);
    };

    // Render the appropriate page
    const renderContent = () => {
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
            <AlertWebSocketProvider>
                <WatchlistProvider>
                    <AutomaticTradeProvider>
                        <AutomatedTradeWebSocketProvider> {/* Move provider here */}
                            <div className="flex flex-col min-h-screen">
                                {/* Fixed header */}
                                <div className="fixed top-0 left-0 right-0 z-50">
                                    <Header navigate={navigate} currentPage={currentPage} />
                                </div>

                                {/* Main content with proper spacing */}
                                <div className="pt-[60px]">
                                    <WatchlistTicker />
                                    <div className="flex-1">
                                        {renderContent()}
                                    </div>
                                </div>
                            </div>
                            <Toaster />
                        </AutomatedTradeWebSocketProvider>
                    </AutomaticTradeProvider>
                </WatchlistProvider>
            </AlertWebSocketProvider>
        </WebSocketProvider>
    );
}

export default App;
