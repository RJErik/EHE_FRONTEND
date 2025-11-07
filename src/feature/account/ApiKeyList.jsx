import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent, CardHeader } from "../../components/ui/card.jsx";
import { ScrollArea } from "../../components/ui/scroll-area.jsx";
import { useApiKeys } from "../../hooks/useApiKeys.js";
import { useStockData } from "../../hooks/useStockData.js";
import ApiKeyItemCard from "./ApiKeyItemCard.jsx";
import ApiKeyAddItemCard from "./ApiKeyAddItemCard.jsx";
import ApiKeyAddDialog from "./ApiKeyAddDialog.jsx";
import ApiKeyUpdateDialog from "./ApiKeyUpdateDialog.jsx";
import ApiKeyDeleteDialog from "./ApiKeyDeleteDialog.jsx";
import { Loader2 } from "lucide-react";

const ApiKeyList = () => {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedApiKey, setSelectedApiKey] = useState(null);

    const { apiKeys, isLoading: isLoadingApiKeys, addApiKey, updateApiKey, deleteApiKey } = useApiKeys();
    const { platforms, isLoadingPlatforms, fetchPlatforms } = useStockData();

    // Make sure we have the platforms loaded
    // useEffect(() => {
    //     fetchPlatforms();
    // }, [fetchPlatforms]);

    const handleAddClick = () => {
        setAddDialogOpen(true);
    };

    const handleUpdateClick = (apiKey) => {
        setSelectedApiKey(apiKey);
        setUpdateDialogOpen(true);
    };

    const handleDeleteClick = (apiKey) => {
        setSelectedApiKey(apiKey);
        setDeleteDialogOpen(true);
    };

    const handleAddKey = async (platformName, apiKeyValue, secretKey) => {
        await addApiKey(platformName, apiKeyValue, secretKey);
        setAddDialogOpen(false);
    };

    const handleUpdateKey = async (apiKeyId, platformName, apiKeyValue, secretKey) => {
        await updateApiKey(apiKeyId, platformName, apiKeyValue, secretKey);
        setUpdateDialogOpen(false);
    };

    const handleDeleteKey = async (apiKeyId) => {
        await deleteApiKey(apiKeyId);
        setDeleteDialogOpen(false);
    };

    return (
        <div className="flex flex-col h-full">
            <Card className="flex-1 mb-4">
                <CardHeader className="pb-3">
                    <h3 className="text-lg font-semibold">API Keys</h3>
                </CardHeader>
                <CardContent>
                    {isLoadingApiKeys ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ScrollArea className="h-[320px]">
                            {apiKeys.length > 0 ? (
                                <div className="pr-4">
                                    {apiKeys.map((apiKey) => (
                                        <ApiKeyItemCard
                                            key={apiKey.apiKeyId}
                                            apiKey={apiKey}
                                            onUpdate={handleUpdateClick}
                                            onDelete={handleDeleteClick}
                                        />
                                    ))}
                                    <ApiKeyAddItemCard onClick={handleAddClick} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                    <p className="text-muted-foreground">No API keys found</p>
                                    <Button onClick={handleAddClick}>Add API Key</Button>
                                </div>
                            )}
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <ApiKeyAddDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onAddKey={handleAddKey}
                platforms={platforms}
                isLoading={isLoadingApiKeys}
            />

            <ApiKeyUpdateDialog
                open={updateDialogOpen}
                onOpenChange={setUpdateDialogOpen}
                onUpdateKey={handleUpdateKey}
                platforms={platforms}
                isLoading={isLoadingApiKeys}
                apiKey={selectedApiKey}
            />

            <ApiKeyDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onDeleteKey={handleDeleteKey}
                isLoading={isLoadingApiKeys}
                apiKey={selectedApiKey}
            />
        </div>
    );
};

export default ApiKeyList;