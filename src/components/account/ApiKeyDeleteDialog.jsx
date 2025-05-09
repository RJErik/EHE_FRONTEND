// src/components/account/ApiKeyDeleteDialog.jsx
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "../ui/dialog.jsx";
import { Button } from "../ui/button.jsx";
import { Loader2 } from "lucide-react";

const ApiKeyDeleteDialog = ({ open, onOpenChange, onDeleteKey, isLoading, apiKey }) => {
    const handleDeleteKey = () => {
        onDeleteKey(apiKey.apiKeyId);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Delete API Key</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the API key for {apiKey?.platformName}? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteKey} disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            "Delete"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ApiKeyDeleteDialog;
