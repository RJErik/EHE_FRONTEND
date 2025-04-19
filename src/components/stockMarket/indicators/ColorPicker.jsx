// src/components/stockMarket/indicators/ColorPicker.jsx
import { Button } from "../../ui/button.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.jsx";
import { Input } from "../../ui/input.jsx";
import {Label} from "@radix-ui/react-label";

// Define predefined colors
export const predefinedColors = [
    "#FF5733", "#33FF57", "#3357FF", "#F033FF", "#FF3333",
    "#33FFF5", "#F5FF33", "#FF33A8", "#A833FF", "#33A8FF",
    "#FFA833", "#33FFA8", "#A8FF33", "#774422", "#227744",
];

// Function to get a random color
export const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * predefinedColors.length);
    return predefinedColors[randomIndex];
};

export const ColorPicker = ({ color, onChange }) => {
    // Handler for clicking a predefined color
    const handleColorClick = (colorOption) => {
        onChange(colorOption);
        // Optionally, you might want the popover to close after selecting a color.
        // If using Radix primitives directly, you'd manage the open state.
        // With shadcn/ui Popover, it often closes on content clicks by default
        // unless propagation is stopped or managed differently.
        // If stopping propagation keeps it open, you might need to manually close it here if desired.
    };

    // Handler for manually typing a color
    const handleInputChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full h-8 flex items-center justify-between gap-2"
                    // Prevent the trigger button click from propagating if it causes issues
                    // onClick={(e) => e.stopPropagation()} // Usually not needed for the trigger
                >
                    <div
                        className="w-4 h-4 rounded-full border" // Added border for visibility if color is white/light
                        style={{ backgroundColor: color }}
                    />
                    {/* Display the hex code or leave empty */}
                    {/* <span>{color}</span> */}
                    <span></span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64"
                // Prevent clicks inside the content from closing the popover prematurely
                // Add stopPropagation to a wrapper div inside the content
            >
                {/* Wrap content in a div and stop click propagation */}
                <div onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-5 gap-2">
                        {predefinedColors.map((colorOption) => (
                            <div
                                key={colorOption} // FIX: Added key prop
                                className="w-8 h-8 cursor-pointer border rounded-md"
                                style={{ backgroundColor: colorOption }}
                                onClick={(e) => {
                                    // Stop propagation specifically on the color swatch click if needed
                                    // e.stopPropagation(); // May not be necessary if outer div handles it
                                    handleColorClick(colorOption)
                                }}
                            />
                        ))}
                    </div>
                    <div className="mt-4">
                        <Label htmlFor="color-input" className="sr-only">Custom Color</Label>
                        <Input
                            id="color-input"
                            type="text"
                            value={color || ''} // FIX: Bind value prop (use empty string if color is null/undefined)
                            onChange={handleInputChange} // FIX: Bind onChange prop
                            className="w-full"
                            placeholder="#RRGGBB"
                            // Optionally stop propagation on input click too
                            // onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ColorPicker;