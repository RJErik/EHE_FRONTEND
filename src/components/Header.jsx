// src/components/Header.jsx
import { useState } from "react";
import { Button } from "./ui/button";
import { ModeToggle } from "@/components/Mode-toggle.jsx";
import { Menubar } from "./ui/menubar";
import LogoutDialog from "./LogoutDialog";
import { useLogout } from "../hooks/useLogout";

const Header = ({ navigate, currentPage, userName = "User" }) => {
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const { logout, isLoading } = useLogout();

    const handleNavigation = (page) => {
        if (navigate) {
            navigate(page);
        }
    };

    const handleLogoutClick = () => {
        setLogoutDialogOpen(true);
    };

    const handleLogoutConfirm = async () => {
        await logout();
    };

    return (
        <>
            <Menubar className="py-7 px-7 flex items-center justify-between">
                <Button
                    variant="outline"
                    size="icon"
                    className="cursor-pointer h-10 w-10"
                    onClick={() => handleNavigation("home")}
                >
                    Logo
                </Button>

                <div className="flex items-center space-x-4">
                    <nav className="flex space-x-6">
                        <Button
                            variant="outline"
                            className={currentPage === 'home' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("home")}
                        >
                            Home
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'account' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("account")}
                        >
                            My Account
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'portfolio' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("portfolio")}
                        >
                            Portfolio
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'stockMarket' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("stockMarket")}
                        >
                            Stock Market
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'paperTrading' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("paperTrading")}
                        >
                            Paper Trading
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'alerts' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("alerts")}
                        >
                            Alerts
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'automaticTransactions' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("automaticTransactions")}
                        >
                            Automatic Transactions
                        </Button>
                        <Button
                            variant="outline"
                            className={currentPage === 'watchlist' ? 'bg-muted' : ''}
                            onClick={() => handleNavigation("watchlist")}
                        >
                            Watchlist
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleLogoutClick}
                        >
                            Logout
                        </Button>
                        <ModeToggle />
                    </nav>
                </div>
            </Menubar>

            <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                onConfirm={handleLogoutConfirm}
                isLoading={isLoading}
            />
        </>
    );
};

export default Header;
