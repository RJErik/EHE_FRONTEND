import Header from "../components/Header";
import SearchAutomaticTransactions from "../components/SearchAutomaticTransactions";
import CreateAutomaticTransaction from "../components/CreateAutomaticTransaction";
import AutomaticTransactionsList from "../components/AutomaticTransactionsList";
import { Button } from "../components/ui/button";

const AutomaticTransactions = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="automaticTransactions" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-gray-600 text-center mb-8">Automatic Transactions</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Add API Key, Search and Create */}
                        <div className="w-full md:w-1/4">
                            <Button className="w-full bg-gray-500 hover:bg-gray-600 mb-4">
                                Add API Key
                            </Button>
                            <SearchAutomaticTransactions />
                            <CreateAutomaticTransaction />
                        </div>

                        {/* Right section - List of automatic transactions */}
                        <div className="w-full md:w-3/4">
                            <AutomaticTransactionsList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AutomaticTransactions;
