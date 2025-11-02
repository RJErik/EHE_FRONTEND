// src/hooks/usePortfolio.js
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";
import { useJwtRefresh } from "./useJwtRefresh";

export function usePortfolio() {
    const [portfolios, setPortfolios] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();
    const { refreshToken } = useJwtRefresh();

    // Fetch all portfolios
    const fetchPortfolios = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching portfolios...");
            let response = await fetch("http://localhost:8080/api/user/portfolios", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/portfolios", {
                    method: "GET",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Portfolios received:", data);

            if (data.success) {
                setPortfolios(data.portfolios || []);
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch portfolios",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch portfolios");
            }
        } catch (err) {
            console.error("Error fetching portfolios:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch portfolios. Server may be unavailable.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Fetch portfolio details
    const fetchPortfolioDetails = useCallback(async (portfolioId) => {
        if (!portfolioId) {
            toast({
                title: "Validation Error",
                description: "Portfolio ID is required",
                variant: "destructive",
            });
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`Fetching portfolio details for ID: ${portfolioId}...`);
            let response = await fetch(`http://localhost:8080/api/user/portfolios/details`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    portfolioId: portfolioId
                }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch(`http://localhost:8080/api/user/portfolios/details`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        portfolioId: portfolioId
                    }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Portfolio details received:", data);

            if (data.success) {
                return data.portfolio;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to fetch portfolio details",
                    variant: "destructive",
                });
                setError(data.message || "Failed to fetch portfolio details");
                return null;
            }
        } catch (err) {
            console.error("Error fetching portfolio details:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to fetch portfolio details. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Add a new portfolio
    const createPortfolio = useCallback(async (portfolioName, apiKeyId) => {
        if (!portfolioName || !apiKeyId) {
            toast({
                title: "Validation Error",
                description: "Portfolio name and API key are required",
                variant: "destructive",
            });
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log(`Creating portfolio ${portfolioName} with API key ID ${apiKeyId}...`);
            let response = await fetch("http://localhost:8080/api/user/portfolios", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ portfolioName, apiKeyId }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/portfolios", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ portfolioName, apiKeyId }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Create response:", data);

            if (data.success) {
                toast({
                    title: "Success",
                    description: data.message || `Created portfolio: ${portfolioName}`,
                });

                // Add the new portfolio to the state
                if (data.portfolio) {
                    setPortfolios(prev => [...prev, data.portfolio]);
                }

                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to create portfolio",
                    variant: "destructive",
                });
                setError(data.message || "Failed to create portfolio");
                return false;
            }
        } catch (err) {
            console.error("Error creating portfolio:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to create portfolio. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Delete a portfolio
    const deletePortfolio = useCallback(async (portfolioId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Deleting portfolio ${portfolioId}...`);
            let response = await fetch("http://localhost:8080/api/user/portfolios", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ portfolioId }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/portfolios", {
                    method: "DELETE",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ portfolioId }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Delete response:", data);

            if (data.success) {
                // First update local state for immediate UI feedback
                setPortfolios(prev => prev.filter(portfolio => portfolio.id !== portfolioId));

                toast({
                    title: "Success",
                    description: data.message || "Portfolio deleted successfully",
                });

                return true;
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to delete portfolio",
                    variant: "destructive",
                });
                setError(data.message || "Failed to delete portfolio");
                return false;
            }
        } catch (err) {
            console.error("Error deleting portfolio:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to delete portfolio. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Search portfolios
    const searchPortfolios = useCallback(async (platform, minValue, maxValue) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Searching portfolios: platform=${platform}, minValue=${minValue}, maxValue=${maxValue}`);
            let response = await fetch("http://localhost:8080/api/user/portfolios/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    platform,
                    minValue,
                    maxValue
                }),
            });

            // Handle 401 - Token expired
            if (response.status === 401) {
                try {
                    await refreshToken();
                } catch (refreshError) {
                    throw new Error("Session expired. Please login again.");
                }

                // Retry the original request
                response = await fetch("http://localhost:8080/api/user/portfolios/search", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        platform,
                        minValue,
                        maxValue
                    }),
                });

                if (response.status === 401) {
                    throw new Error("Session expired. Please login again.");
                }
            }

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Search results:", data);

            if (data.success) {
                setPortfolios(data.portfolios || []);
                return data.portfolios || [];
            } else {
                toast({
                    title: "Error",
                    description: data.message || "Failed to search portfolios",
                    variant: "destructive",
                });
                setError(data.message || "Failed to search portfolios");
                return [];
            }
        } catch (err) {
            console.error("Error searching portfolios:", err);
            if (!err.message?.includes("Session expired")) {
                setError("Failed to connect to server. Please try again later.");
                toast({
                    title: "Connection Error",
                    description: "Failed to search portfolios. Server may be unavailable.",
                    variant: "destructive",
                });
            }
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [toast, refreshToken]);

    // Initial fetch
    useEffect(() => {
        console.log("Initial portfolios fetch...");
        fetchPortfolios();
    }, [fetchPortfolios]);

    return {
        portfolios,
        isLoading,
        error,
        fetchPortfolios,
        fetchPortfolioDetails,
        createPortfolio,
        deletePortfolio,
        searchPortfolios,
    };
}