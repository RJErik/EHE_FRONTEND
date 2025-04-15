// src/components/account/AccountProfile.jsx
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import LogoutDialog from "../LogoutDialog";
import ChangeEmailDialog from "./ChangeEmailDialog.jsx";
import { useLogout } from "../../hooks/useLogout";
import { useChangeEmail } from "../../hooks/useChangeEmail";
import { useToast } from "@/hooks/use-toast.js";

const AccountProfile = ({ navigate }) => {
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
    const [isRequestingReset, setIsRequestingReset] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userData, setUserData] = useState({
        name: "Your_Name",
        email: "Your_Email"
    });

    const { logout, isLoading: isLoggingOut } = useLogout();
    const { changeEmail, resendChangeEmail, isLoading: isChangingEmail, lastEmailRequested } = useChangeEmail();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUserInfo = async () => {
            setIsLoading(true);
            try {
                const response = await fetch("http://localhost:8080/api/user/info", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch user data");
                }

                const data = await response.json();

                if (data.success) {
                    setUserData({
                        name: data.userName || "Your_Name",
                        email: data.email || "Your_Email"
                    });
                } else {
                    toast({
                        title: "Error",
                        description: data.message || "Failed to load user information",
                        variant: "destructive",
                    });
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                toast({
                    title: "Error",
                    description: "Failed to load user information. Using placeholder data.",
                    variant: "destructive",
                });
                // Keep the default placeholder data
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserInfo();
    }, [toast]);

    const handleLogoutClick = () => {
        setLogoutDialogOpen(true);
    };

    const handleLogoutConfirm = async () => {
        await logout();
    };

    const handleChangeEmailClick = () => {
        setChangeEmailDialogOpen(true);
    };

    const handleChangeEmailConfirm = async (newEmail) => {
        const result = await changeEmail(newEmail);
        console.log("Email change result:", result);
        console.log("Stored email for resend:", lastEmailRequested);

        // Always ensure we show the resend button if this was a success
        const shouldShowResendButton = result.success || result.showResendButton;

        // Display the appropriate toast based on the response
        toast({
            title: result.success ? "Email Change Requested" : "Error",
            description: result.message,
            variant: result.success ? "default" : "destructive",
            duration: 5000,
            action: shouldShowResendButton ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendEmail}
                    className="mt-2"
                >
                    Resend Verification Email
                </Button>
            ) : undefined,
        });

        if (result.success) {
            setChangeEmailDialogOpen(false);
        }
    };

    const handleResendEmail = async () => {
        console.log("Resending email with:", lastEmailRequested);
        const result = await resendChangeEmail();
        console.log("Resend result:", result);

        toast({
            title: result.success ? "Email Sent" : "Error",
            description: result.message,
            variant: result.success ? "default" : "destructive",
            duration: 5000,
            action: (result.success || result.showResendButton) ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendEmail}
                    className="mt-2"
                >
                    Resend Verification Email
                </Button>
            ) : undefined,
        });
    };

    const handleChangePassword = async () => {
        if (isRequestingReset) return;

        setIsRequestingReset(true);

        try {
            const response = await fetch("http://localhost:8080/api/user/request-password-reset", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            toast({
                title: data.success ? "Success" : "Error",
                description: data.message,
                variant: data.success ? "default" : "destructive",
                action: data.showResendButton ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangePassword}
                        className="mt-2"
                    >
                        Resend Reset Email
                    </Button>
                ) : undefined,
            });

        } catch (err) {
            console.error("Password reset request error:", err);
            toast({
                title: "Error",
                description: "Failed to request password reset. Please try again later.",
                variant: "destructive",
            });
        } finally {
            setIsRequestingReset(false);
        }
    };

    return (
        <div className="flex flex-col items-start space-y-4">
            <div className="w-full">
                <p className="text-sm text-muted-foreground mb-1">Name</p>
                <div className="flex">
                    <div className="bg-primary p-2 flex items-center justify-center">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary text-primary-foreground">
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
                        value={isLoading ? "Loading..." : userData.name}
                        disabled
                        className="rounded-none border-l-0"
                    />
                </div>
            </div>

            <div className="w-full">
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <div className="flex">
                    <div className="bg-primary p-2 flex items-center justify-center">
                        <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary text-primary-foreground">
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
                        value={isLoading ? "Loading..." : userData.email}
                        disabled
                        className="rounded-none border-l-0"
                    />
                </div>
            </div>

            <Button
                variant="outline"
                className="w-full max-w-[200px]"
                onClick={handleChangePassword}
                disabled={isRequestingReset}
            >
                {isRequestingReset ? "Requesting..." : "Change Password"}
            </Button>

            <Button
                variant="outline"
                className="w-full max-w-[200px]"
                onClick={handleChangeEmailClick}
                disabled={isChangingEmail}
            >
                {isChangingEmail ? "Processing..." : "Change Email"}
            </Button>

            <div className="mt-auto pt-8 w-full max-w-[200px]">
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogoutClick}
                >
                    Log Out
                </Button>
            </div>

            <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                onConfirm={handleLogoutConfirm}
                isLoading={isLoggingOut}
            />

            <ChangeEmailDialog
                open={changeEmailDialogOpen}
                onOpenChange={setChangeEmailDialogOpen}
                onConfirm={handleChangeEmailConfirm}
                isLoading={isChangingEmail}
                initialEmail={lastEmailRequested}
            />
        </div>
    );
};

export default AccountProfile;
