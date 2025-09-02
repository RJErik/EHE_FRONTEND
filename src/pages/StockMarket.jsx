// src/pages/StockMarket.jsx (update)
import StockSelectors from "@/feature/stockMarket/StockSelectors.jsx";
import CandleChart from "@/feature/stockMarket/CandleChart";
import IndicatorCharts from "@/feature/stockMarket/IndicatorCharts.jsx";
import PortfolioList from "@/feature/stockMarket/PortfolioList.jsx";
import PortfolioGraph from "@/feature/stockMarket/PortfolioGraph.jsx";
import TradePanel from "@/feature/stockMarket/TradePanel.jsx";
import { ChartProvider } from "@/feature/stockMarket/ChartContext.jsx";

const StockMarket = () => {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Stock Market</h1>

                <div className="container mx-auto">
                    <ChartProvider>
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
                    </ChartProvider>
                </div>
            </main>
        </div>
    );
};

export default StockMarket;
