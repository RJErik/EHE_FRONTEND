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

    // Always show the vertical line if we have a valid hoveredIndex, even when mouse is not over chart
    if (hoveredIndex !== null && hoveredIndex !== undefined && !isDragging) {
        // Show crosshair group
        crosshair.style("display", null);

        // Get X position
        const xPos = xScale(hoveredIndex);

        // Position vertical line
        verticalLine.attr("x1", xPos).attr("x2", xPos);

        // Only show horizontal line and value label if mouse is over THIS chart
        if (isMouseOverChart) {
            // Position horizontal line using local mouseY
            horizontalLine.attr("y1", currentMouseY || height / 2)
                .attr("y2", currentMouseY || height / 2)
                .style("display", null);

            // Update value label for hover position
            updateValueLabel(
                currentMouseY || height / 2,
                yScale,
                valueLabel,
                width
            );
        } else {
            // Hide horizontal components when mouse is not over this chart
            horizontalLine.style("display", "none");
            valueLabel.style("display", "none");
        }
    } else {
        // Hide everything if no valid hoveredIndex
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
    // Special handling for MACD indicator
    if (indicator.type === 'macd') {
        // Draw histogram as bars
        if (data.histogram && data.histogram.some(d => d !== null)) {
            svg.selectAll(".macd-histogram")
                .data(data.histogram)
                .enter()
                .append("rect")
                .attr("class", "macd-histogram")
                .attr("x", (d, i) => xScale(i) - 1)
                .attr("y", d => d > 0 ? yScale(d) : yScale(0))
                .attr("width", 2)
                .attr("height", d => d > 0 ? yScale(0) - yScale(d) : yScale(d) - yScale(0))
                .attr("fill", (d) => d > 0 ?
                    lightenColor(indicator.settings.color, 20) :
                    darkenColor(indicator.settings.color, 20));
        }

        // Draw MACD line
        const macdLine = d3.line()
            .x((d, i) => xScale(i))
            .y(d => d === null ? null : yScale(d))
            .defined(d => d !== null);

        svg.append("path")
            .datum(data.macd)
            .attr("fill", "none")
            .attr("stroke", indicator.settings.color)
            .attr("stroke-width", indicator.settings.thickness)
            .attr("d", macdLine);

        // Draw signal line
        const signalLine = d3.line()
            .x((d, i) => xScale(i))
            .y(d => d === null ? null : yScale(d))
            .defined(d => d !== null);

        svg.append("path")
            .datum(data.signal)
            .attr("fill", "none")
            .attr("stroke", lightenColor(indicator.settings.color, 40))
            .attr("stroke-width", indicator.settings.thickness)
            .attr("d", signalLine);

        return;
    }

    // Draw each line for other multi-line indicators
    Object.entries(data).forEach(([, values], i) => {
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
    const valueLabel = svg.append("g")
        .attr("class", "value-label")
        .style("display", "none");

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

            // Update context state for both vertical and horizontal components
            setHoveredIndex(boundedIndex);
            setCurrentMouseY(mouseY);

            // NEW: Update activeTimestamp to synchronize with candle chart
            // For array data, there's no timestamp in the indicator data directly
            // so we need to rely on the hoveredIndex for synchronization
            setActiveTimestamp(boundedIndex);

            // Update crosshair - show both vertical and horizontal components
            updateCrosshair(
                boundedIndex,
                mouseY,
                xScale,
                verticalLine,
                horizontalLine,
                height,
                true
            );

            // Update value label
            updateValueLabel(
                mouseY,
                yScale,
                valueLabel,
                width
            );
        });
}

// Split the crosshair update function to separately handle vertical and horizontal components
function updateCrosshair(
    index,
    mouseY,
    xScale,
    verticalLine,
    horizontalLine,
    height,
    showHorizontal
) {
    // Get X position
    const xPos = xScale(index);

    // Position vertical line
    verticalLine.attr("x1", xPos).attr("x2", xPos);

    // Position horizontal line - only if showHorizontal is true
    if (showHorizontal) {
        horizontalLine.attr("y1", mouseY).attr("y2", mouseY)
            .style("display", null);
    } else {
        horizontalLine.style("display", "none");
    }
}

// Separate function to update value label
function updateValueLabel(
    mouseY,
    yScale,
    valueLabel,
    width
) {
    // Get value at current Y position
    const displayValue = yScale.invert(mouseY);

    // Show value label
    valueLabel.style("display", null);

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

// Utility functions to lighten and darken colors
function lightenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse the hex color
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Lighten each component
    r = Math.min(255, Math.floor(r * (100 + percent) / 100));
    g = Math.min(255, Math.floor(g * (100 + percent) / 100));
    b = Math.min(255, Math.floor(b * (100 + percent) / 100));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse the hex color
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Darken each component
    r = Math.max(0, Math.floor(r * (100 - percent) / 100));
    g = Math.max(0, Math.floor(g * (100 - percent) / 100));
    b = Math.max(0, Math.floor(b * (100 - percent) / 100));

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
