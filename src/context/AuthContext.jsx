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
                    }
                }
            } catch (error) {
                console.error("Auth check failed:", error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Login function
    const login = (userData) => {
        setUser(userData);
    };

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

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
