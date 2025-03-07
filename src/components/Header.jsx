import { Button } from "./ui/button";

const Header = ({ navigate, currentPage }) => {
    const handleNavigation = (page) => {
        if (navigate) {
            navigate(page);
        }
    };

    return (
        <header className="bg-gray-700 text-white p-4 flex items-center justify-between">
            <div className="bg-gray-300 text-gray-700 p-3 rounded">Logo</div>
            <nav className="flex space-x-6">
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
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'stockMarket' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("stockMarket")}
                >
                    Stock Market
                </Button>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'paperTrading' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("paperTrading")}
                >
                    Paper Trading
                </Button>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'alerts' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("alerts")}
                >
                    Alerts
                </Button>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'automaticTransactions' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("automaticTransactions")}
                >
                    Automatic Transactions
                </Button>
                <Button
                    variant="ghost"
                    className={`text-white ${currentPage === 'watchlist' ? 'bg-gray-600' : ''}`}
                    onClick={() => handleNavigation("watchlist")}
                >
                    Watchlist
                </Button>
            </nav>
        </header>
    );
};

export default Header;
