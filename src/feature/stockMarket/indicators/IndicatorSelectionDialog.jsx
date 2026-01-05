import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog.jsx";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Input } from "../../../components/ui/input.jsx";
import { Label } from "../../../components/ui/label.jsx";
import { ScrollArea } from "@/components/ui/scroll-area.jsx"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select.jsx";

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

const getRandomColor = () => {
    const randomIndex = Math.floor(Math.random() * PREDEFINED_COLORS.length);
    return PREDEFINED_COLORS[randomIndex];
};

const INDICATOR_TYPES = [
    {
        id: "sma",
        name: "Simple Moving Average",
        shortName: "SMA",
        categories: ["main"],
        category: "Trend",
        defaultSettings: {
            period: 14,
            source: "close"
        }
    },
    {
        id: "ema",
        name: "Exponential Moving Average",
        shortName: "EMA",
        categories: ["main"],
        category: "Trend",
        defaultSettings: {
            period: 14,
            source: "close"
        }
    },
    {
        id: "macd",
        name: "MACD",
        shortName: "MACD",
        categories: ["sub"],
        category: "Momentum",
        defaultSettings: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            source: "close"
        }
    },
    {
        id: "rsi",
        name: "Relative Strength Index",
        shortName: "RSI",
        categories: ["sub"],
        category: "Momentum",
        defaultSettings: {
            period: 14,
            source: "close"
        }
    },
    {
        id: "bb",
        name: "Bollinger Bands",
        shortName: "BB",
        categories: ["main"],
        category: "Volatility",
        defaultSettings: {
            period: 20,
            multiplier: 2,
            source: "close"
        }
    },
    {
        id: "atr",
        name: "Average True Range",
        shortName: "ATR",
        categories: ["sub"],
        category: "Volatility",
        defaultSettings: {
            period: 14
        }
    }
];

const getColorByHex = (hexValue) => {
    return PREDEFINED_COLORS.find(color => color.hex.toLowerCase() === hexValue.toLowerCase());
};

const getDefaultSettingsForType = (typeId) => {
    const indicatorType = INDICATOR_TYPES.find(t => t.id === typeId);
    return indicatorType ? { ...indicatorType.defaultSettings } : {};
};

const IndicatorSelectionDialog = ({ isOpen, onClose, onAdd, editMode = false, initialIndicator = null, onUpdate = null }) => {
    const [category, setCategory] = useState("main");
    const [selectedType, setSelectedType] = useState(null);
    const [settings, setSettings] = useState({
        color: "",
        colorName: "",
        thickness: 2
    });

    const [originalType, setOriginalType] = useState(null);
    const [originalSettings, setOriginalSettings] = useState(null);

    const [colorOption, setColorOption] = useState("default");

    useEffect(() => {
        if (isOpen && editMode && initialIndicator) {
            setCategory(initialIndicator.category || "main");
            setSelectedType(initialIndicator.type);
            setOriginalType(initialIndicator.type);

            const defaultSettings = getDefaultSettingsForType(initialIndicator.type);

            const indicatorSettings = {
                ...defaultSettings,
                ...(initialIndicator.settings || {}),
                thickness: initialIndicator.settings?.thickness || 2
            };

            const colorObj = getColorByHex(indicatorSettings.color);

            const settingsWithColorName = {
                ...indicatorSettings,
                colorName: colorObj ? colorObj.name : "Custom"
            };

            setSettings(settingsWithColorName);
            setOriginalSettings(settingsWithColorName);
            setColorOption(colorObj ? "predefined" : "custom");
        } else if (isOpen && !editMode) {
            setSelectedType(null);
            setSettings({
                color: "",
                colorName: "",
                thickness: 2
            });
            setOriginalType(null);
            setOriginalSettings(null);
            setColorOption("default");
        }
    }, [isOpen, editMode, initialIndicator]);

    useEffect(() => {
        if (!editMode && selectedType) {
            const indicatorType = INDICATOR_TYPES.find(t => t.id === selectedType);
            if (indicatorType) {
                const randomColor = getRandomColor();
                setSettings(() => ({
                    ...indicatorType.defaultSettings,
                    color: randomColor.hex,
                    colorName: randomColor.name,
                    thickness: 2
                }));
                setColorOption("predefined");
            }
        }
    }, [selectedType, editMode]);

    useEffect(() => {
        if (editMode && selectedType && originalType) {
            if (selectedType === originalType) {
                setSettings(originalSettings);

                const colorObj = getColorByHex(originalSettings.color);
                setColorOption(colorObj ? "predefined" : "custom");
            }
            else if (selectedType !== originalType) {
                const newTypeDefaults = getDefaultSettingsForType(selectedType);

                const newSettings = {
                    ...newTypeDefaults,
                    color: settings.color,
                    colorName: settings.colorName,
                    thickness: settings.thickness
                };

                if (settings.source && Object.prototype.hasOwnProperty.call(newTypeDefaults, 'source')) {
                    newSettings.source = settings.source;
                }

                setSettings(newSettings);
            }
        }
    }, [selectedType, editMode, originalType, originalSettings, settings.color, settings.colorName, settings.thickness, settings.source]);

    useEffect(() => {
        if (!editMode) {
            setSelectedType(null);
        }
    }, [category, editMode]);

    const filteredIndicators = INDICATOR_TYPES.filter(indicator =>
        indicator.categories.includes(category)
    );

    const handleSave = () => {
        if (!selectedType) return;

        const selectedIndicator = INDICATOR_TYPES.find(t => t.id === selectedType);

        const indicatorData = {
            name: selectedIndicator.shortName,
            type: selectedType,
            category,
            settings: {
                ...settings,
                colorName: undefined
            }
        };

        if (editMode && onUpdate) {
            onUpdate(indicatorData);
        } else {
            onAdd(indicatorData);
        }

        onClose();
    };

    const handleColorTextChange = (e) => {
        const newHexColor = e.target.value;
        const colorObj = getColorByHex(newHexColor);

        setSettings(prev => ({
            ...prev,
            color: newHexColor,
            colorName: colorObj ? colorObj.name : "Custom"
        }));

        if (colorObj) {
            setColorOption("predefined");
        } else {
            setColorOption("custom");
        }
    };

    const handleColorSelection = (value) => {
        if (value === "custom") {
            setColorOption("custom");
        } else {
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

    const getColorDropdownValue = () => {
        if (colorOption === "custom") return "custom";

        const colorIndex = PREDEFINED_COLORS.findIndex(
            color => color.hex.toLowerCase() === settings.color.toLowerCase()
        );

        return colorIndex !== -1 ? colorIndex.toString() : "custom";
    };

    const renderIndicatorSpecificSettings = () => {
        if (!selectedType) return null;

        switch (selectedType) {
            case "macd":
                return (
                    <>
                        <div className="space-y-2">
                            <Label>Fast Period</Label>
                            <Input
                                type="number"
                                value={settings.fastPeriod !== undefined ? settings.fastPeriod : 12}
                                onChange={e => setSettings(prev => ({...prev, fastPeriod: parseInt(e.target.value)}))}
                                min="1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slow Period</Label>
                            <Input
                                type="number"
                                value={settings.slowPeriod !== undefined ? settings.slowPeriod : 26}
                                onChange={e => setSettings(prev => ({...prev, slowPeriod: parseInt(e.target.value)}))}
                                min="1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Signal Period</Label>
                            <Input
                                type="number"
                                value={settings.signalPeriod !== undefined ? settings.signalPeriod : 9}
                                onChange={e => setSettings(prev => ({...prev, signalPeriod: parseInt(e.target.value)}))}
                                min="1"
                            />
                        </div>
                    </>
                );
            case "bb":
                return (
                    <>
                        <div className="space-y-2">
                            <Label>Period</Label>
                            <Input
                                type="number"
                                value={settings.period !== undefined ? settings.period : 20}
                                onChange={e => setSettings(prev => ({...prev, period: parseInt(e.target.value)}))}
                                min="1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Multiplier</Label>
                            <Input
                                type="number"
                                value={settings.multiplier !== undefined ? settings.multiplier : 2}
                                onChange={e => setSettings(prev => ({...prev, multiplier: parseFloat(e.target.value)}))}
                                min="0.1"
                                step="0.1"
                            />
                        </div>
                    </>
                );
            default:
                return (
                    <div className="space-y-2">
                        <Label>Period</Label>
                        <Input
                            type="number"
                            value={settings.period !== undefined ? settings.period : 14}
                            onChange={e => setSettings(prev => ({...prev, period: parseInt(e.target.value)}))}
                            min="1"
                        />
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{editMode ? "Edit Indicator" : "Add Indicator"}</DialogTitle>
                </DialogHeader>

                <Tabs value={category} onValueChange={setCategory}>
                    <TabsList className="mb-4">
                        <TabsTrigger value="main">Main Chart</TabsTrigger>
                        <TabsTrigger value="sub">Sub Chart</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-4 h-[350px]">
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

                        <div className="w-3/4 border rounded-md p-4 flex flex-col">
                            {selectedType ? (
                                <>
                                    <div className="flex-grow overflow-auto">
                                        <h3 className="font-medium mb-4">
                                            {INDICATOR_TYPES.find(t => t.id === selectedType).name} Settings
                                        </h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            {renderIndicatorSpecificSettings()}

                                            {selectedType !== "atr" && (
                                                <div className="space-y-2">
                                                    <Label>Source</Label>
                                                    <Select
                                                        value={settings.source || "close"}
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
                                            )}

                                            <div className="space-y-2">
                                                <Label>Line Color</Label>
                                                <div className="flex gap-2 items-center">
                                                    <div
                                                        className="w-8 h-8 border rounded-md flex-shrink-0"
                                                        style={{ backgroundColor: settings.color }}
                                                    />

                                                    <Input
                                                        type="text"
                                                        value={settings.color}
                                                        onChange={handleColorTextChange}
                                                        className="flex-1"
                                                        placeholder="#RRGGBB"
                                                    />
                                                </div>

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
                                                    value={settings.thickness !== undefined ? settings.thickness : 2}
                                                    onChange={e => setSettings(prev => ({...prev, thickness: parseInt(e.target.value)}))}
                                                    min="1"
                                                    max="5"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-2 mt-4 pt-2 border-t">
                                        <Button variant="outline" onClick={onClose}>
                                            Cancel
                                        </Button>
                                        <Button onClick={handleSave}>
                                            {editMode ? "Update Indicator" : "Add Indicator"}
                                        </Button>
                                    </div>
                                </>
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