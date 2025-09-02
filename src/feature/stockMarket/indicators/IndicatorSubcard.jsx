// src/components/stockMarket/indicators/IndicatorSubcard.jsx
import { Card, CardContent, CardHeader } from "../../../components/ui/card.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Settings, X } from "lucide-react";
import IndicatorChart from "./IndicatorChart.jsx";
import IndicatorInfoPanel from "./IndicatorInfoPanel.jsx";

const IndicatorSubcard = ({ indicator, onConfigureClick, onRemoveClick }) => {
    const isMainIndicator = indicator.category === "main";
    console.log("Rendering card for indicator:", indicator);
    console.log("isMainIndicator value:", isMainIndicator);

    return (
        <Card className="w-full h-[180px] flex flex-col">
            <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0 pb-2">
                <h4 className="font-medium text-sm">{indicator.name}</h4>
                <div className="flex space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onConfigureClick(indicator.id)}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRemoveClick(indicator.id)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-3 pt-0 flex-1 flex flex-col">
                {isMainIndicator ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                        Displaying indicator on main chart
                    </div>
                ) : (
                    <>
                        <IndicatorInfoPanel indicator={indicator} />
                        <div className="flex-1 min-h-0">
                            <IndicatorChart indicator={indicator} />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default IndicatorSubcard;
