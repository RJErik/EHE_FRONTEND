import { Card, CardContent } from "../ui/card.jsx";

const PaperTradingList = () => {
    // Placeholder for paper trading simulations
    const simulations = [];

    return (
        <Card className="bg-gray-200 w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-gray-500">List of paper trading simulations</p>
            </CardContent>
        </Card>
    );
};

export default PaperTradingList;
