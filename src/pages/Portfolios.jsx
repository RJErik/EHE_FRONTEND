import { useEffect, useState } from "react";
import SearchPortfolios from "@/feature/portfolio/SearchPortfolios.jsx";
import CreatePortfolio from "@/feature/portfolio/CreatePortfolio.jsx";
import PortfolioList from "@/feature/portfolio/PortfolioList.jsx";
import PortfolioDetail from "./PortfolioDetail";
import { Button } from "../components/ui/button";
import { PortfolioProvider, usePortfolioContext } from "../context/PortfoliosContext.jsx";
import { useNavigate } from "react-router-dom";

const PortfoliosListContent = ({ onSelectPortfolio }) => {
    const navigate = useNavigate();
    const { fetchPortfolios } = usePortfolioContext();

    useEffect(() => {
        console.log("Initial portfolios fetch...");
        fetchPortfolios();
    }, []);

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/4">
                <Button className="w-full mb-4" onClick={() => navigate("/account")}>
                    Manage API Keys
                </Button>
                <SearchPortfolios />
                <CreatePortfolio />
            </div>

            <div className="w-full md:w-3/4">
                <PortfolioList onSelectPortfolio={onSelectPortfolio} />
            </div>
        </div>
    );
};

const Portfolios = () => {
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
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Portfolio</h1>

                <div className="container mx-auto">
                    <PortfolioProvider>
                        <PortfoliosListContent onSelectPortfolio={handlePortfolioSelect} />
                    </PortfolioProvider>
                </div>
            </main>
        </div>
    );
};

export default Portfolios;