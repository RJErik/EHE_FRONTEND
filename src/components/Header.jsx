import { Button } from "./ui/button";
import { useAuth } from "../context/AuthContext";

const Header = ({ navigate, currentPage }) => {
    const { user, logout } = useAuth();

    const handleNavigation = (page) => {
        if (navigate) {
            navigate(page);
        }
    };

    const handleLogout = async () => {
        await logout();
        // Redirect to the unauthenticated app
        window.location.href = import.meta.env.VITE_UNAUTHENTICATED_APP_URL || '/';
    };

    return (
        <header className="bg-gray-700 text-white p-4 flex items-center justify-between">
            <div
                className="bg-gray-300 text-gray-700 p-3 rounded cursor-pointer"
                onClick={() => handleNavigation("home")}
            >
                Logo
            </div>

            <nav className="flex space-x-6">
                <span className="flex items-center mr-4">
                    Welcome, {user?.userName}!
                </span>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'account' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("account")}
                >
                    My Account
                </Button>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'portfolio' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("portfolio")}
                >
                    Portfolio
                </Button>
                {/* All other navigation buttons */}
                <Button
                    variant="ghost"
                    className="text-white hover:bg-red-700"
                    onClick={handleLogout}
                >
                    Logout
                </Button>
            </nav>
        </header>
    );
};

export default Header;
