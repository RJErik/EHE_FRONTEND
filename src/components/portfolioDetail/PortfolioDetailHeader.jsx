import { Card, CardContent } from "../ui/card.jsx";

const PortfolioDetailHeader = ({ portfolioData }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="flex items-center justify-center p-6 h-64">
                <p className="text-xl text-center">Logo of the platform</p>
            </Card>

            <Card className="md:col-span-2">
                <CardContent className="p-6 space-y-6">
                    <div>
                        <p className="font-medium">Addition date:</p>
                        <p>{portfolioData.additionDate || "January 15, 2023"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Platform:</p>
                        <p>{portfolioData.platform || "NYSE"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Current value of the portfolio:</p>
                        <p>${portfolioData.currentValue || "125,000.00"}</p>
                    </div>

                    <div>
                        <p className="font-medium">Dominant stock of the portfolio:</p>
                        <p>{portfolioData.dominantStock || "AAPL (35%)"}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PortfolioDetailHeader;
