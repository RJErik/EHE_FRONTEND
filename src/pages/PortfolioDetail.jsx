import { useState, useEffect } from "react";
import Header from "../components/Header";
import PortfolioDetailHeader from "../components/portfolioDetail/PortfolioDetailHeader.jsx";
import PortfolioCompositionChart from "../components/portfolioDetail/PortfolioCompositionChart.jsx";
import PortfolioCompositionList from "../components/portfolioDetail/PortfolioCompositionList.jsx";
import PortfolioDivisionChart from "../components/portfolioDetail/PortfolioDivisionChart.jsx";
import { useToast } from "../hooks/use-toast";
import { Loader2 } from "lucide-react";

const PortfolioDetail = ({ navigate, portfolioId }) => {
    const [portfolioData, setPortfolioData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchPortfolioDetails = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`http://localhost:8080/api/user/portfolio/${portfolioId}/details`, {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log("Portfolio details received:", data);

                if (data.success) {
                    setPortfolioData(data.portfolio);
                } else {
                    setError(data.message || "Failed to fetch portfolio details");
                    toast({
                        title: "Error",
                        description: data.message || "Failed to fetch portfolio details",
                        variant: "destructive",
                    });
                }
            } catch (err) {
                console.error("Error fetching portfolio details:", err);
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch portfolio details. Server may be unavailable.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (portfolioId) {
            fetchPortfolioDetails();
        }
    }, [portfolioId, toast]);

    // If loading, show a loading indicator
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header navigate={navigate} currentPage="portfolio" />
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
                <Header navigate={navigate} currentPage="portfolio" />
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
                <Header navigate={navigate} currentPage="portfolio" />
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
            <Header navigate={navigate} currentPage="portfolio" />
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
