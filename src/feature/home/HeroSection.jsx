// src/components/home/HeroSection.jsx
import { useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { Avatar, AvatarFallback } from "../../components/ui/avatar.jsx";
import LogoutDialog from "../LogoutDialog.jsx";
import { useLogout } from "../../hooks/useLogout.js";

const HeroSection = () => {
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const { logout, isLoading } = useLogout();

    const handleLogoutClick = () => {
        setLogoutDialogOpen(true);
    };

    const handleLogoutConfirm = async () => {
        await logout();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
            <h1 className="text-4xl font-semibold mb-2">Event Horizon Exchange</h1>
            <p className="text-xl mb-12">A powerful stocktrading platform</p>

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
            </div>

            <div className="flex space-x-4">
                <Button
                    className="min-w-[120px]"
                    onClick={handleLogoutClick}
                >
                    Log Out
                </Button>
            </div>

            <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                onConfirm={handleLogoutConfirm}
                isLoading={isLoading}
            />
        </div>
    );
};

export default HeroSection;
