// src/pages/AutomaticTransactions.jsx
import SearchAutomaticTransactions from "@/components/automaticTransaction/SearchAutomaticTransactions.jsx";
import CreateAutomaticTransaction from "@/components/automaticTransaction/CreateAutomaticTransaction.jsx";
import AutomaticTransactionList from "@/components/automaticTransaction/AutomaticTransactionList.jsx";

const AutomaticTransactions = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Automated Trade Rules</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Create */}
                        <div className="w-full md:w-1/3">
                            <SearchAutomaticTransactions />
                            <CreateAutomaticTransaction />
                        </div>

                        {/* Right section - List of automated trade rules */}
                        <div className="w-full md:w-2/3">
                            <AutomaticTransactionList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AutomaticTransactions;