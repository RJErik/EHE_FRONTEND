import { Card, CardContent } from "../ui/card.jsx";
import { useWatchlist } from "../../context/WatchlistContext";
import { Loader2 } from "lucide-react";
import WatchlistItemCard from "./WatchlistItemCard.jsx";
import { useEffect } from "react";

const WatchlistDisplay = () => {
    const { watchlistItems, isLoading, error, removeWatchlistItem, fetchWatchlistItems, lastUpdate } = useWatchlist();

    // Force refresh when the component mounts
    useEffect(() => {
        console.log("WatchlistDisplay mounted - fetching items");
        fetchWatchlistItems();
    }, [fetchWatchlistItems]);

    return (
        <Card className="w-full h-full">
            <CardContent className="p-6 h-full min-h-[600px]">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex justify-center items-center h-full flex-col">
                        <p className="text-lg text-destructive">Error loading watchlist</p>
                        <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    </div>
                ) : watchlistItems.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-lg text-muted-foreground">No watchlist items found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {watchlistItems.map((item) => (
                            <WatchlistItemCard
                                key={`item-${item.id}-${lastUpdate}`}
                                item={item}
                                onRemove={removeWatchlistItem}
                            />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default WatchlistDisplay;
