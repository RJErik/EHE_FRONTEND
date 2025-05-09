// src/components/account/ApiKeyUpdateDialog.jsx
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "../ui/dialog.jsx";
import { Button } from "../ui/button.jsx";
import { Input } from "../ui/input.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select.jsx";
import { Loader2 } from "lucide-react";

const ApiKeyUpdateDialog = ({ open, onOpenChange, onUpdateKey, platforms, isLoading, apiKey }) => {
    const [platformName, setPlatformName] = useState("");
    const [apiKeyValue, setApiKeyValue] = useState("");

    // Set initial values when dialog opens with an API key
    useEffect(() => {
        if (apiKey && open) {
            setPlatformName(apiKey.platformName || "");
            setApiKeyValue(""); // Don't pre-fill the API key for security
        }
    }, [apiKey, open]);

    const handleUpdateKey = () => {
        onUpdateKey(apiKey.apiKeyId, platformName, apiKeyValue);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update API Key</DialogTitle>
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
                            placeholder="Enter new API key value"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleUpdateKey} disabled={!platformName || !apiKeyValue || isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            "Update"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ApiKeyUpdateDialog;
