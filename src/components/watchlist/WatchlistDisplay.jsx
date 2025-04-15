import { Card, CardContent } from "../ui/card.jsx";

const WatchlistDisplay = () => {
    // Placeholder for watchlist items
    const watchlistItems = [];

    return (
        <Card className="w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl">List of Watchlist items</p>
            </CardContent>
        </Card>
    );
};

export default WatchlistDisplay;
