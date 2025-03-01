import { useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast"

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            console.log('Response status:', response.status);
            const responseText = await response.text();

            if (response.ok) {
                toast({
                    title: "Login Successful",
                    description: "You have been logged in successfully!",
                });
            } else {
                // Try to parse error message as JSON, fallback to text
                let errorMessage = "Invalid credentials";
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorMessage;
                } catch {
                    errorMessage = responseText || errorMessage;
                }

                toast({
                    variant: "destructive",
                    title: "Login Failed",
                    description: errorMessage,
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "An error occurred during login",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-md mx-auto">
                <Card>
                    <CardHeader className="space-y-1 flex items-center">
                        <User className="w-12 h-12 mb-2" />
                        <CardTitle className="text-2xl text-center">Log In</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="••••••"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between">
                            <Button variant="outline">Cancel</Button>
                            <Button onClick={handleLogin} disabled={isLoading}>
                                {isLoading ? "Loading..." : "Log In"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LoginPage;
