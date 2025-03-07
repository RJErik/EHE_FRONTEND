import Header from "../components/Header";
import SearchPaperTrading from "../components/SearchPaperTrading";
import CreatePaperTrading from "../components/CreatePaperTrading";
import PaperTradingList from "../components/PaperTradingList";

const PaperTrading = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="paperTrading" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-gray-600 text-center mb-8">Paper Trading</h1>

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
