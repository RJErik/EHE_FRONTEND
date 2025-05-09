// src/components/account/ApiKeyAddDialog.jsx
import { useState } from "react";
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

const ApiKeyAddDialog = ({ open, onOpenChange, onAddKey, platforms, isLoading }) => {
    const [platformName, setPlatformName] = useState("");
    const [apiKeyValue, setApiKeyValue] = useState("");

    const handleAddKey = () => {
        onAddKey(platformName, apiKeyValue);
        // Reset form
        setPlatformName("");
        setApiKeyValue("");
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
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleAddKey} disabled={!platformName || !apiKeyValue || isLoading}>
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
