// src/components/stockMarket/indicators/indicatorCalculations.js

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
    const { period = 14, source = 'close' } = settings;
    const result = new Array(data.length).fill(null);

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
    const { period = 14, source = 'close' } = settings;
    const result = new Array(data.length).fill(null);

    // Calculate multiplier
    const multiplier = 2 / (period + 1);

    // Find first valid SMA as starting point
    let firstValidIndex = period - 1;
    let sum = 0;

    for (let i = 0; i < period; i++) {
        const value = data[i]?.[source];
        if (value !== null && value !== undefined && !isNaN(value)) {
            sum += value;
        }
    }

    // Initialize first EMA with SMA
    result[firstValidIndex] = sum / period;

    // Calculate EMA for remaining points
    for (let i = firstValidIndex + 1; i < data.length; i++) {
        const currentValue = data[i]?.[source];
        if (currentValue !== null && currentValue !== undefined && !isNaN(currentValue) && result[i-1] !== null) {
            // EMA = Current price × multiplier + Previous EMA × (1 - multiplier)
            result[i] = currentValue * multiplier + result[i-1] * (1 - multiplier);
        }
    }

    return result;
}

function calculateRSI(data, settings) {
    const { period = 14, source = 'close' } = settings;
    const result = new Array(data.length).fill(null);

    // Need at least period+1 data points to calculate RSI
    if (data.length <= period) return result;

    // Calculate price changes
    const changes = [];

    for (let i = 1; i < data.length; i++) {
        const currentValue = data[i]?.[source];
        const previousValue = data[i-1]?.[source];

        if (currentValue !== null && previousValue !== null &&
            !isNaN(currentValue) && !isNaN(previousValue)) {
            changes.push(currentValue - previousValue);
        } else {
            changes.push(0);
        }
    }

    // Initialize first average gain and loss
    let avgGain = 0;
    let avgLoss = 0;

    // First period changes
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) {
            avgGain += changes[i];
        } else {
            avgLoss += Math.abs(changes[i]);
        }
    }

    avgGain /= period;
    avgLoss /= period;

    // Calculate first RSI value
    if (avgLoss === 0) {
        result[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        result[period] = 100 - (100 / (1 + rs));
    }

    // Calculate RSI for the rest of the series using smoothed method
    for (let i = period + 1; i < data.length; i++) {
        const change = changes[i-1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        // Smooth the averages
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) {
            result[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            result[i] = 100 - (100 / (1 + rs));
        }
    }

    return result;
}

function calculateMACD(data, settings) {
    const {
        fastPeriod = 12,
        slowPeriod = 26,
        signalPeriod = 9,
        source = 'close'
    } = settings;

    // Calculate fast EMA
    const fastEMA = calculateEMA(data, { period: fastPeriod, source });

    // Calculate slow EMA
    const slowEMA = calculateEMA(data, { period: slowPeriod, source });

    // Arrays for results
    const macdLine = new Array(data.length).fill(null);

    // Calculate MACD line (fastEMA - slowEMA)
    for (let i = 0; i < data.length; i++) {
        if (fastEMA[i] !== null && slowEMA[i] !== null) {
            macdLine[i] = fastEMA[i] - slowEMA[i];
        }
    }

    // Use macd values to calculate signal line (EMA of MACD)
    const macdDataForSignal = data.map((candle, i) => ({ ...candle, close: macdLine[i] }));
    const signalLine = calculateEMA(macdDataForSignal, { period: signalPeriod, source: 'close' });

    // Return an object for each candle with macd, signal and histogram values
    return data.map((_, i) => {
        if (macdLine[i] === null) return null;

        const signalValue = signalLine[i];
        const histogramValue = macdLine[i] - (signalValue || 0);

        return {
            macd: macdLine[i],
            signal: signalValue,
            histogram: signalValue !== null ? histogramValue : null
        };
    });
}

function calculateBollingerBands(data, settings) {
    const {
        period = 20,
        multiplier = 2, // Changed from stdDev to multiplier to match UI
        source = 'close'
    } = settings;

    // Calculate SMA for middle band
    const sma = calculateSMA(data, { period, source });

    // Initialize result arrays for each band
    const upper = new Array(data.length).fill(null);
    const middle = [...sma];
    const lower = new Array(data.length).fill(null);

    // Calculate standard deviation and bands
    for (let i = period - 1; i < data.length; i++) {
        if (middle[i] !== null) {
            // Calculate standard deviation
            let sumSquaredDeviation = 0;
            let validPoints = 0;

            for (let j = 0; j < period; j++) {
                const value = data[i-j]?.[source];
                if (value !== null && value !== undefined && !isNaN(value)) {
                    sumSquaredDeviation += Math.pow(value - middle[i], 2);
                    validPoints++;
                }
            }

            if (validPoints > 0) {
                const stdDevValue = Math.sqrt(sumSquaredDeviation / validPoints);
                upper[i] = middle[i] + (multiplier * stdDevValue);
                lower[i] = middle[i] - (multiplier * stdDevValue);
            }
        }
    }

    // Return an object for each candle with upper, middle, and lower values
    return data.map((_, i) => {
        if (middle[i] === null) return null;
        return {
            upper: upper[i],
            middle: middle[i],
            lower: lower[i]
        };
    });
}

function calculateATR(data, settings) {
    const { period = 14 } = settings;
    const result = new Array(data.length).fill(null);

    // Calculate True Range for each candle
    const trueRanges = [];

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            // First candle, TR is just the high-low range
            trueRanges.push(data[i].high - data[i].low);
        } else {
            // True Range is the greatest of:
            // 1. Current High - Current Low
            // 2. |Current High - Previous Close|
            // 3. |Current Low - Previous Close|
            const highLow = data[i].high - data[i].low;
            const highPrevClose = Math.abs(data[i].high - data[i-1].close);
            const lowPrevClose = Math.abs(data[i].low - data[i-1].close);

            trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
        }
    }

    // Calculate first ATR as simple average of TR over the period
    if (trueRanges.length >= period) {
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += trueRanges[i];
        }
        result[period - 1] = sum / period;

        // Calculate remaining ATR values using smoothed method
        for (let i = period; i < data.length; i++) {
            // ATR = ((Previous ATR * (period - 1)) + Current TR) / period
            result[i] = ((result[i-1] * (period - 1)) + trueRanges[i]) / period;
        }
    }

    return result;
}
