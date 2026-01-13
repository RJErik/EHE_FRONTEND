import { useState, useEffect } from 'react';

function AuthCheck({ children }) {
    const [authState, setAuthState] = useState({
        isLoading: true,
        isAuthenticated: false
    });

    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await fetch('/api/session', {
                    method: 'GET',
                    credentials: 'include', // Include cookies in request
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Authentication failed');
                }

                setAuthState({ isLoading: false, isAuthenticated: true });
            } catch (error) {
                console.error('Authentication failed:', error);
                window.location.href = 'https://www.eventhorizonexchange.com';
            }
        };

        verifyAuth();
    }, []);

    if (authState.isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg">Verifying authentication...</p>
                </div>
            </div>
        );
    }

    // Only render children if authenticated
    return children;
}

export default AuthCheck;