// src/components/stockMarket/indicators/indicatorCalculations.js

// This is a stub - in a real app you'd use a proper TA library
export function calculateIndicator(indicator, candleData) {
    if (!candleData || candleData.length === 0) return [];

    const { type, settings } = indicator;

    switch (type) {
        case "sma":
            return calculateSMA(candleData, settings);
        case "ema":
            return calculateEMA(candleData, settings);
        case "rsi":
            return calculateRSI(candleData, settings);
        case "macd":
            return calculateMACD(candleData, settings);
        case "bb":
            return calculateBollingerBands(candleData, settings);
        case "atr":
            return calculateATR(candleData, settings);
        default:
            return [];
    }
}

function calculateSMA(data, settings) {
    const { period, source } = settings;
    const result = new Array(data.length).fill(null);

    console.log("SMA calculation called with:", settings);
    console.log("Data available for calculation:", data?.length || 0, "candles");

    // Add error checking
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error("Invalid data for SMA calculation");
        return [];
    }

    // For each point in the data
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        let validPoints = 0;

        // Look back 'period' candles to calculate average
        for (let j = 0; j < period; j++) {
            const value = data[i-j]?.[source];
            if (value !== null && value !== undefined && !isNaN(value)) {
                sum += value;
                validPoints++;
            }
        }

        // Only calculate average if we have enough valid points
        if (validPoints >= Math.ceil(period * 0.8)) { // At least 80% of required data
            result[i] = sum / validPoints;
        }
    }

    return result;
}



function calculateEMA(data, settings) {
    // Simplified calculation for demo
    return data.map(d => d.close * (0.8 + Math.random() * 0.4));
}

function calculateRSI(data, settings) {
    // Simplified calculation for demo
    return data.map(() => Math.random() * 100);
}

function calculateMACD(data, settings) {
    // Simplified calculation for demo
    return {
        macd: data.map(() => Math.random() * 10 - 5),
        signal: data.map(() => Math.random() * 10 - 5),
        histogram: data.map(() => Math.random() * 4 - 2)
    };
}

function calculateBollingerBands(data, settings) {
    // Simplified calculation for demo
    return {
        upper: data.map(d => d.close * 1.1),
        middle: data.map(d => d.close),
        lower: data.map(d => d.close * 0.9)
    };
}

function calculateATR(data, settings) {
    // Simplified calculation for demo
    return data.map(() => Math.random() * 5 + 1);
}
