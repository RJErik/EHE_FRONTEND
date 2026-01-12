import * as d3 from 'd3';

export function renderCandleChart({
                                      chartRef,
                                      data,
                                      isLogarithmic,
                                      isDragging,
                                      setCurrentMouseY,
                                      setActiveTimestamp,
                                      currentMouseY,
                                      mainIndicators = [],
                                      hoveredIndex,
                                      setHoveredIndex,
                                      isMouseOverChart
                                  }) {
    if (!data || !data.length || !chartRef.current) return;

    try {
        d3.select(chartRef.current).selectAll("*").remove();

        const margin = { top: 20, right: 60, bottom: 40, left: 60 };
        const width = chartRef.current.clientWidth - margin.left - margin.right;
        const height = chartRef.current.clientHeight - margin.top - margin.bottom;

        const svg = d3.select(chartRef.current)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Calculate candle width based on number of data points
        const candleWidth = Math.max(
            Math.min((width / data.length) * 0.8, 20),
            1
        );

        // === KEY CHANGE: Use index-based scale instead of time-based ===
        // This collapses gaps where there's no data (weekends, holidays)
        const xScale = d3.scaleLinear()
            .domain([0, data.length - 1])
            .range([candleWidth / 2, width - candleWidth / 2]);

        // Helper function to get x position for a data point
        const getX = (d, i) => xScale(i);

        const yScale = createYScale(isLogarithmic, data, height);

        const volumeScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => {
                const vol = Number(d.volume);
                return isNaN(vol) ? 0 : vol;
            })])
            .range([height, height * 0.8]);

        // Draw axes and grid with index-based scale
        drawAxesAndGrid(svg, data, xScale, yScale, width, height);

        // Draw volume bars using index
        drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height);

        // Draw candles using index
        drawCandles(svg, data, xScale, yScale, candleWidth);

        if (mainIndicators && mainIndicators.length > 0) {
            try {
                drawIndicators(svg, data, mainIndicators, xScale, yScale);
            } catch (err) {
                console.error("Error drawing indicators:", err);
            }
        }

        const {
            crosshair,
            verticalLine,
            horizontalLine,
            priceLabel,
            dateLabel
        } = createCrosshair(svg, width, height);

        const updateCrosshair = (d, mouseY, index) => {
            setHoveredIndex(index);

            if (isDragging) return;

            updateCrosshairPosition(
                d, mouseY, index, crosshair, verticalLine, horizontalLine,
                priceLabel, dateLabel, xScale, yScale, width, height
            );
        };

        createHoverZones(
            svg, data, xScale, width, height, isDragging,
            setActiveTimestamp, setCurrentMouseY, updateCrosshair, setHoveredIndex
        );

        svg.on("mousemove", function(event) {
            if (!isDragging) {
                const [, mouseY] = d3.pointer(event);
                setCurrentMouseY(mouseY);
            }
        });

        svg.on("mouseleave", () => {
            if (!isDragging) {
                d3.selectAll(".candle-body").attr("stroke", "none");
                crosshair.style("display", "none");
                setHoveredIndex(null);
                setCurrentMouseY(null);
                setActiveTimestamp(null);
            }
        });

        if (!isDragging && hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length) {
            const hoveredCandle = data[hoveredIndex];

            if (hoveredCandle) {
                crosshair.style("display", null);

                const candleX = xScale(hoveredIndex);
                verticalLine.attr("x1", candleX).attr("x2", candleX);

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

                d3.select(`g.candle[data-timestamp='${hoveredCandle.timestamp}']`)
                    .select(".candle-body")
                    .attr("stroke", "#ffffff")
                    .attr("stroke-width", 1);

                if (isMouseOverChart && currentMouseY !== null) {
                    horizontalLine
                        .attr("y1", currentMouseY)
                        .attr("y2", currentMouseY)
                        .style("display", null);

                    const price = yScale.invert(currentMouseY);
                    priceLabel.select("text")
                        .attr("x", width + 5)
                        .attr("y", currentMouseY)
                        .text(price.toFixed(2))
                        .style("display", null);

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
                    horizontalLine.style("display", "none");
                    priceLabel.select("rect").style("display", "none");
                    priceLabel.select("text").style("display", "none");
                }
            }
        }

        return {
            candleWidth,
            width,
            height
        };
    } catch (error) {
        console.error("Error rendering chart:", error);
        if (chartRef.current) {
            d3.select(chartRef.current).selectAll("*").remove();
        }
        return null;
    }
}

function drawIndicators(svg, data, indicators, xScale, yScale) {
    indicators.forEach(indicator => {
        try {
            if (!indicator || !indicator.id) {
                console.warn("Invalid indicator configuration:", indicator);
                return;
            }

            const firstValidCandle = data.find(candle =>
                candle &&
                candle.indicatorValues &&
                candle.indicatorValues[indicator.id] !== undefined &&
                candle.indicatorValues[indicator.id] !== null
            );

            if (!firstValidCandle) {
                console.log(`No data found for indicator: ${indicator.name || indicator.id}`);
                return;
            }

            const indicatorValue = firstValidCandle.indicatorValues[indicator.id];
            const isMultiValue = typeof indicatorValue === 'object' && indicatorValue !== null;

            if (isMultiValue) {
                const valueKeys = Object.keys(indicatorValue);

                valueKeys.forEach(key => {
                    try {
                        // Use index-based x positioning
                        const line = d3.line()
                            .x((_, i) => xScale(i))
                            .y((_, i) => {
                                if (i >= data.length) return null;
                                const candle = data[i];
                                if (!candle || !candle.indicatorValues) return null;

                                const indValue = candle.indicatorValues[indicator.id];
                                if (!indValue || indValue[key] === undefined) return null;

                                return yScale(indValue[key]);
                            })
                            .defined((_, i) => {
                                if (i >= data.length) return false;
                                const candle = data[i];
                                if (!candle || !candle.indicatorValues) return false;

                                const indValue = candle.indicatorValues[indicator.id];
                                return indValue && indValue[key] !== undefined && indValue[key] !== null;
                            });

                        let strokeDasharray = null;
                        let strokeWidth = indicator.settings?.thickness || 2;

                        if (indicator.type === 'bb') {
                            if (key === 'upper' || key === 'lower') {
                                strokeDasharray = '5,3';
                                strokeWidth = 1;
                            }
                        }
                        else if (indicator.type === 'macd') {
                            if (key === 'signal') {
                                strokeDasharray = '3,2';
                                strokeWidth = 1;
                            }
                            else if (key === 'histogram') {
                                strokeWidth = 2;
                            }
                        }

                        const color = indicator.settings?.[`${key}Color`] || indicator.settings?.color || '#888';

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
                    }
                });
            } else {
                try {
                    // Use index-based x positioning
                    const line = d3.line()
                        .x((_, i) => xScale(i))
                        .y((_, i) => {
                            if (i >= data.length) return null;
                            const candle = data[i];
                            if (!candle || !candle.indicatorValues) return null;

                            const value = candle.indicatorValues[indicator.id];
                            return value === null || value === undefined ? null : yScale(value);
                        })
                        .defined((_, i) => {
                            if (i >= data.length) return false;
                            const candle = data[i];
                            if (!candle || !candle.indicatorValues) return false;

                            const value = candle.indicatorValues[indicator.id];
                            return value !== null && value !== undefined;
                        });

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
        }
    });
}

function createYScale(isLogarithmic, data, height) {
    try {
        const validLows = data.filter(d => d && typeof d.low === 'number').map(d => d.low);
        const validHighs = data.filter(d => d && typeof d.high === 'number').map(d => d.high);

        const minPrice = validLows.length ? Math.min(...validLows) : 0;
        const maxPrice = validHighs.length ? Math.max(...validHighs) : 100;

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
        return d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);
    }
}

/**
 * Draw axes and grid - now using index-based x-axis with date labels
 */
function drawAxesAndGrid(svg, data, xScale, yScale, width, height) {
    try {
        // Determine appropriate tick count based on data length and width
        const maxTicks = Math.min(Math.floor(width / 80), data.length, 10);

        // Create custom x-axis that shows dates at data point indices
        const xAxis = d3.axisBottom(xScale)
            .ticks(maxTicks)
            .tickFormat(i => {
                const index = Math.round(i);
                if (index >= 0 && index < data.length) {
                    const date = new Date(data[index].timestamp);
                    return formatAxisDate(date, data);
                }
                return '';
            });

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "middle");

        svg.append("g")
            .call(d3.axisLeft(yScale));

        // Grid lines
        svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height})`)
            .call(
                d3.axisBottom(xScale)
                    .ticks(maxTicks)
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

/**
 * Format date for axis labels based on data timeframe
 */
function formatAxisDate(date, data) {
    if (!date || !data || data.length < 2) {
        return d3.timeFormat("%b %d")(date);
    }

    // Estimate timeframe from data
    const firstTimestamp = data[0].timestamp;
    const lastTimestamp = data[data.length - 1].timestamp;
    const avgInterval = (lastTimestamp - firstTimestamp) / (data.length - 1);

    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;

    if (avgInterval < ONE_HOUR) {
        // Intraday (minutes)
        return d3.timeFormat("%H:%M")(date);
    } else if (avgInterval < ONE_DAY) {
        // Hourly
        return d3.timeFormat("%b %d %H:%M")(date);
    } else if (avgInterval < 7 * ONE_DAY) {
        // Daily
        return d3.timeFormat("%b %d")(date);
    } else {
        // Weekly or longer
        return d3.timeFormat("%b %d '%y")(date);
    }
}

/**
 * Draw volume bars using index-based positioning
 */
function drawVolumeBars(svg, data, xScale, volumeScale, candleWidth, height) {
    try {
        svg.selectAll(".volume-bar")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "volume-bar")
            .attr("x", (d, i) => xScale(i) - candleWidth/2)
            .attr("y", d => volumeScale(d.volume || 0))
            .attr("width", candleWidth)
            .attr("height", d => height - volumeScale(d.volume || 0))
            .attr("fill", d => d.close >= d.open ? "rgba(0, 128, 0, 0.3)" : "rgba(255, 0, 0, 0.3)");
    } catch (err) {
        console.error("Error drawing volume bars:", err);
    }
}

/**
 * Draw candles using index-based positioning
 */
function drawCandles(svg, data, xScale, yScale, candleWidth) {
    try {
        const candles = svg.selectAll(".candle")
            .data(data)
            .enter()
            .append("g")
            .attr("class", "candle")
            .attr("data-timestamp", d => d.timestamp)
            .attr("data-index", (d, i) => i);

        // Wick (high-low line)
        candles.append("line")
            .attr("class", "wick")
            .attr("x1", (d, i) => xScale(i))
            .attr("x2", (d, i) => xScale(i))
            .attr("y1", d => yScale(d.high))
            .attr("y2", d => yScale(d.low))
            .attr("stroke", d => d.close >= d.open ? "green" : "red")
            .attr("stroke-width", 1);

        // Candle body
        candles.append("rect")
            .attr("class", "candle-body")
            .attr("x", (d, i) => xScale(i) - candleWidth/2)
            .attr("y", d => yScale(Math.max(d.open, d.close)))
            .attr("width", candleWidth)
            .attr("height", d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
            .attr("fill", d => d.close >= d.open ? "green" : "red");

        return candles;
    } catch (err) {
        console.error("Error drawing candles:", err);
        return svg.append("g");
    }
}

function createCrosshair(svg, width, height) {
    try {
        const crosshair = svg.append("g")
            .attr("class", "crosshair")
            .style("display", "none");

        const verticalLine = crosshair.append("line")
            .attr("class", "crosshair-vertical")
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#888")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        const horizontalLine = crosshair.append("line")
            .attr("class", "crosshair-horizontal")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("stroke", "#888")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

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

/**
 * Update crosshair position - now using index for x position
 */
function updateCrosshairPosition(
    d, mouseY, index, crosshair, verticalLine, horizontalLine,
    priceLabel, dateLabel, xScale, yScale, width, height
) {
    try {
        if (!d || !crosshair) return;

        // Use index for x position
        const candleX = xScale(index);

        crosshair.style("display", null);

        d3.selectAll(".candle-body").attr("stroke", "none");

        d3.select(`g.candle[data-timestamp='${d.timestamp}']`)
            .select(".candle-body")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1);

        verticalLine.attr("x1", candleX).attr("x2", candleX);
        horizontalLine.attr("y1", mouseY).attr("y2", mouseY);

        const price = yScale.invert(mouseY);

        priceLabel.select("text")
            .attr("x", width + 5)
            .attr("y", mouseY)
            .text(price.toFixed(2));

        const priceLabelNode = priceLabel.select("text").node();
        if (priceLabelNode) {
            const bbox = priceLabelNode.getBBox();
            priceLabel.select("rect")
                .attr("x", width + 3)
                .attr("y", mouseY - bbox.height/2 - 2)
                .attr("width", bbox.width + 4)
                .attr("height", bbox.height + 4);
        }

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
        if (crosshair) crosshair.style("display", "none");
    }
}

/**
 * Create hover zones using index-based positioning
 */
function createHoverZones(
    svg, data, xScale, width, height, isDragging,
    setActiveTimestamp, setCurrentMouseY, updateCrosshair, setHoveredIndex
) {
    try {
        if (!data || !data.length) return;

        const hoverZones = svg.append("g").attr("class", "hover-zones");

        data.forEach((d, i) => {
            // Calculate zone boundaries based on index
            let left, right;

            if (i === 0) {
                left = 0;
            } else {
                left = (xScale(i) + xScale(i - 1)) / 2;
            }

            if (i === data.length - 1) {
                right = width;
            } else {
                right = (xScale(i) + xScale(i + 1)) / 2;
            }

            hoverZones.append("rect")
                .attr("x", left)
                .attr("y", 0)
                .attr("width", right - left)
                .attr("height", height)
                .attr("fill", "transparent")
                .on("mouseenter", () => {
                    setActiveTimestamp(d.timestamp);

                    if (!isDragging) {
                        setHoveredIndex(i);
                    }
                })
                .on("mousemove", function(event) {
                    const [, mouseY] = d3.pointer(event);
                    updateCrosshair(d, mouseY, i);
                    if (!isDragging) {
                        setCurrentMouseY(mouseY);
                    }
                });
        });
    } catch (err) {
        console.error("Error creating hover zones:", err);
    }
}