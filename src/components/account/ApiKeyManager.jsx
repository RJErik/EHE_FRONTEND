// src/components/account/ApiKeyManager.jsx
import { useState } from "react";
import { Button } from "../ui/button.jsx";
import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import DeactivateAccountDialog from "./DeactivateAccountDialog.jsx";
import { useDeactivateAccount } from "../../hooks/useDeactivateAccount.js";

const ApiKeyManager = () => {
    // Placeholder for API keys - this would be populated with real data in a production app
    const apiKeys = [];
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
    const { deactivateAccount, isLoading } = useDeactivateAccount();

    const handleDeactivateClick = () => {
        setDeactivateDialogOpen(true);
    };

    const handleDeactivateConfirm = async () => {
        await deactivateAccount();
    };

    return (
        <div className="flex flex-col h-full">
            <Card className="flex-1 mb-4">
                <CardHeader className="text-center">
                    <h3>List of current API keys</h3>
                </CardHeader>
                <CardContent>
                    {apiKeys.length > 0 ? (
                        <ul>
                            {apiKeys.map((key, index) => (
                                <li key={index}>{key}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground">No API keys found</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex space-x-4 mb-4">
                <Button variant="outline" className="flex-1">
                    Delete
                </Button>
                <Button className="flex-1">
                    Add
                </Button>
            </div>

            <Button
                variant="destructive"
                onClick={handleDeactivateClick}
                className="w-full"
            >
                Deactivate Account
            </Button>

            <DeactivateAccountDialog
                open={deactivateDialogOpen}
                onOpenChange={setDeactivateDialogOpen}
                onConfirm={handleDeactivateConfirm}
                isLoading={isLoading}
            />
        </div>
    );
};

export default ApiKeyManager;
