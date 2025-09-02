import SearchWatchlist from "@/feature/watchlist/SearchWatchlist.jsx";
import AddWatchlist from "@/feature/watchlist/AddWatchlist.jsx";
import WatchlistDisplay from "@/feature/watchlist/WatchlistDisplay.jsx";

const Watchlist = () => {
    return (
        <div className="flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Watchlist</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Add */}
                        <div className="w-full md:w-1/4">
                            <SearchWatchlist />
                            <AddWatchlist />
                        </div>

                        {/* Right section - List of watchlist items */}
                        <div className="w-full md:w-3/4">
                            <WatchlistDisplay />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Watchlist;
