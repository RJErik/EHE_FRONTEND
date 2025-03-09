import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check authentication status on app startup
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/status', {
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.authenticated) {
                        setUser({ userName: data.userName });
                    } else {
                        // Redirect to unauthenticated app if not logged in
                        window.location.href = import.meta.env.VITE_UNAUTHENTICATED_APP_URL || '/';
                    }
                } else {
                    // Redirect on API failure
                    window.location.href = import.meta.env.VITE_UNAUTHENTICATED_APP_URL || '/';
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                window.location.href = import.meta.env.VITE_UNAUTHENTICATED_APP_URL || '/';
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Logout function
    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            setUser(null);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
