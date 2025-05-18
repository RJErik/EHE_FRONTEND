// src/components/portfolio/AddPortfolio.jsx
import { useState } from "react";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Input } from "../ui/input.jsx";
import { usePortfolioContext } from "../../context/PortfolioContext";
import { useApiKeys } from "../../hooks/useApiKeys.js";
import { Loader2 } from "lucide-react";

const AddPortfolio = () => {
    const [portfolioName, setPortfolioName] = useState("");
    const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const { createPortfolio, refreshLatestSearch } = usePortfolioContext();
    const { apiKeys, isLoading: isLoadingApiKeys } = useApiKeys();

    const handleAdd = async () => {
        if (!portfolioName || !selectedApiKeyId) {
            return;
        }

        setIsAdding(true);
        try {
            const success = await createPortfolio(portfolioName, parseInt(selectedApiKeyId, 10));
            if (success) {
                // Reset form fields after successful add
                setPortfolioName("");
                setSelectedApiKeyId("");

                // Force refresh using the last search
                console.log("Add successful - forcing refresh");
                refreshLatestSearch();
            }
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Add Portfolio</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs mb-1">Portfolio Name</p>
                    <Input
                        placeholder="Enter portfolio name"
                        value={portfolioName}
                        onChange={(e) => setPortfolioName(e.target.value)}
                        disabled={isAdding}
                    />
                </div>

                <div>
                    <p className="text-xs mb-1">API Key</p>
                    <Select
                        value={selectedApiKeyId}
                        onValueChange={setSelectedApiKeyId}
                        disabled={isLoadingApiKeys || isAdding}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select API Key" />
                        </SelectTrigger>
                        <SelectContent>
                            {apiKeys.map((apiKey) => (
                                <SelectItem key={apiKey.apiKeyId} value={apiKey.apiKeyId.toString()}>
                                    {apiKey.maskedApiKeyValue}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    className="w-full"
                    onClick={handleAdd}
                    disabled={!portfolioName || !selectedApiKeyId || isAdding}
                >
                    {isAdding ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                        </>
                    ) : (
                        "Add"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

export default AddPortfolio;
