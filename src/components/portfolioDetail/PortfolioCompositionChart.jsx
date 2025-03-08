import { Card, CardContent } from "../ui/card.jsx";

const PortfolioCompositionChart = () => {
    return (
        <Card className="bg-gray-200 h-full">
            <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                <p className="text-xl text-gray-500 text-center">Diagram of the composition of the portfolio</p>
            </CardContent>
        </Card>
    );
};

export default PortfolioCompositionChart;
