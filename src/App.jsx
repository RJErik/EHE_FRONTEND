// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Account from "./pages/Account";
import StockMarket from "./pages/StockMarket";
import Alerts from "./pages/Alerts.jsx";
import AutomaticTransactions from "./pages/AutomaticTransactions.jsx";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import { Toaster } from "./components/ui/toaster";
import { WebSocketProvider } from "./context/CandleWebSocketContext";
import { AlertWebSocketProvider } from "./context/AlertWebSocketContext";
import WatchlistTicker from "@/feature/watchlist/WatchlistTicker";
import { WatchlistProvider } from "./context/WatchlistContext";
import Header from "./feature/Header.jsx";
import { AutomaticTradeProvider } from "@/context/AutomaticTradeContext.jsx";
import { AutomatedTradeWebSocketProvider } from "./context/AutomatedTradeWebSocketContext";

function App() {
    return (
        <BrowserRouter>
            <WebSocketProvider>
                <AlertWebSocketProvider>
                    <WatchlistProvider>
                        <AutomaticTradeProvider>
                            <AutomatedTradeWebSocketProvider>
                                <div className="flex flex-col min-h-screen">
                                    {/* Fixed header */}
                                    <div className="fixed top-0 left-0 right-0 z-50">
                                        <Header />
                                    </div>

                                    {/* Main content with proper spacing */}
                                    <div className="pt-[60px]">
                                        <WatchlistTicker />
                                        <div className="flex-1">
                                            <Routes>
                                                <Route path="/" element={<Home />} />
                                                <Route path="/account" element={<Account />} />
                                                <Route path="/portfolio" element={<Portfolio />} />
                                                <Route path="/stock-market" element={<StockMarket />} />
                                                <Route path="/alerts" element={<Alerts />} />
                                                <Route path="/automatic-transactions" element={<AutomaticTransactions />} />
                                                <Route path="/watchlist" element={<Watchlist />} />
                                                {/* Redirect any unknown routes to home */}
                                                <Route path="*" element={<Navigate to="/" replace />} />
                                            </Routes>
                                        </div>
                                    </div>
                                </div>
                                <Toaster />
                            </AutomatedTradeWebSocketProvider>
                        </AutomaticTradeProvider>
                    </WatchlistProvider>
                </AlertWebSocketProvider>
            </WebSocketProvider>
        </BrowserRouter>
    );
}

export default App;