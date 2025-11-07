// src/pages/AutomaticTradeRules.jsx
import SearchAutomaticTradeRules from "@/feature/automaticTransaction/SearchAutomaticTradeRules.jsx";
import CreateAutomaticTradeRule from "@/feature/automaticTransaction/CreateAutomaticTradeRule.jsx";
import AutomaticTradeRuleList from "@/feature/automaticTransaction/AutomaticTradeRuleList.jsx";

const AutomaticTradeRules = () => {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Automated Trade Rules</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Create */}
                        <div className="w-full md:w-1/3">
                            <SearchAutomaticTradeRules />
                            <CreateAutomaticTradeRule />
                        </div>

                        {/* Right section - List of automated trade rules */}
                        <div className="w-full md:w-2/3">
                            <AutomaticTradeRuleList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AutomaticTradeRules;