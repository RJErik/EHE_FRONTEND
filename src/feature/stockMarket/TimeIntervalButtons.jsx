// src/components/stockMarket/TimeIntervalButtons.jsx
import { Button } from "../../components/ui/button.jsx";
import { Loader2 } from "lucide-react";
import PropTypes from "prop-types";

const TimeIntervalButtons = ({
                                 value,
                                 onChange,
                                 isLoading = false,
                                 disabled = false
                             }) => {
    // Define intervals that match the backend's MarketCandle.Timeframe enum
    const intervals = [
        { label: "1m", value: "1M", backendValue: "M1" },
        { label: "5m", value: "5M", backendValue: "M5" },
        { label: "15m", value: "15M", backendValue: "M15" },
        { label: "1h", value: "1H", backendValue: "H1" },
        { label: "4h", value: "4H", backendValue: "H4" },
        { label: "1d", value: "1D", backendValue: "D1" }
    ];

    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {isLoading && (
                <div className="flex items-center text-sm text-muted-foreground mr-2">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    <span>Loading...</span>
                </div>
            )}

            {intervals.map((interval) => (
                <Button
                    key={interval.value}
                    variant={value === interval.value ? "default" : "outline"}
                    className="px-3 py-1 h-8 text-xs"
                    onClick={() => onChange(interval.value)}
                    disabled={isLoading || disabled}
                >
                    {interval.label}
                </Button>
            ))}
        </div>
    );
};

TimeIntervalButtons.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
    disabled: PropTypes.bool
};

export default TimeIntervalButtons;
