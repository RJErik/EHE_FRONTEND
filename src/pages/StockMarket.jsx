import Header from "../components/Header";
import StockSelectors from "../components/StockSelectors";
import TimeIntervalButtons from "../components/TimeIntervalButtons";
import CandleChart from "../components/CandleChart";
import IndicatorCharts from "../components/IndicatorCharts";
import PortfolioList from "../components/PortfolioList";
import PortfolioGraph from "../components/PortfolioGraph";
import TradePanel from "../components/TradePanel";

const StockMarket = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="stockMarket" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-gray-600 text-center mb-8">Stock Market</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Charts and controls */}
                        <div className="w-full md:w-2/3 space-y-4">
                            <StockSelectors />
                            <TimeIntervalButtons />

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
