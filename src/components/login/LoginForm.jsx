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
    const [success, setSuccess] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

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

                // Show success message briefly
                setSuccess("Login successful! Redirecting...");

                // Redirect after a short delay
                setTimeout(() => {
                    navigate("stockMarket");
                }, 1000);
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
        <div className="max-w-md mx-auto mt-8 flex flex-col items-center">
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

            <h1 className="text-4xl font-semibold text-gray-600 mb-8">Log In</h1>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert variant="success">
                    <AlertTitle>Success!</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-6">
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
                        className="bg-gray-500 hover:bg-gray-600"
                        disabled={isLoading}
                    >
                        {isLoading ? "Logging in..." : "Log In"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default LoginForm;
