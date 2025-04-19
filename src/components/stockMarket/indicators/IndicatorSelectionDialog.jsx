import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog.jsx";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs.jsx";
import { Button } from "../../ui/button.jsx";
import { Input } from "../../ui/input.jsx";
import { Label } from "../../ui/label.jsx";
import { ScrollArea } from "../../ui/scroll-area.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.jsx";

// Define predefined colors with names
const PREDEFINED_COLORS = [
    { hex: "#FF5733", name: "Coral Red" },
    { hex: "#33FF57", name: "Lime Green" },
    { hex: "#3357FF", name: "Royal Blue" },
    { hex: "#F033FF", name: "Bright Purple" },
    { hex: "#FF3333", name: "Crimson" },
    { hex: "#33FFF5", name: "Turquoise" },
    { hex: "#F5FF33", name: "Canary Yellow" },
    { hex: "#FF33A8", name: "Hot Pink" },
    { hex: "#A833FF", name: "Violet" },
    { hex: "#33A8FF", name: "Sky Blue" },
    { hex: "#FFA833", name: "Orange" },
    { hex: "#33FFA8", name: "Mint Green" },
    { hex: "#A8FF33", name: "Chartreuse" },
    { hex: "#8A2BE2", name: "Blue Violet" },
    { hex: "#008000", name: "Forest Green" },
];

// Function to get a random color
const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * PREDEFINED_COLORS.length);
    return PREDEFINED_COLORS[randomIndex];
};

// Mock indicator types with short names and available categories
const INDICATOR_TYPES = [
    { id: "sma", name: "Simple Moving Average", shortName: "SMA", categories: ["main"], category: "Trend" },
    { id: "ema", name: "Exponential Moving Average", shortName: "EMA", categories: ["main"], category: "Trend" },
    { id: "macd", name: "MACD", shortName: "MACD", categories: ["sub"], category: "Momentum" },
    { id: "rsi", name: "Relative Strength Index", shortName: "RSI", categories: ["sub"], category: "Momentum" },
    { id: "bb", name: "Bollinger Bands", shortName: "BB", categories: ["main"], category: "Volatility" },
    { id: "atr", name: "Average True Range", shortName: "ATR", categories: ["sub"], category: "Volatility" }
];

// Find color name by hex value
const getColorNameByHex = (hexValue) => {
    const color = PREDEFINED_COLORS.find(color => color.hex.toLowerCase() === hexValue.toLowerCase());
    return color ? color.name : "Custom";
};

// Find color object by hex value
const getColorByHex = (hexValue) => {
    return PREDEFINED_COLORS.find(color => color.hex.toLowerCase() === hexValue.toLowerCase());
};

const IndicatorSelectionDialog = ({ isOpen, onClose, onAdd }) => {
    const [category, setCategory] = useState("main");
    const [selectedType, setSelectedType] = useState(null);
    const [settings, setSettings] = useState({
        period: 14,
        source: "close",
        color: "",
        colorName: "",
        thickness: 2
    });

    const [colorOption, setColorOption] = useState("default"); // "default", "predefined", or "custom"
    console.log("Dialog open state:", isOpen);

    // Only set a random color when an indicator is selected, not on initial load
    useEffect(() => {
        if (selectedType) {
            const randomColor = getRandomColor();
            setSettings(prev => ({
                ...prev,
                color: randomColor.hex,
                colorName: randomColor.name
            }));
            setColorOption("predefined");
        }
    }, [selectedType]);

    // Reset selected type when changing tabs
    useEffect(() => {
        setSelectedType(null);
    }, [category]);

    // Filter indicators by the selected category tab
    const filteredIndicators = INDICATOR_TYPES.filter(indicator =>
        indicator.categories.includes(category)
    );

    const handleAdd = () => {
        if (!selectedType) return;

        const newIndicator = {
            name: INDICATOR_TYPES.find(t => t.id === selectedType).shortName,
            type: selectedType,
            category,
            settings: {
                period: settings.period,
                source: settings.source,
                color: settings.color,
                thickness: settings.thickness
            }
        };

        onAdd(newIndicator);
        onClose();

        // Reset form
        setSelectedType(null);
        setSettings({
            period: 14,
            source: "close",
            color: "",
            colorName: "",
            thickness: 2
        });
        setColorOption("default");
    };

    // Handle color text input changes
    const handleColorTextChange = (e) => {
        const newHexColor = e.target.value;
        const colorObj = getColorByHex(newHexColor);

        setSettings(prev => ({
            ...prev,
            color: newHexColor,
            colorName: colorObj ? colorObj.name : "Custom"
        }));

        // If the text input matches a predefined color, select that option
        if (colorObj) {
            setColorOption("predefined");
        } else {
            setColorOption("custom");
        }
    };

    // Handle color selection from dropdown
    const handleColorSelection = (value) => {
        if (value === "custom") {
            setColorOption("custom");
            // Keep the current color
        } else {
            // Find color object by ID (index)
            const selectedIndex = parseInt(value);
            const selectedColor = PREDEFINED_COLORS[selectedIndex];

            setSettings(prev => ({
                ...prev,
                color: selectedColor.hex,
                colorName: selectedColor.name
            }));
            setColorOption("predefined");
        }
    };

    // Get the current value for the color dropdown
    const getColorDropdownValue = () => {
        if (colorOption === "custom") return "custom";

        // Find index of the current color in predefined colors
        const colorIndex = PREDEFINED_COLORS.findIndex(
            color => color.hex.toLowerCase() === settings.color.toLowerCase()
        );

        return colorIndex !== -1 ? colorIndex.toString() : "custom";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Add Indicator</DialogTitle>
                </DialogHeader>

                <Tabs value={category} onValueChange={setCategory}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="main">Main Chart</TabsTrigger>
                        <TabsTrigger value="sub">Sub Chart</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-4 h-[400px]">
                        {/* Indicator Type List (25% width) */}
                        <div className="w-1/4 border rounded-md">
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-1">
                                    {filteredIndicators.map(type => (
                                        <Button
                                            key={type.id}
                                            variant={selectedType === type.id ? "default" : "ghost"}
                                            className="w-full justify-start text-left"
                                            onClick={() => setSelectedType(type.id)}
                                        >
                                            {type.shortName}
                                        </Button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Indicator Settings (75% width) */}
                        <div className="w-3/4 border rounded-md p-4">
                            {selectedType ? (
                                <div className="space-y-4">
                                    <h3 className="font-medium">
                                        {INDICATOR_TYPES.find(t => t.id === selectedType).name} Settings
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Period</Label>
                                            <Input
                                                type="number"
                                                value={settings.period}
                                                onChange={e => setSettings(prev => ({...prev, period: parseInt(e.target.value)}))}
                                                min="1"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Source</Label>
                                            <Select
                                                value={settings.source}
                                                onValueChange={value => setSettings(prev => ({...prev, source: value}))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select source" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="close">Close</SelectItem>
                                                    <SelectItem value="open">Open</SelectItem>
                                                    <SelectItem value="high">High</SelectItem>
                                                    <SelectItem value="low">Low</SelectItem>
                                                    <SelectItem value="hl2">(High + Low)/2</SelectItem>
                                                    <SelectItem value="hlc3">(High + Low + Close)/3</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Line Color</Label>
                                            <div className="flex gap-2 items-center">
                                                {/* Color preview rectangle */}
                                                <div
                                                    className="w-8 h-8 border rounded-md flex-shrink-0"
                                                    style={{ backgroundColor: settings.color }}
                                                />

                                                {/* Color text input */}
                                                <Input
                                                    type="text"
                                                    value={settings.color}
                                                    onChange={handleColorTextChange}
                                                    className="flex-1"
                                                    placeholder="#RRGGBB"
                                                />
                                            </div>

                                            {/* Color dropdown */}
                                            <Select
                                                value={getColorDropdownValue()}
                                                onValueChange={handleColorSelection}
                                            >
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue placeholder="Select color">
                                                        {colorOption === "custom" ? "Custom" : settings.colorName}
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="custom">Custom</SelectItem>
                                                    {PREDEFINED_COLORS.map((color, index) => (
                                                        <SelectItem key={`${color.hex}-${index}`} value={index.toString()} className="flex items-center gap-2">
                                                            <div className="flex items-center gap-2 w-full">
                                                                <div
                                                                    className="w-4 h-4 rounded-full inline-block"
                                                                    style={{ backgroundColor: color.hex }}
                                                                />
                                                                <span>{color.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Line Thickness</Label>
                                            <Input
                                                type="number"
                                                value={settings.thickness}
                                                onChange={e => setSettings(prev => ({...prev, thickness: parseInt(e.target.value)}))}
                                                min="1"
                                                max="5"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end space-x-2">
                                        <Button variant="outline" onClick={onClose}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleAdd}>
                                            Add Indicator
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    Select an indicator type from the list
                                </div>
                            )}
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default IndicatorSelectionDialog;
