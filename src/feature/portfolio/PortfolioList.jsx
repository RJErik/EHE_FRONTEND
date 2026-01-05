import { Card, CardContent } from "../../components/ui/card.jsx";
import { usePortfolioContext } from "../../context/PortfoliosContext.jsx";
import { Loader2 } from "lucide-react";
import PortfolioItemCard from "./PortfolioItemCard.jsx";

const PortfolioList = ({ onSelectPortfolio }) => {
    const {
        portfolios,
        isLoading,
        error,
        deletePortfolio,
        fetchPortfolios,
        updateHoldings,
        lastUpdate
    } = usePortfolioContext();

    const handleDelete = async (portfolioId, event) => {
        if (event) {
            event.stopPropagation();
        }
        await deletePortfolio(portfolioId);
    };

    const handleUpdate = async (portfolioId, event) => {
        if (event) {
            event.stopPropagation();
        }
        await updateHoldings(portfolioId);
        fetchPortfolios();
    };

    const handleClick = (portfolioId) => {
        if (onSelectPortfolio) {
            onSelectPortfolio(portfolioId);
        }
    };

    return (
        <Card className="w-full h-full">
            <CardContent className="p-6 h-full min-h-[600px]">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full flex-col">
                        <p className="text-lg text-destructive">Error loading portfolios</p>
                        <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    </div>
                ) : portfolios.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-lg text-muted-foreground">No portfolios found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {portfolios.map((portfolio) => (
                            <div
                                key={`portfolio-${portfolio.id}-${lastUpdate}`}
                                onClick={() => handleClick(portfolio.id)}
                                className="cursor-pointer"
                            >
                                <PortfolioItemCard
                                    portfolio={portfolio}
                                    onDelete={(e) => handleDelete(portfolio.id, e)}
                                    onUpdate={(e) => handleUpdate(portfolio.id, e)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default PortfolioList;