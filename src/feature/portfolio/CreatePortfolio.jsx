import { useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Input } from "../../components/ui/input.jsx";
import { usePortfolioContext } from "../../context/PortfoliosContext.jsx";
import { useApiKeys } from "../../hooks/useApiKeys.js";
import { useToast } from "../../hooks/use-toast";
import { Loader2 } from "lucide-react";

const CreatePortfolio = () => {
    const [portfolioName, setPortfolioName] = useState("");
    const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const { createPortfolio} = usePortfolioContext();
    const { apiKeys, isLoading: isLoadingApiKeys } = useApiKeys();
    const { toast } = useToast();

    const handleAdd = async () => {
        if (!portfolioName || !selectedApiKeyId) {
            return;
        }

        if (portfolioName.length > 100) {
            toast({
                title: "Validation Error",
                description: "Portfolio name must be 100 characters or less",
                variant: "destructive",
            });
            return;
        }

        setIsAdding(true);
        try {
            const success = await createPortfolio(portfolioName, parseInt(selectedApiKeyId, 10));
            if (success) {
                setPortfolioName("");
                setSelectedApiKeyId("");

                console.log("Add successful - portfolio added to state");
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
                        maxLength={100}
                    />
                    {portfolioName.length > 0 && (
                        <p className={`text-xs mt-1 ${portfolioName.length > 100 ? 'text-red-500' : 'text-gray-500'}`}>
                            {portfolioName.length}/100 characters
                        </p>
                    )}
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
                    disabled={!portfolioName || !selectedApiKeyId || isAdding || portfolioName.length > 100}
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

export default CreatePortfolio;