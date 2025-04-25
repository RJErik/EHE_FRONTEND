import { useState, useEffect } from "react";

export function useStockData() {
    const [platforms, setPlatforms] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [selectedPlatform, setSelectedPlatform] = useState("");
    const [selectedStock, setSelectedStock] = useState("");
    const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(false);
    const [isLoadingStocks, setIsLoadingStocks] = useState(false);
    const [error, setError] = useState(null);

    // Fetch platforms on component mount
    useEffect(() => {
        fetchPlatforms();
    }, []);

    // Fetch stocks when selected platform changes
    useEffect(() => {
        if (selectedPlatform) {
            fetchStocks(selectedPlatform);
            setSelectedStock(""); // Reset stock selection when platform changes
        } else {
            // Clear stocks when no platform is selected
            setStocks([]);
            setSelectedStock("");
        }
    }, [selectedPlatform]);

    // Fetch platforms from API
    const fetchPlatforms = async () => {
        setIsLoadingPlatforms(true);
        setError(null);

        try {
            const response = await fetch("http://localhost:8080/api/user/platforms", {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = await response.json();

            if (data.success) {
                setPlatforms(data.platforms || []);
            } else {
                setError(data.message || "Failed to fetch platforms");
                setPlatforms([]);
            }
        } catch (err) {
            console.error("Error fetching platforms:", err);
            setError("Failed to fetch platforms. Please try again later.");
            setPlatforms([]);
        } finally {
            setIsLoadingPlatforms(false);
        }
    };

    // Fetch stocks for a specific platform
    const fetchStocks = async (platform) => {
        if (!platform) return;

        setIsLoadingStocks(true);
        setError(null);
        setStocks([]); // Clear previous stocks while loading

        try {
            const response = await fetch("http://localhost:8080/api/user/stocks", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ platform }),
            });

            const data = await response.json();

            if (data.success) {
                setStocks(data.stocks || []);
            } else {
                setError(data.message || "Failed to fetch stocks");
                setStocks([]);
            }
        } catch (err) {
            console.error("Error fetching stocks:", err);
            setError("Failed to fetch stocks. Please try again later.");
            setStocks([]);
        } finally {
            setIsLoadingStocks(false);
        }
    };

    return {
        platforms,
        stocks,
        selectedPlatform,
        setSelectedPlatform,
        selectedStock,
        setSelectedStock,
        isLoadingPlatforms,
        isLoadingStocks,
        error,
        fetchPlatforms,
    };
}
