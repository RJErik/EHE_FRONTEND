import { useState, useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

export function useIndicators() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);

    const {
        indicators = [],
        addIndicator = () => console.error("ChartContext not available"),
        removeIndicator = () => console.error("ChartContext not available"),
        updateIndicator = () => console.error("ChartContext not available")
    } = useContext(ChartContext) || {};

    const openAddDialog = () => {
        setEditMode(false);
        setEditingIndicator(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (id) => {
        const indicator = indicators.find(ind => ind.id === id);
        if (indicator) {
            setEditMode(true);
            setEditingIndicator(indicator);
            setIsDialogOpen(true);
        } else {
            console.warn(`Indicator with id ${id} not found for editing`);
        }
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setTimeout(() => {
            setEditMode(false);
            setEditingIndicator(null);
        }, 300);
    };

    const handleUpdateIndicator = (updatedData) => {
        if (editingIndicator && editingIndicator.id) {
            updateIndicator(editingIndicator.id, updatedData);
        }
    };

    return {
        indicators,
        isDialogOpen,
        editMode,
        editingIndicator,

        openAddDialog,
        openEditDialog,
        closeDialog,

        addIndicator,
        removeIndicator,
        updateIndicator: handleUpdateIndicator
    };
}
