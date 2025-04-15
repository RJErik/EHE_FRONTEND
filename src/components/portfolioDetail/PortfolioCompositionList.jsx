import { Card, CardContent } from "../ui/card.jsx";

const PortfolioCompositionList = () => {
    return (
        <Card className="h-full">
            <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                <p className="text-xl text-center">List of the composition of the portfolio</p>
            </CardContent>
        </Card>
    );
};

export default PortfolioCompositionList;
