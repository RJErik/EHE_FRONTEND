// src/hooks/usePortfolio.js
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./use-toast";

export function usePortfolio() {
    const [portfolios, setPortfolios] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { toast } = useToast();

    // Fetch all portfolios
    const fetchPortfolios = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            console.log("Fetching portfolios...");
            const response = await fetch("http://localhost:8080/api/user/portfolio", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to fetch portfolios. Server may be unavailable.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    // Add a new portfolio
    const createPortfolio = async (portfolioName, apiKeyId) => {
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
            const response = await fetch("http://localhost:8080/api/user/portfolio/create", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ portfolioName, apiKeyId }),
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Create response:", data);

            if (data.success) {
                toast({
                    title: "Success",
                    description: `Created portfolio: ${portfolioName}`,
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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to create portfolio. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Delete a portfolio
    const deletePortfolio = async (portfolioId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Deleting portfolio ${portfolioId}...`);
            const response = await fetch("http://localhost:8080/api/user/portfolio/delete", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ portfolioId }),
            });

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
                    description: "Portfolio deleted successfully",
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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to delete portfolio. Server may be unavailable.",
                variant: "destructive",
            });
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Search portfolios
    const searchPortfolios = async (type, platform, minValue, maxValue) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`Searching portfolios: type=${type}, platform=${platform}, minValue=${minValue}, maxValue=${maxValue}`);
            const response = await fetch("http://localhost:8080/api/user/portfolio/search", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type,
                    platform,
                    minValue,
                    maxValue
                }),
            });

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
            setError("Failed to connect to server. Please try again later.");
            toast({
                title: "Connection Error",
                description: "Failed to search portfolios. Server may be unavailable.",
                variant: "destructive",
            });
            return [];
        } finally {
            setIsLoading(false);
        }
    };

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
        createPortfolio,
        deletePortfolio,
        searchPortfolios,
    };
}
