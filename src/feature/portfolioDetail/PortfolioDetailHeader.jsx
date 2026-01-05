import { Card, CardContent } from "../../components/ui/card.jsx";
import binanceLogo from "../../assets/binance.png";
import defaultPlatformLogo from "../../assets/default-platform.png";

const PortfolioDetailHeader = ({ portfolioData }) => {
    const { name, creationDate, platform, totalValue, stocks = [] } = portfolioData || {};

    // Find dominant stock
    const dominantStock = stocks && stocks.length > 0
        ? [...stocks].sort((a, b) => parseFloat(b.value) - parseFloat(a.value))[0]
        : null;

    // Calculate dominance percentage
    const totalStocksValue = stocks?.reduce((sum, stock) => sum + parseFloat(stock.value), 0) || 0;
    const dominancePercentage = dominantStock && totalStocksValue > 0
        ? ((parseFloat(dominantStock.value) / totalStocksValue) * 100).toFixed(2)
        : 0;

    // Determine which logo to use based on platform
    const getLogo = (platformName) => {
        if (!platformName) return defaultPlatformLogo;

        const platformLower = platformName.toLowerCase();

        switch (platformLower) {
            case 'binance':
                return binanceLogo;
            default:
                return defaultPlatformLogo;
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="flex items-center justify-center p-6 h-64">
                <img
                    src={getLogo(platform)}
                    alt={`${platform || 'Default'} logo`}
                    className="max-h-full max-w-full object-contain"
                />
            </Card>

            <Card className="md:col-span-2">
                <CardContent className="p-6 space-y-6">
                    <div>
                        <p className="font-medium">Portfolio name:</p>
                        <p>{name || "N/A"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Addition date:</p>
                        <p>{creationDate || "N/A"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Platform:</p>
                        <p>{platform || "N/A"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Current value of the portfolio:</p>
                        <p>${typeof totalValue === 'number' || !isNaN(parseFloat(totalValue))
                            ? parseFloat(totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "N/A"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Dominant stock of the portfolio:</p>
                        <p>{dominantStock ? `${dominantStock.symbol} (${dominancePercentage}%)` : "N/A"}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PortfolioDetailHeader;