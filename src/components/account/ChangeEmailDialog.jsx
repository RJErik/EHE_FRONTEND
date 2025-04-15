// src/components/account/ChangeEmailDialog.jsx
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChangeEmailDialog({ open, onOpenChange, onConfirm, isLoading, initialEmail = "" }) {
    const [email, setEmail] = useState(initialEmail);
    const [isValid, setIsValid] = useState(true);

    // Update email state when initialEmail prop changes
    useEffect(() => {
        if (initialEmail) {
            setEmail(initialEmail);
        }
    }, [initialEmail]);

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setEmail(initialEmail || "");
            setIsValid(true);
        }
    }, [open, initialEmail]);

    // Basic email validation
    const validateEmail = (email) => {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    };

    const handleEmailChange = (e) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        setIsValid(validateEmail(newEmail) || newEmail === "");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateEmail(email)) {
            onConfirm(email);
        } else {
            setIsValid(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Email Address</DialogTitle>
                    <DialogDescription>
                        Enter your new email address. You'll need to verify this email before the change takes effect.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium leading-none">New Email Address</p>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                placeholder="your-new-email@example.com"
                                className={!isValid ? "border-destructive" : ""}
                                autoComplete="email"
                            />
                            {!isValid && (
                                <p className="text-destructive text-sm">
                                    Please enter a valid email address
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !email || !isValid}
                        >
                            {isLoading ? "Submitting..." : "Change Email"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
