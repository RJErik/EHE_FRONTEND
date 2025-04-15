import { Card, CardContent, CardHeader } from "../ui/card.jsx";

const PortfolioList = () => {
    return (
        <Card className="w-full h-full mb-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">List of owned values in the customer portfolio</h3>
            </CardHeader>
            <CardContent>
                {/* Placeholder for portfolio items */}
            </CardContent>
        </Card>
    );
};

export default PortfolioList;
