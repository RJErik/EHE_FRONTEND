// src/components/stockMarket/indicators/renderIndicatorChart.js
import * as d3 from 'd3';

export function renderIndicatorChart({
                                         chartRef,
                                         data,
                                         indicator,
                                         isDragging,
                                         setActiveTimestamp,
                                         setCurrentMouseY,
                                         setHoveredIndex
                                     }) {
    if (!data || !chartRef.current) return () => {};

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions
    const margin = { top: 5, right: 40, bottom: 5, left: 5 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = chartRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(chartRef.current)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Handle different data formats
    if (Array.isArray(data)) {
        drawSingleLine(svg, data, width, height, indicator.settings.color, indicator.settings.thickness);
    } else {
        // Multiple lines (e.g., MACD, Bollinger Bands)
        drawMultipleLines(svg, data, width, height, indicator);
    }

    // Add Y axis
    const yScale = getYScale(data, height);
    svg.append("g")
        .call(d3.axisRight(yScale).ticks(4))
        .attr("transform", `translate(${width},0)`);

    // Create crosshair elements
    const crosshair = createCrosshair(svg, width, height);

    // Create hover detection zone
    createHoverZone(svg, width, height, isDragging, setActiveTimestamp, setHoveredIndex, setCurrentMouseY);

    // Cleanup function
    return () => {
        d3.select(chartRef.current).selectAll("*").remove();
    };
}

function drawSingleLine(svg, data, width, height, color, thickness) {
    const xScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([
            d3.min(data, d => d === null ? Infinity : d) * 0.99,
            d3.max(data, d => d === null ? -Infinity : d) * 1.01
        ])
        .range([height, 0])
        .nice();

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

function drawMultipleLines(svg, data, width, height, indicator) {
    const xScale = d3.scaleLinear()
        .domain([0, Object.values(data)[0].length - 1])
        .range([0, width]);

    // Calculate global min/max across all lines
    let allValues = [];
    Object.values(data).forEach(values => {
        allValues = allValues.concat(values.filter(v => v !== null));
    });

    const yScale = d3.scaleLinear()
        .domain([
            d3.min(allValues) * 0.99,
            d3.max(allValues) * 1.01
        ])
        .range([height, 0])
        .nice();

    // Create line generator
    const line = d3.line()
        .x((d, i) => xScale(i))
        .y(d => d === null ? null : yScale(d))
        .defined(d => d !== null);

    // Draw each line
    Object.entries(data).forEach(([key, values], i) => {
        // This is a simplification - in a real app you'd have dedicated colors for each line
        const color = i === 0 ? indicator.settings.color :
            i === 1 ? lightenColor(indicator.settings.color, 20) :
                darkenColor(indicator.settings.color, 20);

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

    crosshair.append("line")
        .attr("class", "crosshair-vertical")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#888")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    crosshair.append("line")
        .attr("class", "crosshair-horizontal")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("stroke", "#888")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    return crosshair;
}

function createHoverZone(svg, width, height, isDragging, setActiveTimestamp, setHoveredIndex, setCurrentMouseY) {
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .on("mousemove", function(event) {
            if (isDragging) return;

            const [mouseX, mouseY] = d3.pointer(event);
            const dataIndex = Math.round((mouseX / width) * 100);

            setHoveredIndex(dataIndex);
            setCurrentMouseY(mouseY);
        })
        .on("mouseleave", () => {
            if (!isDragging) {
                setHoveredIndex(null);
                setCurrentMouseY(null);
            }
        });
}

// Utility to lighten a hex color
function lightenColor(hex, percent) {
    // Implementation of color lightening logic
    return hex; // Simplified for this example
}

// Utility to darken a hex color
function darkenColor(hex, percent) {
    // Implementation of color darkening logic
    return hex; // Simplified for this example
}
