// src/components/stockMarket/renderCandleChart.js
import * as d3 from 'd3';

export function renderCandleChart({
                                      chartRef,
                                      data,
                                      isLogarithmic,
                                      isDragging,
                                      setHoveredCandle,
                                      setCurrentMouseY,
                                      setActiveTimestamp,
                                      currentMouseY,
                                      mainIndicators = [],
                                      hoveredIndex,
                                      setHoveredIndex,
                                      isMouseOverChart
                                  }) {
    // Basic validation to prevent errors
    if (!data || !data.length || !chartRef.current) return;

    try {
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

        // Calculate time padding for x-axis
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
            .domain([0, d3.max(data, d => {
                const vol = Number(d.volume);
                return isNaN(vol) ? 0 : vol;
            })])
            .range([height, height * 0.8]);

        // Add axes and grid
        drawAxesAndGrid(svg, xScale, yScale, width, height);

        // Draw volume bars
        drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height);

        // Draw candles
        drawCandles(svg, data, xScale, yScale, candleWidth);
// Draw main indicators if present
        if (mainIndicators && mainIndicators.length > 0) {
            try {
                drawIndicators(svg, data, mainIndicators, xScale, yScale);
            } catch (err) {
                console.error("Error drawing indicators:", err);
                // Continue with the rest of the chart even if indicators fail
            }
        }

        // Create crosshair elements
        const {
            crosshair,
            verticalLine,
            horizontalLine,
            priceLabel,
            dateLabel
        } = createCrosshair(svg, width, height);

        // Helper function to update the crosshair and labels
        const updateCrosshair = (d, mouseY, index) => {
            // Set hovered index for indicator values
            setHoveredIndex(index);

            if (isDragging) return;
            // Don't update crosshair if dragging

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
            // Only update current mouse Y position if not dragging
            if (!isDragging) {
                const [, mouseY] = d3.pointer(event);
                setCurrentMouseY(mouseY);
            }
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
                setHoveredIndex(null);
            }
        });

        // Restore crosshair position if we have active data and we're not dragging
        if (!isDragging && hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length) {
            const hoveredCandle = data[hoveredIndex];

            if (hoveredCandle) {
                // Always show vertical line for time alignment, even when mouse is on another chart
                crosshair.style("display", null);

                // Position the vertical line at the candle's x position
                const candleX = xScale(new Date(hoveredCandle.timestamp));
                verticalLine.attr("x1", candleX).attr("x2", candleX);

                // Show date label for the hovered candle
                const dateFormat = new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                });

                const formattedDate = dateFormat.format(new Date(hoveredCandle.timestamp));
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
                        .attr("height", bbox.height + 4)
                        .style("display", null);
                }

                // Highlight the candle
                d3.select(`g.candle[data-timestamp='${hoveredCandle.timestamp}']`)
                    .select(".candle-body")
                    .attr("stroke", "#ffffff")
                    .attr("stroke-width", 1);

                // STRICTER CHECK: Only show horizontal components if the mouse is actually over THIS chart
                if (isMouseOverChart && currentMouseY !== null) {
                    horizontalLine
                        .attr("y1", currentMouseY)
                        .attr("y2", currentMouseY)
                        .style("display", null);

                    // Update price label
                    const price = yScale.invert(currentMouseY);
                    priceLabel.select("text")
                        .attr("x", width + 5)
                        .attr("y", currentMouseY)
                        .text(price.toFixed(2))
                        .style("display", null);

                    // Position price label rectangle
                    const priceLabelNode = priceLabel.select("text").node();
                    if (priceLabelNode) {
                        const bbox = priceLabelNode.getBBox();
                        priceLabel.select("rect")
                            .attr("x", width + 3)
                            .attr("y", currentMouseY - bbox.height/2 - 2)
                            .attr("width", bbox.width + 4)
                            .attr("height", bbox.height + 4)
                            .style("display", null);
                    }
                } else {
                    // Hide horizontal components when mouse is not over this chart
                    horizontalLine.style("display", "none");
                    priceLabel.select("rect").style("display", "none");
                    priceLabel.select("text").style("display", "none");
                }
            }
        }

        // Return useful information for the dragging implementation
        return {
            candleWidth,
            width,
            height
        };
    } catch (error) {
        console.error("Error rendering chart:", error);
        // At least try to clear the SVG to avoid weird states
        if (chartRef.current) {
            d3.select(chartRef.current).selectAll("*").remove();
        }
        return null;
    }
}

// NEW FUNCTION: Dedicated indicator drawing with better error handling
function drawIndicators(svg, data, indicators, xScale, yScale) {
    indicators.forEach(indicator => {
        try {
            // First check if indicator is valid
            if (!indicator || !indicator.id) {
                console.warn("Invalid indicator configuration:", indicator);
                return; // Skip this indicator
            }

            // Find a candle with a valid indicator value to determine the type
            const firstValidCandle = data.find(candle =>
                candle &&
                candle.indicatorValues &&
                candle.indicatorValues[indicator.id] !== undefined &&
                candle.indicatorValues[indicator.id] !== null
            );

            // If no valid candle found with this indicator's data, skip drawing
            if (!firstValidCandle) {
                console.log(`No data found for indicator: ${indicator.name || indicator.id}`);
                return; // Skip this indicator
            }

            const indicatorValue = firstValidCandle.indicatorValues[indicator.id];

            // Check if this is a multi-line indicator (object with multiple values)
            const isMultiValue = typeof indicatorValue === 'object' && indicatorValue !== null;

            if (isMultiValue) {
                // Safely get the keys for this multi-value indicator
                const valueKeys = Object.keys(indicatorValue);

                // Draw each component line
                valueKeys.forEach(key => {
                    try {
                        const line = d3.line()
                            .x((_, i) => {
                                if (i < data.length) {
                                    return xScale(new Date(data[i].timestamp));
                                }
                                return 0; // Safe fallback
                            })
                            .y((_, i) => {
                                // Safely access indicator value with null checks
                                if (i >= data.length) return null;
                                const candle = data[i];
                                if (!candle || !candle.indicatorValues) return null;

                                const indValue = candle.indicatorValues[indicator.id];
                                if (!indValue || indValue[key] === undefined) return null;

                                return yScale(indValue[key]);
                            })
                            .defined((_, i) => {
                                // Only include points where we have valid data
                                if (i >= data.length) return false;
                                const candle = data[i];
                                if (!candle || !candle.indicatorValues) return false;

                                const indValue = candle.indicatorValues[indicator.id];
                                return indValue && indValue[key] !== undefined && indValue[key] !== null;
                            });

                        // Customize line appearance based on indicator type and component
                        let strokeDasharray = null;
                        let strokeWidth = indicator.settings?.thickness || 2;

                        if (indicator.type === 'bb') {
                            // Bollinger Bands styling - dashed outer bands
                            if (key === 'upper' || key === 'lower') {
                                strokeDasharray = '5,3';
                                strokeWidth = 1;
                            }
                        }
                        else if (indicator.type === 'macd') {
                            // MACD styling
                            if (key === 'signal') {
                                strokeDasharray = '3,2';
                                strokeWidth = 1;
                            }
                            else if (key === 'histogram') {
                                // For histogram, we could do special handling here if needed
                                strokeWidth = 2;
                            }
                        }

                        // Use component-specific color if available, otherwise use indicator color
                        const color = indicator.settings?.[`${key}Color`] || indicator.settings?.color || '#888';

                        // Draw the line
                        svg.append("path")
                            .datum(data)
                            .attr("class", `indicator-line-${indicator.id}-${key}`)
                            .attr("fill", "none")
                            .attr("stroke", color)
                            .attr("stroke-width", strokeWidth)
                            .attr("stroke-dasharray", strokeDasharray)
                            .attr("d", line);
                    } catch (err) {
                        console.warn(`Error drawing ${key} line for indicator ${indicator.name}:`, err);
                        // Continue with other components
                    }
                });
            } else {
                // Single-value indicator (simpler case)
                try {
                    const line = d3.line()
                        .x((_, i) => {
                            if (i < data.length) {
                                return xScale(new Date(data[i].timestamp));
                            }
                            return 0;
                        })
                        .y((_, i) => {
                            // Safely access values with null checks
                            if (i >= data.length) return null;
                            const candle = data[i];
                            if (!candle || !candle.indicatorValues) return null;

                            const value = candle.indicatorValues[indicator.id];
                            return value === null || value === undefined ? null : yScale(value);
                        })
                        .defined((_, i) => {
                            // Only include points with valid data
                            if (i >= data.length) return false;
                            const candle = data[i];
                            if (!candle || !candle.indicatorValues) return false;

                            const value = candle.indicatorValues[indicator.id];
                            return value !== null && value !== undefined;
                        });

                    // Get color with fallback
                    const color = indicator.settings?.color || '#888';
                    const thickness = indicator.settings?.thickness || 2;

                    svg.append("path")
                        .datum(data)
                        .attr("class", `indicator-line-${indicator.id}`)
                        .attr("fill", "none")
                        .attr("stroke", color)
                        .attr("stroke-width", thickness)
                        .attr("d", line);
                } catch (err) {
                    console.warn(`Error drawing single-value indicator ${indicator.name}:`, err);
                }
            }
        } catch (err) {
            console.error(`Failed to draw indicator ${indicator?.name || 'unknown'}:`, err);
            // Continue with other indicators
        }
    });
}

// All other helper functions remain the same
function calculateAverageTimeInterval(timestamps) {
    if (!timestamps || timestamps.length <= 1) {
        return 24 * 60 * 60 * 1000; // Default to 1 day if not enough data
    }

    try {
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
        let totalInterval = 0;

        for (let i = 1; i < sortedTimestamps.length; i++) {
            totalInterval += sortedTimestamps[i] - sortedTimestamps[i-1];
        }

        return totalInterval / (sortedTimestamps.length - 1);
    } catch (err) {
        console.warn("Error calculating time interval:", err);
        return 24 * 60 * 60 * 1000; // Fallback to 1 day
    }
}

function createYScale(isLogarithmic, data, height) {
    try {
        // Find min/max with safety checks
        const validLows = data.filter(d => d && typeof d.low === 'number').map(d => d.low);
        const validHighs = data.filter(d => d && typeof d.high === 'number').map(d => d.high);

        const minPrice = validLows.length ? Math.min(...validLows) : 0;
        const maxPrice = validHighs.length ? Math.max(...validHighs) : 100;

        // Add padding and prevent zeros in log scale
        const safeMin = isLogarithmic ? Math.max(minPrice * 0.95, 0.01) : minPrice * 0.95;
        const safeMax = maxPrice * 1.05;

        if (isLogarithmic) {
            return d3.scaleLog()
                .base(10)
                .domain([safeMin, safeMax])
                .range([height, 0]);
        } else {
            return d3.scaleLinear()
                .domain([safeMin, safeMax])
                .range([height, 0]);
        }
    } catch (err) {
        console.error("Error creating Y scale:", err);
        // Fallback to a reasonable linear scale
        return d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);
    }
}

function drawAxesAndGrid(svg, xScale, yScale, width, height) {
    try {
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
    } catch (err) {
        console.error("Error drawing axes/grid:", err);
    }
}

function drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height) {
    try {
        svg.selectAll(".volume-bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "volume-bar")
            .attr("x", d => xScale(new Date(d.timestamp)) - candleWidth/2)
            .attr("y", d => volumeScale(d.volume || 0))
            .attr("width", candleWidth)
            .attr("height", d => height - volumeScale(d.volume || 0))
            .attr("fill", d => d.close >= d.open ? "rgba(0, 128, 0, 0.3)" : "rgba(255, 0, 0, 0.3)");
    } catch (err) {
        console.error("Error drawing volume bars:", err);
    }
}

function drawCandles(svg, data, xScale, yScale, candleWidth) {
    try {
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
    } catch (err) {
        console.error("Error drawing candles:", err);
        return svg.append("g"); // Return empty group
    }
}

function createCrosshair(svg, width, height) {
    try {
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
    } catch (err) {
        console.error("Error creating crosshair:", err);
        // Return empty objects that respond to the same methods as a fallback
        const emptySelection = {
            attr: () => emptySelection,
            style: () => emptySelection,
            select: () => emptySelection
        };
        return {
            crosshair: emptySelection,
            verticalLine: emptySelection,
            horizontalLine: emptySelection,
            priceLabel: emptySelection,
            dateLabel: emptySelection
        };
    }
}

function updateCrosshairPosition(
    d, mouseY, crosshair, verticalLine, horizontalLine,
    priceLabel, dateLabel, xScale, yScale, width, height
) {
    try {
        if (!d || !crosshair) return;

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
    } catch (err) {
        console.error("Error updating crosshair:", err);
        // Just hide the crosshair in case of error
        if (crosshair) crosshair.style("display", "none");
    }
}

function createHoverZones(
    svg, data, xScale, width, height, isDragging,
    setActiveTimestamp, setHoveredCandle, setCurrentMouseY, updateCrosshair
) {
    try {
        if (!data || !data.length) return;

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
                    // Get mouse y-position relative to chart
                    const [, mouseY] = d3.pointer(event);
                    // Update the crosshair with index for indicator values
                    updateCrosshair(d, mouseY, i);
                    // Only update if not dragging
                    if (!isDragging) {
                        setCurrentMouseY(mouseY);
                    }
                });
        });
    } catch (err) {
        console.error("Error creating hover zones:", err);
    }
}
