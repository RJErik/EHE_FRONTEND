import Header from "../components/Header";
import AccountProfile from "../components/account/AccountProfile.jsx";
import ApiKeyManager from "../components/account/ApiKeyManager.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

const Account = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="account" />

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
                        <AccountProfile navigate={navigate} />
                    </div>

                    <div className="w-full md:w-1/2 md:border-t md:border-t-0 md:border-l pt-8 md:pt-0 md:pl-8">
                        <ApiKeyManager />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Account;
