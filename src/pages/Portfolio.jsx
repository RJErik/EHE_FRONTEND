// src/pages/Portfolio.jsx
import { useState } from "react";
import Header from "../components/Header";
import SearchPortfolio from "../components/portfolio/SearchPortfolio.jsx";
import AddPortfolio from "../components/portfolio/AddPortfolio.jsx";
import PortfoliosDisplay from "../components/portfolio/PortfoliosDisplay.jsx";
import PortfolioDetail from "./PortfolioDetail";
import { Button } from "../components/ui/button";
import { PortfolioProvider } from "../context/PortfolioContext";

const Portfolio = ({ navigate }) => {
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

    const handlePortfolioSelect = (portfolioId) => {
        setSelectedPortfolioId(portfolioId);
    };

    const handleBackToList = () => {
        setSelectedPortfolioId(null);
    };

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
                <h1 className="text-4xl font-semibold text-center mb-8">Portfolio</h1>

                <div className="container mx-auto">
                    <PortfolioProvider>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/4">
                                <Button className="w-full mb-4" onClick={() => navigate("/account")}>
                                    Manage API Keys
                                </Button>
                                <SearchPortfolio />
                                <AddPortfolio />
                            </div>

                            <div className="w-full md:w-3/4">
                                <PortfoliosDisplay onSelectPortfolio={handlePortfolioSelect} />
                            </div>
                        </div>
                    </PortfolioProvider>
                </div>
            </main>
        </div>
    );
};

export default Portfolio;
