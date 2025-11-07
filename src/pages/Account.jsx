import AccountProfile from "@/feature/account/AccountProfile.jsx";
import ApiKeyList from "@/feature/account/ApiKeyList.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button.jsx";
import DeactivateAccountDialog from "@/feature/account/DeactivateAccountDialog.jsx";
import { useDeactivateAccount } from "../../hooks/useDeactivateAccount.js";
import { useState } from "react";

const Account = () => {
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
    const { deactivateAccount, isLoading: isDeactivating } = useDeactivateAccount();

    const handleDeactivateClick = () => {
        setDeactivateDialogOpen(true);
    };

    const handleDeactivateConfirm = async () => {
        await deactivateAccount();
    };

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <div className="flex flex-col items-center mb-8">
                    <Avatar className="h-16 w-16 mb-4">
                        <AvatarFallback>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-10 w-10"
                            >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </AvatarFallback>
                    </Avatar>

                    <h1 className="text-4xl font-semibold mb-8">My Account</h1>
                </div>

                <div className="container mx-auto flex flex-col md:flex-row">
                    <div className="w-full md:w-1/2 md:pr-8 mb-8 md:mb-0">
                        <AccountProfile  />
                    </div>

                    <div className="w-full md:w-1/2 md:border-t md:border-l pt-8 md:pt-0 md:pl-8">
                        <ApiKeyList />
                    </div>
                </div>

                <div className="container mx-auto mt-8">
                    <Button
                        variant="destructive"
                        onClick={handleDeactivateClick}
                        className="w-full"
                    >
                        Deactivate Account
                    </Button>
                </div>
            </main>

            <DeactivateAccountDialog
                open={deactivateDialogOpen}
                onOpenChange={setDeactivateDialogOpen}
                onConfirm={handleDeactivateConfirm}
                isLoading={isDeactivating}
            />
        </div>
    );
};

export default Account;