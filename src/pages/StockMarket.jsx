import { useState } from "react";
import StockSelectors from "@/feature/stockMarket/StockSelectors.jsx";
import CandleChart from "@/feature/stockMarket/CandleChart/CandleChart.jsx";
import IndicatorCharts from "@/feature/stockMarket/IndicatorCharts.jsx";
import PortfolioList from "@/feature/stockMarket/PortfolioList.jsx";
import PortfolioGraph from "@/feature/stockMarket/PortfolioGraph.jsx";
import TradePanel from "@/feature/stockMarket/TradePanel.jsx";
import PortfolioSelector from "@/feature/stockMarket/PortfolioSelector.jsx";
import { ChartProvider } from "@/feature/stockMarket/ChartContext.jsx";

const StockMarket = () => {
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

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

                            {/* Right section - Portfolios and Trading */}
                            <div className="w-full md:w-1/3 space-y-4">
                                <PortfolioSelector
                                    selectedPortfolioId={selectedPortfolioId}
                                    onPortfolioChange={setSelectedPortfolioId}
                                />

                                    <PortfolioList selectedPortfolioId={selectedPortfolioId}/>

                                    <PortfolioGraph selectedPortfolioId={selectedPortfolioId}/>

                                <TradePanel selectedPortfolioId={selectedPortfolioId}/>
                            </div>
                        </div>
                    </ChartProvider>
                </div>
            </main>
        </div>
    );
};

export default StockMarket;