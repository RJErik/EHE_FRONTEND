// src/components/stockMarket/indicators/renderIndicatorChart.js
import * as d3 from 'd3';

export function renderIndicatorChart({
                                         chartRef,
                                         data,
                                         indicator,
                                         isDragging,
                                         setActiveTimestamp,
                                         setCurrentMouseY,
                                         setHoveredIndex,
                                         hoveredIndex,
                                         currentMouseY,
                                         isMouseOverChart
                                     }) {
    if (!data || !chartRef.current) return () => {};

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions
    const margin = { top: 5, right: 40, bottom: 5, left: 40 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = chartRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(chartRef.current)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Setup scales
    const xScale = d3.scaleLinear()
        .domain([0, Array.isArray(data) ? data.length - 1 : Object.values(data)[0].length - 1])
        .range([0, width]);

    const yScale = getYScale(data, height);

    // Handle different data formats
    if (Array.isArray(data)) {
        drawSingleLine(svg, data, xScale, yScale, indicator.settings.color, indicator.settings.thickness);
    } else {
        // Multiple lines (e.g., MACD, Bollinger Bands)
        drawMultipleLines(svg, data, xScale, yScale, indicator);
    }

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(4));

    // Create crosshair elements
    const {
        crosshair,
        verticalLine,
        horizontalLine,
        valueLabel
    } = createCrosshair(svg, width, height);

    // Create hover detection zone
    createHoverZone(
        svg, width, height, isDragging,
        setActiveTimestamp, setHoveredIndex, setCurrentMouseY,
        data, xScale, yScale, crosshair, verticalLine, horizontalLine, valueLabel
    );

    // If we have a hovered index and mouse is over chart, show the crosshair at that position
    if (hoveredIndex !== null && hoveredIndex !== undefined && isMouseOverChart && !isDragging) {
        updateCrosshair(
            hoveredIndex,
            currentMouseY || height / 2, // Use current mouse Y if available, otherwise middle
            data,
            xScale,
            yScale,
            crosshair,
            verticalLine,
            horizontalLine,
            valueLabel,
            width
        );
    } else if (!isMouseOverChart || isDragging) {
        // Hide crosshair if mouse is not over chart or dragging
        crosshair.style("display", "none");
    }

    // Cleanup function
    return () => {
        d3.select(chartRef.current).selectAll("*").remove();
    };
}

function drawSingleLine(svg, data, xScale, yScale, color, thickness) {
    // Create line generator
    const line = d3.line()
        .x((d, i) => xScale(i))
        .y(d => d === null ? null : yScale(d))
        .defined(d => d !== null);

    // Draw line
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", thickness)
        .attr("d", line);
}

function drawMultipleLines(svg, data, xScale, yScale, indicator) {
    // Draw each line
    Object.entries(data).forEach(([key, values], i) => {
        // Determine color based on index and indicator settings
        const color = i === 0 ? indicator.settings.color :
            i === 1 ? lightenColor(indicator.settings.color, 20) :
                darkenColor(indicator.settings.color, 20);

        // Create line generator
        const line = d3.line()
            .x((d, i) => xScale(i))
            .y(d => d === null ? null : yScale(d))
            .defined(d => d !== null);

        // Draw line
        svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", indicator.settings.thickness)
            .attr("d", line);
    });
}

function getYScale(data, height) {
    if (Array.isArray(data)) {
        return d3.scaleLinear()
            .domain([
                d3.min(data, d => d === null ? Infinity : d) * 0.99,
                d3.max(data, d => d === null ? -Infinity : d) * 1.01
            ])
            .range([height, 0])
            .nice();
    } else {
        // For multi-line indicators
        let allValues = [];
        Object.values(data).forEach(values => {
            allValues = allValues.concat(values.filter(v => v !== null));
        });

        return d3.scaleLinear()
            .domain([
                d3.min(allValues) * 0.99,
                d3.max(allValues) * 1.01
            ])
            .range([height, 0])
            .nice();
    }
}

function createCrosshair(svg, width, height) {
    const crosshair = svg.append("g")
        .attr("class", "crosshair")
        .style("display", "none");

    // Vertical crosshair line
    const verticalLine = crosshair.append("line")
        .attr("class", "crosshair-vertical")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#888")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Horizontal crosshair line
    const horizontalLine = crosshair.append("line")
        .attr("class", "crosshair-horizontal")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("stroke", "#888")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // Value label (right side)
    const valueLabel = crosshair.append("g")
        .attr("class", "value-label");

    valueLabel.append("rect")
        .attr("fill", "rgba(0, 0, 0, 0.7)")
        .attr("rx", 3)
        .attr("ry", 3);

    valueLabel.append("text")
        .attr("fill", "white")
        .attr("font-size", "10px")
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle");

    return { crosshair, verticalLine, horizontalLine, valueLabel };
}

function createHoverZone(
    svg, width, height, isDragging,
    setActiveTimestamp, setHoveredIndex, setCurrentMouseY,
    data, xScale, yScale, crosshair, verticalLine, horizontalLine, valueLabel
) {
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mousemove", function(event) {
            if (isDragging) return;

            const [mouseX, mouseY] = d3.pointer(event);

            // Calculate index based on x position
            const dataIndex = Math.round(xScale.invert(mouseX));

            // Ensure index is valid
            const maxIndex = Array.isArray(data) ?
                data.length - 1 :
                Object.values(data)[0].length - 1;

            const boundedIndex = Math.max(0, Math.min(dataIndex, maxIndex));

            // Update context state
            setHoveredIndex(boundedIndex);
            setCurrentMouseY(mouseY);

            // Update crosshair
            updateCrosshair(
                boundedIndex,
                mouseY,
                data,
                xScale,
                yScale,
                crosshair,
                verticalLine,
                horizontalLine,
                valueLabel,
                width
            );
        });
}

function updateCrosshair(
    index,
    mouseY,
    data,
    xScale,
    yScale,
    crosshair,
    verticalLine,
    horizontalLine,
    valueLabel,
    width
) {
    // Only proceed if we have valid data
    if (index === null || (Array.isArray(data) && index >= data.length)) {
        crosshair.style("display", "none");
        return;
    }

    // Show crosshair
    crosshair.style("display", null);

    // Get X position
    const xPos = xScale(index);

    // Position vertical line
    verticalLine.attr("x1", xPos).attr("x2", xPos);

    // Position horizontal line - use local mouseY position, not synchronized
    horizontalLine.attr("y1", mouseY).attr("y2", mouseY);

    // Get the value for this position (handling both array and object data)
    let value;
    if (Array.isArray(data)) {
        value = data[index];
    } else {
        // For multiple lines, use the first series
        const firstKey = Object.keys(data)[0];
        value = data[firstKey][index];
    }

    // Only update value label if we have a valid value
    if (value !== null && value !== undefined) {
        // Get value at current Y position
        const displayValue = yScale.invert(mouseY);

        // Update value label
        valueLabel.select("text")
            .attr("x", width + 5)
            .attr("y", mouseY)
            .text(displayValue.toFixed(2));

        // Position value label rectangle
        const valueLabelNode = valueLabel.select("text").node();
        if (valueLabelNode) {
            const bbox = valueLabelNode.getBBox();
            valueLabel.select("rect")
                .attr("x", width + 3)
                .attr("y", mouseY - bbox.height/2 - 2)
                .attr("width", bbox.width + 4)
                .attr("height", bbox.height + 4);
        }
    }
}

// Utility functions to lighten and darken colors
function lightenColor(hex, percent) {
    // Implementation of color lightening logic
    return hex; // Simplified for this example
}

function darkenColor(hex, percent) {
    // Implementation of color darkening logic
    return hex; // Simplified for this example
}
