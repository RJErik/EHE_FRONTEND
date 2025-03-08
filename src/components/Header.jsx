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
        navigate("home");
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
                {user ? (
                    <>
                        <span className="flex items-center mr-4">
                            Welcome, {user.userName}!
                        </span>
                        <Button
                            variant="ghost"
                            className={`text-white ${currentPage === 'stockMarket' ? 'bg-gray-600' : ''}`}
                            onClick={() => handleNavigation("stockMarket")}
                        >
                            Stock Market
                        </Button>
                        <Button
                            variant="ghost"
                            className={`text-white ${currentPage === 'portfolio' ? 'bg-gray-600' : ''}`}
                            onClick={() => handleNavigation("portfolio")}
                        >
                            Portfolio
                        </Button>
                        <Button
                            variant="ghost"
                            className={`text-white ${currentPage === 'account' ? 'bg-gray-600' : ''}`}
                            onClick={() => handleNavigation("account")}
                        >
                            My Account
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-red-700"
                            onClick={handleLogout}
                        >
                            Logout
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="ghost"
                            className="text-white"
                            onClick={() => handleNavigation("login")}
                        >
                            Login
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-white"
                            onClick={() => handleNavigation("register")}
                        >
                            Register
                        </Button>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Header;
