// src/utils/mockDataGenerator.js

export function generateMockCandleData(numCandles = 100, tickerSymbol = "AAPL") {
    const data = [];
    const now = new Date();
    let price = Math.random() * 100 + 50; // Starting price between 50-150

    for (let i = 0; i < numCandles; i++) {
        // Generate random price movements
        const volatility = (Math.random() * 2) + 0.5;
        const changePercent = (Math.random() * volatility) - (volatility / 2);
        const open = price;
        price = price * (1 + changePercent / 100);

        // Create a random high/low around the open/close prices
        const high = Math.max(open, price) * (1 + (Math.random() * 0.5) / 100);
        const low = Math.min(open, price) * (1 - (Math.random() * 0.5) / 100);

        // Create timestamp (going backwards from now)
        const timestamp = new Date(now);
        timestamp.setHours(now.getHours() - (numCandles - i));

        // Create volume (higher on bigger price moves)
        const volume = Math.abs(changePercent) * (Math.random() * 5000 + 10000);

        data.push({
            timestamp,
            open,
            high,
            low,
            close: price,
            volume,
            ticker: tickerSymbol
        });
    }

    return data;
}

// Function to simulate real-time updates
export function generateNewCandle(lastCandle) {
    const lastClose = lastCandle.close;
    const volatility = (Math.random() * 2) + 0.5;
    const changePercent = (Math.random() * volatility) - (volatility / 2);
    const open = lastClose;
    const close = lastClose * (1 + changePercent / 100);

    const high = Math.max(open, close) * (1 + (Math.random() * 0.5) / 100);
    const low = Math.min(open, close) * (1 - (Math.random() * 0.5) / 100);

    const timestamp = new Date(lastCandle.timestamp);
    timestamp.setHours(timestamp.getHours() + 1);

    const volume = Math.abs(changePercent) * (Math.random() * 5000 + 10000);

    return {
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        ticker: lastCandle.ticker
    };
}
