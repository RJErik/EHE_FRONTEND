import { useIndicators } from "./useIndicators.js";
import IndicatorSubcard from "./IndicatorSubcard.jsx";
import IndicatorSelectionDialog from "./IndicatorSelectionDialog.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { Plus } from "lucide-react";

const IndicatorPanel = () => {
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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Indicators</h3>
                <Button size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Indicator
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {indicators.map(indicator => (
                    <IndicatorSubcard
                        key={indicator.id}
                        indicator={indicator}
                        onConfigureClick={openEditDialog}
                        onRemoveClick={removeIndicator}
                    />
                ))}
                {indicators.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-muted-foreground">
                        No indicators added. Click "Add Indicator" to get started.
                    </div>
                )}
            </div>

            <IndicatorSelectionDialog
                isOpen={isDialogOpen}
                onClose={closeDialog}
                onAdd={addIndicator}
                editMode={editMode}
                initialIndicator={editingIndicator}
                onUpdate={updateIndicator}
            />
        </div>
    );
};

export default IndicatorPanel;
