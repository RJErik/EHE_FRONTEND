import { useState } from "react";
import Header from "../components/Header";
import SearchPortfolio from "../components/portfolio/SearchPortfolio.jsx";
import AddPortfolio from "../components/portfolio/AddPortfolio.jsx";
import PortfoliosDisplay from "../components/portfolio/PortfoliosDisplay.jsx";
import PortfolioDetail from "./PortfolioDetail";
import { Button } from "../components/ui/button";

const Portfolio = ({ navigate }) => {
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

    // Mock data for portfolios
    const portfolios = [
        { id: "123", name: "Growth Portfolio", value: "$125,000.00", platform: "NYSE" },
        { id: "456", name: "Dividend Portfolio", value: "$75,000.00", platform: "NASDAQ" },
    ];

    const handlePortfolioSelect = (portfolioId) => {
        setSelectedPortfolioId(portfolioId);
    };

    const handleBackToList = () => {
        setSelectedPortfolioId(null);
    };

    // Updated PortfoliosDisplay to handle selection
    const EnhancedPortfoliosDisplay = () => (
        <div className="w-full md:w-3/4">
            <div className="bg-gray-200 w-full h-full rounded-md p-6 min-h-[600px]">
                <h3 className="text-xl text-gray-500 text-center mb-6">List of current portfolios</h3>
                <div className="space-y-4">
                    {portfolios.map(portfolio => (
                        <div
                            key={portfolio.id}
                            className="p-4 bg-white rounded-md shadow-sm cursor-pointer hover:bg-gray-50"
                            onClick={() => handlePortfolioSelect(portfolio.id)}
                        >
                            <p className="font-medium">{portfolio.name}</p>
                            <p className="text-sm text-gray-500">Value: {portfolio.value}</p>
                            <p className="text-sm text-gray-500">Platform: {portfolio.platform}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // If a portfolio is selected, show the detail view
    if (selectedPortfolioId) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header navigate={navigate} currentPage="portfolio" />

                <main className="flex-1 p-4">
                    <div className="container mx-auto">
                        <Button
                            variant="outline"
                            className="mb-6"
                            onClick={handleBackToList}
                        >
                            &larr; Back to portfolios
                        </Button>

                        <PortfolioDetail
                            navigate={navigate}
                            portfolioId={selectedPortfolioId}
                        />
                    </div>
                </main>
            </div>
        );
    }

    // Otherwise, show the list view
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="portfolio" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-gray-600 text-center mb-8">Portfolio</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/4">
                            <Button className="w-full bg-gray-500 hover:bg-gray-600 mb-4">
                                Add API Key
                            </Button>
                            <SearchPortfolio />
                            <AddPortfolio />
                        </div>

                        <EnhancedPortfoliosDisplay />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Portfolio;
