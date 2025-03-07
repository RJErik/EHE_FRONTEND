import { Avatar, AvatarFallback } from "./ui/avatar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

const AccountProfile = ({ userData, navigate }) => {
    const handleLogout = () => {
        if (navigate) {
            navigate("home");
        }
    };

    return (
        <div className="flex flex-col items-start space-y-4">
            <div className="w-full">
                <p className="text-sm text-gray-500 mb-1">Name</p>
                <div className="flex">
                    <div className="bg-gray-500 p-2 flex items-center justify-center">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-gray-500 text-white">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <Input
                        value={userData.name}
                        disabled
                        className="rounded-none border-l-0"
                    />
                </div>
            </div>

            <div className="w-full">
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <div className="flex">
                    <div className="bg-gray-500 p-2 flex items-center justify-center">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-gray-500 text-white">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <Input
                        value={userData.email}
                        disabled
                        className="rounded-none border-l-0"
                    />
                </div>
            </div>

            <Button variant="outline" className="w-full max-w-[200px]">
                Change Email
            </Button>

            <Button variant="outline" className="w-full max-w-[200px]">
                Change Password
            </Button>

            <div className="mt-auto pt-8 w-full max-w-[200px]">
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
                >
                    Log Out
                </Button>
            </div>
        </div>
    );
};

export default AccountProfile;
