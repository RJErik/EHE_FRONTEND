import Header from "../components/Header";
import PortfolioDetailHeader from "../components/portfolioDetail/PortfolioDetailHeader.jsx";
import PortfolioCompositionChart from "../components/portfolioDetail/PortfolioCompositionChart.jsx";
import PortfolioCompositionList from "../components/portfolioDetail/PortfolioCompositionList.jsx";
import PortfolioHistoryChart from "../components/portfolioDetail/PortfolioHistoryChart.jsx";

const PortfolioDetail = ({ navigate, portfolioId }) => {
    // In a real app, you would fetch the portfolio data based on the portfolioId
    const portfolioData = {
        id: portfolioId || "123",
        additionDate: "January 15, 2023",
        platform: "NYSE",
        currentValue: "125,000.00",
        dominantStock: "AAPL (35%)",
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="portfolio" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Portfolio</h1>

                <div className="container mx-auto">
                    <PortfolioDetailHeader portfolioData={portfolioData} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <PortfolioCompositionChart />
                        <PortfolioCompositionList />
                        <PortfolioHistoryChart />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PortfolioDetail;
