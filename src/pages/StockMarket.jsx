// src/pages/StockMarket.jsx
import Header from "../components/Header";
import StockSelectors from "../components/stockMarket/StockSelectors.jsx";
import CandleChart from "../components/stockMarket/CandleChart";
import IndicatorCharts from "../components/stockMarket/IndicatorCharts.jsx";
import PortfolioList from "../components/stockMarket/PortfolioList.jsx";
import PortfolioGraph from "../components/stockMarket/PortfolioGraph.jsx";
import TradePanel from "../components/stockMarket/TradePanel.jsx";
import { useCandleSubscription } from "../hooks/useCandleSubscription.js";
import { useWebSocket } from "../context/WebSocketContext.jsx";
import { useEffect } from "react";

const StockMarket = ({ navigate }) => {
    const { unsubscribeFromCandles } = useCandleSubscription();
    const { disconnectWebSocket } = useWebSocket();

    // Cleanup function to run when component unmounts
    useEffect(() => {
        // This effect's cleanup function will run when the component unmounts
        return () => {
            console.log("[StockMarket] Page unmounting - cleaning up subscriptions and connections");
            
            // First unsubscribe from all candle subscriptions
            unsubscribeFromCandles().then(() => {
                console.log("[StockMarket] Successfully unsubscribed from all candle subscriptions");
                
                // Disconnect from the WebSocket using the dedicated method
                disconnectWebSocket();
                console.log("[StockMarket] Requested WebSocket disconnection");
            }).catch(error => {
                console.error("[StockMarket] Error during subscription cleanup:", error);
                
                // Still try to disconnect even if unsubscribe fails
                disconnectWebSocket();
            });
        };
    }, [unsubscribeFromCandles, disconnectWebSocket]);

    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="stockMarket" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Stock Market</h1>

                <div className="container mx-auto">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Left section - Charts and controls */}
                            <div className="w-full md:w-2/3 space-y-4">
                                <StockSelectors />

                                <div className="mt-6 space-y-4">
                                    <CandleChart />
                                    <IndicatorCharts />
                                </div>
                            </div>

                            {/* Right section - Portfolio and Trading */}
                            <div className="w-full md:w-1/3 space-y-4">
                                <div className="h-64">
                                    <PortfolioList />
                                </div>

                                <div className="h-52">
                                    <PortfolioGraph />
                                </div>

                                <TradePanel />
                            </div>
                        </div>
                </div>
            </main>
        </div>
    );
};

export default StockMarket;
