// src/components/stockMarket/IndicatorCharts.jsx
import { Card, CardContent } from "../ui/card.jsx";
import { ScrollArea } from "../ui/scroll-area.jsx";
import IndicatorSubcard from "./indicators/IndicatorSubcard.jsx";
import AddIndicatorCard from "./indicators/AddIndicatorCard.jsx";
import IndicatorSelectionDialog from "./indicators/IndicatorSelectionDialog.jsx";
import { useIndicators } from "./indicators/useIndicators.js";

const IndicatorCharts = () => {
    const {
        indicators,
        isDialogOpen,
        editMode,
        editingIndicator,
        openAddDialog,
        openEditDialog,
        closeDialog,
        addIndicator,
        removeIndicator,
        updateIndicator
    } = useIndicators();

    const MAX_INDICATORS = 15;
    const showAddButton = indicators.length < MAX_INDICATORS;

    // No longer filtering by indicator type - show all indicators
    //console.log("All indicators in IndicatorCharts:", indicators);

    return (
        <Card className="w-full">
            <CardContent className="p-4">
                <ScrollArea className="w-full h-[200px]" orientation="vertical">
                    <div className="flex flex-col space-y-4 pr-2 pb-2 pl-2">
                        {indicators.map((indicator) => (
                            <IndicatorSubcard
                                key={indicator.id}
                                indicator={indicator}
                                onConfigureClick={openEditDialog}
                                onRemoveClick={removeIndicator}
                            />
                        ))}

                        {showAddButton && (
                            <AddIndicatorCard onClick={() => {
                                console.log("Add indicator card clicked");
                                openAddDialog();
                            }}/>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>

            <IndicatorSelectionDialog
                isOpen={isDialogOpen}
                onClose={closeDialog}
                onAdd={addIndicator}
                editMode={editMode}
                initialIndicator={editingIndicator}
                onUpdate={updateIndicator}
            />
        </Card>
    );
};

export default IndicatorCharts;
