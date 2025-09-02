import { Card, CardContent } from "../../components/ui/card.jsx";

const PaperTradingList = () => {
    // Placeholder for paper trading simulations
    const simulations = [];

    return (
        <Card className="w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-muted-foreground">List of paper trading simulations</p>
            </CardContent>
        </Card>
    );
};

export default PaperTradingList;
