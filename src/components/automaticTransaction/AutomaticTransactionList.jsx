import { Card, CardContent } from "../ui/card.jsx";

const AutomaticTransactionList = () => {
    // Placeholder for automatic transactions list
    const transactions = [];

    return (
        <Card className="bg-gray-200 w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-gray-500">List of current automatic transactions</p>
            </CardContent>
        </Card>
    );
};

export default AutomaticTransactionList;
