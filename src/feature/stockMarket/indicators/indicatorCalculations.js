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

    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error("Invalid data for SMA calculation");
        return [];
    }

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        let validPoints = 0;

        for (let j = 0; j < period; j++) {
            const value = data[i-j]?.[source];
            if (value !== null && value !== undefined && !isNaN(value)) {
                sum += value;
                validPoints++;
            }
        }

        if (validPoints >= Math.ceil(period * 0.8)) {
            result[i] = sum / validPoints;
        }
    }

    return result;
}

function calculateEMA(data, settings) {
    const { period = 14, source = 'close' } = settings;
    const result = new Array(data.length).fill(null);

    const multiplier = 2 / (period + 1);

    let firstValidIndex = period - 1;
    let sum = 0;

    for (let i = 0; i < period; i++) {
        const value = data[i]?.[source];
        if (value !== null && value !== undefined && !isNaN(value)) {
            sum += value;
        }
    }

    result[firstValidIndex] = sum / period;

    for (let i = firstValidIndex + 1; i < data.length; i++) {
        const currentValue = data[i]?.[source];
        if (currentValue !== null && currentValue !== undefined && !isNaN(currentValue) && result[i-1] !== null) {
            result[i] = currentValue * multiplier + result[i-1] * (1 - multiplier);
        }
    }

    return result;
}

function calculateRSI(data, settings) {
    const { period = 14, source = 'close' } = settings;
    const result = new Array(data.length).fill(null);

    if (data.length <= period) return result;

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

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) {
            avgGain += changes[i];
        } else {
            avgLoss += Math.abs(changes[i]);
        }
    }

    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) {
        result[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        result[period] = 100 - (100 / (1 + rs));
    }

    for (let i = period + 1; i < data.length; i++) {
        const change = changes[i-1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

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

    const macdLine = new Array(data.length).fill(null);
    const signalLine = new Array(data.length).fill(null);
    const histogram = new Array(data.length).fill(null);

    const fastEMA = calculateEMA(data, { period: fastPeriod, source });
    const slowEMA = calculateEMA(data, { period: slowPeriod, source });

    for (let i = 0; i < data.length; i++) {
        if (fastEMA[i] !== null && slowEMA[i] !== null) {
            macdLine[i] = fastEMA[i] - slowEMA[i];
        }
    }

    let firstValidMacdIndex = macdLine.findIndex(val => val !== null);
    if (firstValidMacdIndex !== -1) {
        let sum = 0;
        let count = 0;

        for (let i = firstValidMacdIndex; i < Math.min(firstValidMacdIndex + signalPeriod, macdLine.length); i++) {
            if (macdLine[i] !== null) {
                sum += macdLine[i];
                count++;
            }
        }

        if (count > 0) {
            const startIndex = firstValidMacdIndex + signalPeriod - 1;
            if (startIndex < macdLine.length) {
                signalLine[startIndex] = sum / count;

                const multiplier = 2 / (signalPeriod + 1);

                for (let i = startIndex + 1; i < macdLine.length; i++) {
                    if (macdLine[i] !== null && signalLine[i-1] !== null) {
                        signalLine[i] = (macdLine[i] - signalLine[i-1]) * multiplier + signalLine[i-1];
                    }
                }
            }
        }
    }

    for (let i = 0; i < data.length; i++) {
        if (macdLine[i] !== null && signalLine[i] !== null) {
            histogram[i] = macdLine[i] - signalLine[i];
        }
    }

    return data.map((_, i) => {
        if (macdLine[i] === null) return null;

        return {
            macd: macdLine[i],
            signal: signalLine[i],
            histogram: histogram[i]
        };
    });
}

function calculateBollingerBands(data, settings) {
    const {
        period = 20,
        multiplier = 2,
        source = 'close'
    } = settings;

    const sma = calculateSMA(data, { period, source });

    const upper = new Array(data.length).fill(null);
    const middle = [...sma];
    const lower = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        if (middle[i] !== null) {
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

    const trueRanges = [];

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            trueRanges.push(data[i].high - data[i].low);
        } else {
            const highLow = data[i].high - data[i].low;
            const highPrevClose = Math.abs(data[i].high - data[i-1].close);
            const lowPrevClose = Math.abs(data[i].low - data[i-1].close);

            trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
        }
    }

    if (trueRanges.length >= period) {
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += trueRanges[i];
        }
        result[period - 1] = sum / period;

        for (let i = period; i < data.length; i++) {
            result[i] = ((result[i-1] * (period - 1)) + trueRanges[i]) / period;
        }
    }

    return result;
}