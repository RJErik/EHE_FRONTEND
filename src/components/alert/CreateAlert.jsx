// src/components/alert/CreateAlert.jsx
import { useState } from "react";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { useStockData } from "../../hooks/useStockData.js";
import { useAlert } from "../../context/AlertContext";
import { Loader2 } from "lucide-react";

const CreateAlert = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [selectedConditionType, setSelectedConditionType] = useState("");
    const [thresholdValue, setThresholdValue] = useState("");

    const {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        selectedStock,
        setSelectedStock,
        isLoadingPlatforms,
        isLoadingStocks
    } = useStockData();

    const { addAlert, fetchAlerts } = useAlert();

    const handleCreate = async () => {
        if (!selectedPlatform || !selectedStock || !selectedConditionType || !thresholdValue) {
            return;
        }

        setIsCreating(true);
        try {
            const success = await addAlert(
                selectedPlatform,
                selectedStock,
                selectedConditionType,
                thresholdValue
            );

            if (success) {
                // Reset fields after successful add
                setSelectedStock("");
                setSelectedConditionType("");
                setThresholdValue("");

                // Force refresh the alerts list
                console.log("Alert created successfully - forcing refresh");
                await fetchAlerts();
            }
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Card className="w-full mt-4">
            <CardHeader className="text-center pb-2">
                <h3 className="text-lg">Create</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs mb-1">Platform</p>
                    <Select
                        value={selectedPlatform}
                        onValueChange={setSelectedPlatform}
                        disabled={isLoadingPlatforms || isCreating}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                            {platforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs mb-1">Stock</p>
                    <Select
                        value={selectedStock}
                        onValueChange={setSelectedStock}
                        disabled={isLoadingStocks || isCreating || !selectedPlatform}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={selectedPlatform ? "Select stock" : "Select platform first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {stocks.map((stock) => (
                                <SelectItem key={stock} value={stock}>{stock}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs mb-1">Condition Type</p>
                    <Select
                        value={selectedConditionType}
                        onValueChange={setSelectedConditionType}
                        disabled={isCreating}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
                            <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <p className="text-xs mb-1">Threshold Value</p>
                    <Input
                        type="number"
                        placeholder="Enter price threshold"
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(e.target.value)}
                        disabled={isCreating}
                    />
                </div>

                <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={!selectedPlatform || !selectedStock || !selectedConditionType || !thresholdValue || isCreating}
                >
                    {isCreating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        "Create"
                    )}
                </Button>
            </CardContent>
        </Card>
    );
};

export default CreateAlert;
