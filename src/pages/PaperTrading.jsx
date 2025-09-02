import SearchPaperTrading from "@/feature/paperTrading/SearchPaperTrading.jsx";
import CreatePaperTrading from "@/feature/paperTrading/CreatePaperTrading.jsx";
import PaperTradingList from "@/feature/paperTrading/PaperTradingList.jsx";

const PaperTrading = () => {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Paper Trading</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Create */}
                        <div className="w-full md:w-1/4">
                            <SearchPaperTrading />
                            <CreatePaperTrading />
                        </div>

                        {/* Right section - List of simulations */}
                        <div className="w-full md:w-3/4">
                            <PaperTradingList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PaperTrading;
