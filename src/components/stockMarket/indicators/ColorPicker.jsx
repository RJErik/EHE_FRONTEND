// src/components/stockMarket/indicators/ColorPicker.jsx
import { Button } from "../../ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.jsx";

// Define predefined colors in one place
export const predefinedColors = [
    "#FF5733", "#33FF57", "#3357FF", "#F033FF", "#FF3333",
    "#33FFF5", "#F5FF33", "#FF33A8", "#A833FF", "#33A8FF",
    "#FFA833", "#33FFA8", "#A8FF33", "#FF5733", "#33FF57",
];

// Export a function to get a random color
export const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * predefinedColors.length);
    return predefinedColors[randomIndex];
};

export const ColorPicker = ({ color, onChange }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full h-8 flex items-center justify-between gap-2"
                >
                    <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                    />
                    <span>{color}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
                <div className="grid grid-cols-5 gap-2">
                    {predefinedColors.map((colorOption) => (
                        <div
                            key={colorOption}
                            className="w-8 h-8 cursor-pointer border rounded-md"
                            style={{ backgroundColor: colorOption }}
                            onClick={() => onChange(colorOption)}
                        />
                    ))}
                </div>
                <div className="mt-4">
                    <input
                        type="text"
                        value={color}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ColorPicker;