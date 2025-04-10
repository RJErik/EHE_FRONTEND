// src/components/login/LoginForm.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Avatar, AvatarFallback } from "../ui/avatar.jsx";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { Label } from "../ui/label.jsx";
import { Alert, AlertTitle, AlertDescription } from "../Alert.jsx";

const LoginForm = ({ navigate }) => {
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing again
        if (error) setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
                credentials: 'include' // Important for cookies
            });

            const data = await response.json();

            if (data.success) {
                // Update auth context
                login({ userName: data.userName });

                // Redirect to stock market page
                navigate("stockMarket");
            } else {
                // Show error message
                setError(data.message || "Login failed. Please check your credentials.");
            }
        } catch (err) {
            setError("An error occurred. Please try again later.");
            console.error("Login error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        navigate("home");
    };

    return (
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
            <div className="flex flex-col items-center mb-6">
                <Avatar className="h-16 w-16 mb-4">
                    <AvatarFallback className="bg-gray-200">
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

                <h1 className="text-2xl font-bold text-gray-900">Log In</h1>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={isLoading}
                        required
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={isLoading}
                        required
                    />
                </div>

                <div className="flex justify-between pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        className="bg-gray-700 hover:bg-gray-800 text-white"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Logging in...
                            </span>
                        ) : "Log In"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default LoginForm;
