// src/components/Header.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button.jsx";
import { ModeToggle } from "@/feature/Mode-toggle.jsx";
import { Menubar } from "../components/ui/menubar.jsx";
import LogoutDialog from "./LogoutDialog.jsx";
import { useLogout } from "../hooks/useLogout.js";
import Logo from "../assets/Logo.png";

const Header = ({ userName = "User" }) => {
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const { logout, isLoading } = useLogout();
    const navigate = useNavigate();
    const location = useLocation();

    // Helper function to determine current page from URL
    const getCurrentPage = () => {
        const path = location.pathname;
        switch (path) {
            case '/': return 'home';
            case '/account': return 'account';
            case '/portfolio': return 'portfolio';
            case '/stock-market': return 'stockMarket';
            case '/alerts': return 'alerts';
            case '/automatic-transactions': return 'automaticTransactions';
            case '/watchlist': return 'watchlist';
            default: return 'home';
        }
    };

    const currentPage = getCurrentPage();

    const handleNavigation = (page) => {
        const pathMap = {
            'home': '/',
            'account': '/account',
            'portfolio': '/portfolio',
            'stockMarket': '/stock-market',
            'alerts': '/alerts',
            'automaticTransactions': '/automatic-transactions',
            'watchlist': '/watchlist'
        };

        const path = pathMap[page] || '/';
        navigate(path);
    };

    const handleLogoutClick = () => {
        setLogoutDialogOpen(true);
    };

    const handleLogoutConfirm = async () => {
        await logout();
    };

    return (
        <>
            <Menubar className="py-7 px-7 flex items-center justify-between fixed w-full z-50 top-0 left-0 right-0 bg-background">
                <Button
                    variant="outline"
                    size="icon"
                    className="cursor-pointer h-10 w-10"
                    onClick={() => handleNavigation("home")}
                >
                    <img src={Logo} className="rotating-image" alt="Logo"/>
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