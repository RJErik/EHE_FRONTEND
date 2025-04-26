// src/components/stockMarket/indicators/useIndicators.js
import { useState, useContext } from "react";
import { ChartContext } from "../ChartContext.jsx";

export function useIndicators() {
    // Configuration UI state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingIndicator, setEditingIndicator] = useState(null);

    // Get indicator state and functions from shared context
    const {
        indicators = [],
        addIndicator = () => console.error("ChartContext not available"),
        removeIndicator = () => console.error("ChartContext not available"),
        updateIndicator = () => console.error("ChartContext not available")
    } = useContext(ChartContext) || {};

    // Open dialog to add a new indicator
    const openAddDialog = () => {
        setEditMode(false);
        setEditingIndicator(null);
        setIsDialogOpen(true);
    };

    // Open dialog to edit an existing indicator
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

    // Close the dialog
    const closeDialog = () => {
        setIsDialogOpen(false);
        // Reset state after animation completes
        setTimeout(() => {
            setEditMode(false);
            setEditingIndicator(null);
        }, 300);
    };

    // Handle indicator update from dialog
    const handleUpdateIndicator = (updatedData) => {
        if (editingIndicator && editingIndicator.id) {
            updateIndicator(editingIndicator.id, updatedData);
            
            // Log that indicator requirements might have changed
            console.log(`[useIndicators] Updated indicator ${editingIndicator.id} with new settings:`, updatedData);
            console.log(`[useIndicators] Requirements for historical data may have changed`);
        }
    };

    return {
        // State
        indicators,
        isDialogOpen,
        editMode,
        editingIndicator,

        // Dialog actions
        openAddDialog,
        openEditDialog,
        closeDialog,

        // Indicator actions
        addIndicator: (indicator) => {
            console.log(`[useIndicators] Adding new indicator: ${indicator.name} (${indicator.type})`);
            console.log(`[useIndicators] Requirements for historical data may have changed`);
            addIndicator(indicator);
        },
        removeIndicator: (id) => {
            console.log(`[useIndicators] Removing indicator: ${id}`);
            removeIndicator(id);
        },
        updateIndicator: handleUpdateIndicator
    };
}
