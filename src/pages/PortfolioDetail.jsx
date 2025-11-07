import { useState, useEffect } from "react";
import PortfolioDetailHeader from "@/feature/portfolioDetail/PortfolioDetailHeader.jsx";
import PortfolioCompositionChart from "@/feature/portfolioDetail/PortfolioCompositionChart.jsx";
import PortfolioCompositionList from "@/feature/portfolioDetail/PortfolioCompositionList.jsx";
import PortfolioDivisionChart from "@/feature/portfolioDetail/PortfolioDivisionChart.jsx";
import { usePortfolios } from "../hooks/usePortfolios.js";
import { Loader2 } from "lucide-react";

const PortfolioDetail = ({portfolioId }) => {
    const [portfolioData, setPortfolioData] = useState(null);
    const { isLoading, error, fetchPortfolioDetails } = usePortfolios();

    useEffect(() => {
        const loadPortfolioDetails = async () => {
            if (portfolioId) {
                const data = await fetchPortfolioDetails(portfolioId);
                setPortfolioData(data);
            }
        };

        loadPortfolioDetails();
    }, [portfolioId, fetchPortfolioDetails]);

    // If loading, show a loading indicator
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin" />
                </main>
            </div>
        );
    }

    // If there was an error, show the error message
    if (error) {
        return (
            <div className="min-h-screen flex flex-col">
                <main className="flex-1 p-4">
                    <div className="container mx-auto text-center">
                        <h1 className="text-4xl font-semibold mb-4">Error</h1>
                        <p className="text-xl text-destructive">{error}</p>
                    </div>
                </main>
            </div>
        );
    }

    // If no data, show a message
    if (!portfolioData) {
        return (
            <div className="min-h-screen flex flex-col">
                <main className="flex-1 p-4">
                    <div className="container mx-auto text-center">
                        <h1 className="text-4xl font-semibold mb-4">No Data</h1>
                        <p className="text-xl">No portfolio data available</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Portfolio Details</h1>

                <div className="container mx-auto">
                    <PortfolioDetailHeader portfolioData={portfolioData} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <PortfolioCompositionChart portfolioData={portfolioData} />
                        <PortfolioCompositionList portfolioData={portfolioData} />
                        <PortfolioDivisionChart portfolioData={portfolioData} />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PortfolioDetail;