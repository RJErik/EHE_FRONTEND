import { Card, CardContent } from "../ui/card.jsx";

const PortfoliosDisplay = () => {
    // Placeholder for portfolios list
    const portfolios = [];

    return (
        <Card className="w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-muted-foreground">List of current portfolios</p>
            </CardContent>
        </Card>
    );
};

export default PortfoliosDisplay;
