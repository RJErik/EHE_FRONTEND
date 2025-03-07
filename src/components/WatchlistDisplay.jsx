import { Card, CardContent } from "./ui/card";

const WatchlistDisplay = () => {
    // Placeholder for watchlist items
    const watchlistItems = [];

    return (
        <Card className="bg-gray-200 w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-gray-500">List of Watchlist items</p>
            </CardContent>
        </Card>
    );
};

export default WatchlistDisplay;
