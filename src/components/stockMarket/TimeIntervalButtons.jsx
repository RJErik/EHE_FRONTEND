import { Button } from "../ui/button.jsx";
import { useState } from "react";

const TimeIntervalButtons = () => {
    const [activeInterval, setActiveInterval] = useState("1h");

    const intervals = [
        { label: "1m", value: "1m" },
        { label: "5m", value: "5m" },
        { label: "15m", value: "15m" },
        { label: "1h", value: "1h" },
        { label: "4h", value: "4h" },
        { label: "12h", value: "12h" },
        { label: "1d", value: "1d" },
        { label: "1w", value: "1w" },
        { label: "1m", value: "1month" }
    ];

    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {intervals.map((interval) => (
                <Button
                    key={interval.value}
                    variant={activeInterval === interval.value ? "default" : "outline"}
                    className={`
            px-3 py-1 h-8 text-xs
            ${activeInterval === interval.value ? "bg-gray-500 hover:bg-gray-600" : ""}
          `}
                    onClick={() => setActiveInterval(interval.value)}
                >
                    {interval.label}
                </Button>
            ))}
        </div>
    );
};

export default TimeIntervalButtons;
