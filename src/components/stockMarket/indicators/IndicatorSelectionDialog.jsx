// src/components/stockMarket/indicators/IndicatorSelectionDialog.jsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs.jsx";
import { Button } from "../../ui/button.jsx";
import { Input } from "../../ui/input.jsx";
import { Label } from "../../ui/label.jsx";
import { ScrollArea } from "../../ui/scroll-area.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.jsx";
import { ColorPicker, getRandomColor } from "./ColorPicker.jsx";

// Mock indicator types with short names and available categories
const INDICATOR_TYPES = [
    { id: "sma", name: "Simple Moving Average", shortName: "SMA", categories: ["main"], category: "Trend" },
    { id: "ema", name: "Exponential Moving Average", shortName: "EMA", categories: ["main"], category: "Trend" },
    { id: "macd", name: "MACD", shortName: "MACD", categories: ["sub"], category: "Momentum" },
    { id: "rsi", name: "Relative Strength Index", shortName: "RSI", categories: ["sub"], category: "Momentum" },
    { id: "bb", name: "Bollinger Bands", shortName: "BB", categories: ["main"], category: "Volatility" },
    { id: "atr", name: "Average True Range", shortName: "ATR", categories: ["sub"], category: "Volatility" }
];

const IndicatorSelectionDialog = ({ isOpen, onClose, onAdd }) => {
    const [category, setCategory] = useState("main");
    const [selectedType, setSelectedType] = useState(null);
    const [settings, setSettings] = useState({
        period: 14,
        source: "close",
        color: getRandomColor(),
        thickness: 2
    });

// Reset selected type when changing tabs
    useEffect(() => {
        setSelectedType(null);
    }, [category]);

// Update color when a new indicator type is selected
    useEffect(() => {
        if (selectedType) {
            setSettings(prev => ({
                ...prev,
                color: getRandomColor()
            }));
        }
    }, [selectedType]);

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
            settings
        };

        onAdd(newIndicator);
        onClose();

        // Reset form
        setSelectedType(null);
        setSettings({
            period: 14,
            source: "close",
            color: getRandomColor(),
            thickness: 2
        });
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
                                                onChange={e => setSettings({...settings, period: parseInt(e.target.value)})}
                                                min="1"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Source</Label>
                                            <Select
                                                value={settings.source}
                                                onValueChange={value => setSettings({...settings, source: value})}
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
                                            <ColorPicker
                                                color={settings.color}
                                                onChange={color => setSettings({...settings, color})}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Line Thickness</Label>
                                            <Input
                                                type="number"
                                                value={settings.thickness}
                                                onChange={e => setSettings({...settings, thickness: parseInt(e.target.value)})}
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