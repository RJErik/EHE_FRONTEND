import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog.jsx"
import { Button } from "@/components/ui/button.jsx";

export default function DeactivateAccountDialog({ open, onOpenChange, onConfirm, isLoading }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Confirm Account Deactivation</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to deactivate your account? This action will suspend your account and you'll need to contact support to reactivate it.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
                        {isLoading ? "Deactivating..." : "Deactivate Account"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
