import * as d3 from 'd3';

export function renderCandleChart({
                                      chartRef,
                                      data,
                                      isLogarithmic,
                                      isDragging,
                                      setHoveredCandle,
                                      setCurrentMouseY,
                                      setActiveTimestamp,
                                      activeTimestamp,
                                      currentMouseY,
                                      displayedCandles
                                  }) {
    if (!data.length || !chartRef.current) return;

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions
    const margin = { top: 20, right: 60, bottom: 40, left: 60 };
    const width = chartRef.current.clientWidth - margin.left - margin.right;
    const height = chartRef.current.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(chartRef.current)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate candle width based on chart width and data length
    const candleWidth = Math.max(
        Math.min((width / data.length) * 0.8, 20),
        1
    );

    // Calculate time padding for x-axis to ensure candles don't get cut off
    const timestamps = data.map(d => new Date(d.timestamp));
    const timeExtent = d3.extent(timestamps);

    // Calculate the average time interval between adjacent timestamps
    let avgInterval = calculateAverageTimeInterval(timestamps);

    // Create padded domain with half the average interval on each side
    const paddedDomain = [
        new Date(timeExtent[0].getTime() - avgInterval/2),
        new Date(timeExtent[1].getTime() + avgInterval/2)
    ];

    // Set up scales
    const xScale = d3.scaleTime()
        .domain(paddedDomain)
        .range([0, width]);

    const yScale = createYScale(isLogarithmic, data, height);

    const volumeScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.volume)])
        .range([height, height * 0.8]);

    // Add axes and grid
    drawAxesAndGrid(svg, xScale, yScale, width, height);

    // Draw volume bars
    drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height);

    // Draw candles
    const candles = drawCandles(svg, data, xScale, yScale, candleWidth);

    // Create crosshair elements
    const {
        crosshair,
        verticalLine,
        horizontalLine,
        priceLabel,
        dateLabel
    } = createCrosshair(svg, width, height);

    // Helper function to update the crosshair and labels
    const updateCrosshair = (d, mouseY) => {
        // Don't update crosshair if dragging
        if (isDragging) return;

        updateCrosshairPosition(
            d, mouseY, crosshair, verticalLine, horizontalLine,
            priceLabel, dateLabel, xScale, yScale, width, height
        );
    };

    // Create hover zones
    createHoverZones(
        svg, data, xScale, width, height, isDragging,
        setActiveTimestamp, setHoveredCandle, setCurrentMouseY, updateCrosshair
    );

    svg.on("mousemove", function(event) {
        // Always update current mouse Y position regardless of dragging state
        const [, mouseY] = d3.pointer(event);
        setCurrentMouseY(mouseY);
    });

    // Add mouseleave handler
    svg.on("mouseleave", () => {
        // Only clear crosshair if not dragging
        if (!isDragging) {
            d3.selectAll(".candle-body").attr("stroke", "none");
            crosshair.style("display", "none");
            setHoveredCandle(null);
            setCurrentMouseY(null);
            setActiveTimestamp(null);
        }
    });

    // Restore crosshair position if we have active data and we're not dragging
    if (!isDragging && activeTimestamp && currentMouseY !== null) {
        const activeCandle = data.find(d => d.timestamp === activeTimestamp);
        if (activeCandle) {
            updateCrosshair(activeCandle, currentMouseY);
        }
    }

    // Return useful information for the dragging implementation
    return {
        candleWidth,
        width,
        height
    };
}

// Helper functions remain the same as in the original file
function calculateAverageTimeInterval(timestamps) {
    if (timestamps.length <= 1) {
        return 24 * 60 * 60 * 1000; // Default to 1 day if not enough data
    }

    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    let totalInterval = 0;

    for (let i = 1; i < sortedTimestamps.length; i++) {
        totalInterval += sortedTimestamps[i] - sortedTimestamps[i-1];
    }

    return totalInterval / (sortedTimestamps.length - 1);
}

function createYScale(isLogarithmic, data, height) {
    if (isLogarithmic) {
        return d3.scaleLog()
            .base(10)
            .domain([
                d3.min(data, d => d.low) * 0.95,
                d3.max(data, d => d.high) * 1.05
            ])
            .range([height, 0]);
    } else {
        return d3.scaleLinear()
            .domain([
                d3.min(data, d => d.low) * 0.95,
                d3.max(data, d => d.high) * 1.05
            ])
            .range([height, 0]);
    }
}

function drawAxesAndGrid(svg, xScale, yScale, width, height) {
    // X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

    // Y axis
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Grid lines
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(
            d3.axisBottom(xScale)
                .tickSize(-height)
                .tickFormat("")
        )
        .attr("stroke-opacity", 0.1);

    svg.append("g")
        .attr("class", "grid")
        .call(
            d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat("")
        )
        .attr("stroke-opacity", 0.1);
}

function drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height) {
    svg.selectAll(".volume-bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "volume-bar")
        .attr("x", d => xScale(new Date(d.timestamp)) - candleWidth/2)
        .attr("y", d => volumeScale(d.volume))
        .attr("width", candleWidth)
        .attr("height", d => height - volumeScale(d.volume))
        .attr("fill", d => d.close >= d.open ? "rgba(0, 128, 0, 0.3)" : "rgba(255, 0, 0, 0.3)");
}

function drawCandles(svg, data, xScale, yScale, candleWidth) {
    const candles = svg.selectAll(".candle")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "candle")
        .attr("data-timestamp", d => d.timestamp);

    // Wicks (high-low lines)
    candles.append("line")
        .attr("class", "wick")
        .attr("x1", d => xScale(new Date(d.timestamp)))
        .attr("x2", d => xScale(new Date(d.timestamp)))
        .attr("y1", d => yScale(d.high))
        .attr("y2", d => yScale(d.low))
        .attr("stroke", d => d.close >= d.open ? "green" : "red")
        .attr("stroke-width", 1);

    // Candle bodies
    candles.append("rect")
        .attr("class", "candle-body")
        .attr("x", d => xScale(new Date(d.timestamp)) - candleWidth/2)
        .attr("y", d => yScale(Math.max(d.open, d.close)))
        .attr("width", candleWidth)
        .attr("height", d => Math.abs(yScale(d.open) - yScale(d.close)))
        .attr("fill", d => d.close >= d.open ? "green" : "red");

    return candles;
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

    // Price label (right side)
    const priceLabel = crosshair.append("g")
        .attr("class", "price-label");

    priceLabel.append("rect")
        .attr("fill", "rgba(0, 0, 0, 0.7)")
        .attr("rx", 3)
        .attr("ry", 3);

    priceLabel.append("text")
        .attr("fill", "white")
        .attr("font-size", "10px")
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle");

    // Date label (bottom)
    const dateLabel = crosshair.append("g")
        .attr("class", "date-label");

    dateLabel.append("rect")
        .attr("fill", "rgba(0, 0, 0, 0.7)")
        .attr("rx", 3)
        .attr("ry", 3);

    dateLabel.append("text")
        .attr("fill", "white")
        .attr("font-size", "10px")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "text-before-edge");

    return { crosshair, verticalLine, horizontalLine, priceLabel, dateLabel };
}

function updateCrosshairPosition(
    d, mouseY, crosshair, verticalLine, horizontalLine,
    priceLabel, dateLabel, xScale, yScale, width, height
) {
    // Position the crosshair
    const candleX = xScale(new Date(d.timestamp));

    // Show crosshair
    crosshair.style("display", null);

    // Remove any existing highlights
    d3.selectAll(".candle-body").attr("stroke", "none");

    // Highlight this candle
    d3.select(`g.candle[data-timestamp='${d.timestamp}']`)
        .select(".candle-body")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);

    // Position vertical line at candle center
    verticalLine.attr("x1", candleX).attr("x2", candleX);

    // Update horizontal line
    horizontalLine.attr("y1", mouseY).attr("y2", mouseY);

    // Get price at this y-position
    const price = yScale.invert(mouseY);

    // Update price label
    priceLabel.select("text")
        .attr("x", width + 5)
        .attr("y", mouseY)
        .text(price.toFixed(2));

    // Position price label rectangle
    const priceLabelNode = priceLabel.select("text").node();
    if (priceLabelNode) {
        const bbox = priceLabelNode.getBBox();
        priceLabel.select("rect")
            .attr("x", width + 3)
            .attr("y", mouseY - bbox.height/2 - 2)
            .attr("width", bbox.width + 4)
            .attr("height", bbox.height + 4);
    }

    // Update the date label
    const dateFormat = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });

    const formattedDate = dateFormat.format(new Date(d.timestamp));
    dateLabel.select("text")
        .attr("x", candleX)
        .attr("y", height + 5)
        .text(formattedDate);

    // Position date label rectangle
    const dateLabelNode = dateLabel.select("text").node();
    if (dateLabelNode) {
        const bbox = dateLabelNode.getBBox();
        dateLabel.select("rect")
            .attr("x", candleX - bbox.width/2 - 4)
            .attr("y", height + 3)
            .attr("width", bbox.width + 8)
            .attr("height", bbox.height + 4);
    }
}

function createHoverZones(
    svg, data, xScale, width, height, isDragging,
    setActiveTimestamp, setHoveredCandle, setCurrentMouseY, updateCrosshair
) {
    // Calculate the x-positions of each candle
    const positions = data.map(d => xScale(new Date(d.timestamp)));

    // Create a container for all hover zones
    const hoverZones = svg.append("g").attr("class", "hover-zones");

    // Add an invisible rectangle for each candle that spans the full height
    data.forEach((d, i) => {
        // Calculate left and right boundaries
        let left, right;

        if (i === 0) {
            // First candle - extend left to the chart edge
            left = 0;
        } else {
            // Mid-point between this candle and previous one
            left = (positions[i] + positions[i-1]) / 2;
        }

        if (i === data.length - 1) {
            // Last candle - extend right to the chart edge
            right = width;
        } else {
            // Mid-point between this candle and next one
            right = (positions[i] + positions[i+1]) / 2;
        }

        // Create the hover detection zone
        hoverZones.append("rect")
            .attr("x", left)
            .attr("y", 0)
            .attr("width", right - left)
            .attr("height", height)
            .attr("fill", "transparent")
            .on("mouseenter", () => {
                // Always update the active timestamp regardless of dragging state
                setActiveTimestamp(d.timestamp);

                // Only update hovered candle if not dragging
                if (!isDragging) {
                    setHoveredCandle(d);
                }
            })
            .on("mousemove", function(event) {
                // Only update if not dragging
                if (!isDragging) {
                    // Get mouse y-position relative to chart
                    const [, mouseY] = d3.pointer(event);
                    setCurrentMouseY(mouseY);

                    // Update the crosshair
                    updateCrosshair(d, mouseY);
                }
            });
    });
}
