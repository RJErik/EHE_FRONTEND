// src/components/stockMarket/IndicatorCharts.jsx
import { useState } from "react";
import { Card, CardContent } from "../ui/card.jsx";
import { ScrollArea } from "../ui/scroll-area.jsx";
import IndicatorSubcard from "./indicators/IndicatorSubcard.jsx";
import AddIndicatorCard from "./indicators/AddIndicatorCard.jsx";
import IndicatorSelectionDialog from "./indicators/IndicatorSelectionDialog.jsx";
import { useIndicators } from "./indicators/useIndicators.js";

const IndicatorCharts = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const {
        indicators,
        addIndicator,
        removeIndicator,
        configureIndicator
    } = useIndicators();



    const MAX_INDICATORS = 15;
    const showAddButton = indicators.length < MAX_INDICATORS;

    // Filter indicators by category
    const subIndicators = indicators.filter(ind => ind.category === "sub");

    console.log("Indicators in IndicatorCharts:", indicators);
    console.log("Filtered subIndicators:", subIndicators);

    return (
        <Card className="w-full">
            <CardContent className="p-4">
                <ScrollArea className="w-full h-[200px]" orientation="vertical">
                        <div className="flex space-x-4 pr-2 pb-2 pl-2 min-w-max">
                            {subIndicators.map((indicator) => (
                                <IndicatorSubcard
                                    key={indicator.id}
                                    indicator={indicator}
                                    onConfigureClick={() => configureIndicator(indicator.id)}
                                    onRemoveClick={() => removeIndicator(indicator.id)}
                                />
                            ))}

                            {showAddButton && (
                                <AddIndicatorCard onClick={() => {
                                    console.log("Add indicator card clicked");
                                    setIsDialogOpen(true);
                                }}/>
                            )}
                        </div>
                </ScrollArea>
            </CardContent>

            <IndicatorSelectionDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onAdd={addIndicator}

            />
        </Card>
    );
};

export default IndicatorCharts;
