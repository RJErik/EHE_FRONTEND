import SearchAutomatedTradeRules from "@/feature/automatedTradeRule/SearchAutomatedTradeRules.jsx";
import CreateAutomatedTradeRule from "@/feature/automatedTradeRule/CreateAutomatedTradeRule.jsx";
import AutomatedTradeRuleList from "@/feature/automatedTradeRule/AutomatedTradeRuleList.jsx";
import { AutomaticTradeProvider, useAutomatedTradeRuleContext } from "@/context/AutomatedTradeRulesContext.jsx";
import { useEffect } from "react";

const AutomaticTradeRulesContent = () => {
    const { fetchAutomaticTradeRules } = useAutomatedTradeRuleContext();

    useEffect(() => {
        console.log("Initial automatic transaction fetch...");
        fetchAutomaticTradeRules();
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Automated Trade Rules</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Create */}
                        <div className="w-full md:w-1/3">
                            <SearchAutomatedTradeRules />
                            <CreateAutomatedTradeRule />
                        </div>

                        {/* Right section - List of automated trade rules */}
                        <div className="w-full md:w-2/3">
                            <AutomatedTradeRuleList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const AutomatedTradeRules = () => {
    return (
        <AutomaticTradeProvider>
            <AutomaticTradeRulesContent />
        </AutomaticTradeProvider>
    );
};

export default AutomatedTradeRules;