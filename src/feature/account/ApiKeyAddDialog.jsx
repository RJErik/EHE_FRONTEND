// src/components/account/ApiKeyAddDialog.jsx
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "../../components/ui/dialog.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select.jsx";
import { Loader2 } from "lucide-react";

const ApiKeyAddDialog = ({ open, onOpenChange, onAddKey, platforms, isLoading }) => {
    const [platformName, setPlatformName] = useState("");
    const [apiKeyValue, setApiKeyValue] = useState("");
    const [secretKey, setSecretKey] = useState(""); // Added state for secret key

    const handleAddKey = () => {
        onAddKey(platformName, apiKeyValue, secretKey); // Pass secretKey to onAddKey
        // Reset form
        setPlatformName("");
        setApiKeyValue("");
        setSecretKey("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add API Key</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="platform" className="text-right">
                            Platform
                        </label>
                        <div className="col-span-3">
                            <Select value={platformName} onValueChange={setPlatformName}>
                                <SelectTrigger id="platform">
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    {platforms.map((platform) => (
                                        <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="apiKey" className="text-right">
                            API Key
                        </label>
                        <Input
                            id="apiKey"
                            className="col-span-3"
                            value={apiKeyValue}
                            onChange={(e) => setApiKeyValue(e.target.value)}
                            placeholder="Enter your API key"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label htmlFor="secretKey" className="text-right">
                            Secret Key
                        </label>
                        <Input
                            id="secretKey"
                            className="col-span-3"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            placeholder="Enter your secret key"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleAddKey} disabled={!platformName || !apiKeyValue || !secretKey || isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            "Add"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ApiKeyAddDialog;
