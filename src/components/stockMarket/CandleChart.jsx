// src/components/stockMarket/CandleChart.jsx

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "../ui/card.jsx";
import * as d3 from "d3";
import { generateMockCandleData, generateNewCandle } from "../../utils/mockDataGenerator.js";
import { Button } from "../ui/button.jsx";
import { Switch } from "../ui/switch.jsx";

const CandleChart = () => {
    const chartRef = useRef(null);
    const [data, setData] = useState([]);
    const [isLogarithmic, setIsLogarithmic] = useState(false);
    const [hoveredData, setHoveredData] = useState(null);
    const [realtimeEnabled, setRealtimeEnabled] = useState(true);
    const intervalRef = useRef(null);
    const svgRef = useRef(null);

    // Changed to track hoveredTimestamp instead of hoveredIndex
    const chartStateRef = useRef({
        hoveredTimestamp: null,
        mouseY: null,
        lastDrawTime: 0
    });

    const elementsRef = useRef({
        crosshair: null,
        priceLabel: null,
        dateLabel: null,
        infoBox: null
    });

    // Initialize with mock data
    useEffect(() => {
        setData(generateMockCandleData(100));
    }, []);

    // Simulate real-time updates based on toggle state
    useEffect(() => {
        if (realtimeEnabled) {
            intervalRef.current = setInterval(() => {
                if (data.length > 0) {
                    const newCandle = generateNewCandle(data[data.length - 1]);
                    setData(prevData => {
                        const newData = [...prevData.slice(-199), newCandle];
                        // Use setTimeout to ensure chart has fully redrawn
                        setTimeout(() => {
                            if (chartStateRef.current.hoveredTimestamp !== null) {
                                updateCrosshairPosition();
                            }
                        }, 50);
                        return newData;
                    });
                }
            }, 5000); // Update every 5 seconds
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [realtimeEnabled, data]);

    // Function to manually add a new candle
    const addNewCandle = () => {
        if (data.length > 0) {
            const newCandle = generateNewCandle(data[data.length - 1]);
            setData(prevData => {
                const newData = [...prevData.slice(-199), newCandle];
                setTimeout(() => {
                    if (chartStateRef.current.hoveredTimestamp !== null) {
                        updateCrosshairPosition();
                    }
                }, 50);
                return newData;
            });
        }
    };

    // Function to update crosshair position after data changes
    const updateCrosshairPosition = () => {
        if (!elementsRef.current.crosshair ||
            chartStateRef.current.hoveredTimestamp === null ||
            !svgRef.current) {
            return;
        }

        // Ensure we don't call this too frequently
        const now = Date.now();
        if (now - chartStateRef.current.lastDrawTime < 16) { // ~60fps
            return;
        }
        chartStateRef.current.lastDrawTime = now;

        try {
            // Sort data by timestamp
            const sortedData = [...data].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            // Find the closest data point to the hovered timestamp
            const hoveredTimestamp = chartStateRef.current.hoveredTimestamp;

            // Find the closest timestamp in the data
            let closestIndex = 0;
            let closestDiff = Infinity;

            sortedData.forEach((point, idx) => {
                const diff = Math.abs(new Date(point.timestamp).getTime() - hoveredTimestamp);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = idx;
                }
            });

            const point = sortedData[closestIndex];
            if (!point) return;

            // Get current transform
            const transform = d3.zoomTransform(svgRef.current);

            // Get chart dimensions
            const chart = d3.select(chartRef.current);
            const svg = d3.select(svgRef.current);
            const chartGroup = svg.select(".chart-group");
            const width = parseFloat(chart.style("width"));
            const height = parseFloat(chart.style("height"));

            // Recreate scales
            const margin = { top: 30, right: 60, bottom: 50, left: 60 };
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;

            // Create temp scales based on current data
            const xScale = d3.scaleTime()
                .domain(d3.extent(sortedData, d => new Date(d.timestamp)))
                .range([0, chartWidth]);

            const yScale = isLogarithmic
                ? d3.scaleLog()
                    .base(10)
                    .domain([
                        d3.min(sortedData, d => d.low) * 0.95,
                        d3.max(sortedData, d => d.high) * 1.05
                    ])
                    .range([chartHeight, 0])
                : d3.scaleLinear()
                    .domain([
                        d3.min(sortedData, d => d.low) * 0.95,
                        d3.max(sortedData, d => d.high) * 1.05
                    ])
                    .range([chartHeight, 0]);

            // Apply zoom transform to scales
            const currentXScale = transform.rescaleX(xScale);
            const currentYScale = transform.k > 1 && transform.rescaleY
                ? transform.rescaleY(yScale)
                : yScale;

            // Get the position of the candle
            const snappedX = currentXScale(new Date(point.timestamp));
            const mouseY = chartStateRef.current.mouseY || chartHeight / 2;
            const priceAtMouse = currentYScale.invert(mouseY);

            // Update crosshair position
            elementsRef.current.crosshair.style("display", null);
            elementsRef.current.crosshair.select(".crosshair-x")
                .attr("x1", snappedX)
                .attr("x2", snappedX);

            elementsRef.current.crosshair.select(".crosshair-y")
                .attr("y1", mouseY)
                .attr("y2", mouseY);

            // Update price label position
            elementsRef.current.priceLabel.style("display", null);
            elementsRef.current.priceLabel.attr("transform", `translate(0,${mouseY})`);
            elementsRef.current.priceLabel.select("text").text(priceAtMouse.toFixed(2));

            // Update date label position
            elementsRef.current.dateLabel.style("display", null);
            elementsRef.current.dateLabel.attr("transform", `translate(${snappedX - 40},${chartHeight})`);

            // Format date
            const dateFormat = new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const pointDateFormat = dateFormat.format(new Date(point.timestamp));
            elementsRef.current.dateLabel.select("text").text(pointDateFormat);

            // Calculate change and percentage
            const change = (point.close - point.open).toFixed(2);
            const changePercent = ((point.close - point.open) / point.open * 100).toFixed(2);

            // Update hover data
            setHoveredData({
                date: pointDateFormat,
                open: point.open.toFixed(2),
                high: point.high.toFixed(2),
                low: point.low.toFixed(2),
                close: point.close.toFixed(2),
                change: change,
                changePercent: changePercent,
                volume: point.volume.toFixed(0)
            });
        } catch (error) {
            console.error("Error updating crosshair:", error);
        }
    };

    // D3 chart rendering with zoom, pan and crosshair
    useEffect(() => {
        if (!data.length || !chartRef.current) return;

        const renderChart = () => {
            // Clear previous chart
            d3.select(chartRef.current).selectAll("*").remove();

            // Set dimensions
            const margin = { top: 30, right: 60, bottom: 50, left: 60 };
            const width = chartRef.current.clientWidth - margin.left - margin.right;
            const height = chartRef.current.clientHeight - margin.top - margin.bottom;

            // Create SVG
            const svg = d3.select(chartRef.current)
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom);

            svgRef.current = svg.node();

            // Create the main chart group with margins
            const chartGroup = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`)
                .attr("class", "chart-group");

            // Sort data by timestamp to ensure proper ordering
            const sortedData = [...data].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            // Set up scales
            const xScale = d3.scaleTime()
                .domain(d3.extent(sortedData, d => new Date(d.timestamp)))
                .range([0, width]);

            // Y scale (toggle between linear and logarithmic)
            const yScale = isLogarithmic
                ? d3.scaleLog()
                    .base(10)
                    .domain([
                        d3.min(sortedData, d => d.low) * 0.95,  // Add 5% padding
                        d3.max(sortedData, d => d.high) * 1.05
                    ])
                    .range([height, 0])
                : d3.scaleLinear()
                    .domain([
                        d3.min(sortedData, d => d.low) * 0.95,  // Add 5% padding
                        d3.max(sortedData, d => d.high) * 1.05
                    ])
                    .range([height, 0]);

            // Volume scale (at bottom 20% of chart)
            const volumeScale = d3.scaleLinear()
                .domain([0, d3.max(sortedData, d => d.volume)])
                .range([height, height * 0.8]);

            // Create clip path
            svg.append("defs")
                .append("clipPath")
                .attr("id", "chart-area")
                .append("rect")
                .attr("width", width)
                .attr("height", height);

            // Add grid
            const gridGroup = chartGroup.append("g")
                .attr("class", "grid-group");

            // X grid
            gridGroup.append("g")
                .attr("class", "grid x-grid")
                .attr("transform", `translate(0,${height})`)
                .call(
                    d3.axisBottom(xScale)
                        .tickSize(-height)
                        .tickFormat("")
                )
                .attr("stroke-opacity", 0.1);

            // Y grid
            gridGroup.append("g")
                .attr("class", "grid y-grid")
                .call(
                    d3.axisLeft(yScale)
                        .tickSize(-width)
                        .tickFormat("")
                )
                .attr("stroke-opacity", 0.1);

            // Create a group for all data visualization elements with clipping
            const dataGroup = chartGroup.append("g")
                .attr("clip-path", "url(#chart-area)")
                .attr("class", "data-group");

            // Calculate band width based on time intervals
            const calculateBandWidth = () => {
                if (sortedData.length <= 1) return width * 0.01;

                // Calculate average time interval between candles
                let intervals = [];
                for (let i = 1; i < sortedData.length; i++) {
                    intervals.push(
                        new Date(sortedData[i].timestamp) - new Date(sortedData[i-1].timestamp)
                    );
                }
                // Use median interval to avoid outliers skewing the calculation
                intervals.sort((a, b) => a - b);
                const medianInterval = intervals[Math.floor(intervals.length / 2)];

                // Convert time interval to pixels
                const date1 = new Date();
                const date2 = new Date(date1.getTime() + medianInterval);
                return Math.abs(xScale(date2) - xScale(date1));
            };

            const bandWidth = calculateBandWidth();

            // ============= CREATE SNAPPING REGIONS ===============
            // Create regions for each candle that will be used for snapping
            const snappingRegions = dataGroup.append("g")
                .attr("class", "snapping-regions");

            // Calculate boundaries for snapping regions
            for (let i = 0; i < sortedData.length; i++) {
                const currentTime = new Date(sortedData[i].timestamp);
                const timestamp = currentTime.getTime(); // Store actual timestamp

                // Calculate left and right boundaries
                let leftBoundary, rightBoundary;

                if (i === 0) {
                    // For the first candle
                    if (sortedData.length > 1) {
                        const nextTime = new Date(sortedData[i + 1].timestamp);
                        const interval = nextTime - currentTime;
                        leftBoundary = new Date(currentTime.getTime() - interval / 2);
                    } else {
                        // If there's only one candle
                        leftBoundary = new Date(currentTime.getTime() - 3600000); // 1 hour before
                    }
                } else {
                    // For other candles, halfway from previous
                    const prevTime = new Date(sortedData[i - 1].timestamp);
                    leftBoundary = new Date(prevTime.getTime() + (currentTime - prevTime) / 2);
                }

                if (i === sortedData.length - 1) {
                    // For the last candle
                    if (sortedData.length > 1) {
                        const prevTime = new Date(sortedData[i - 1].timestamp);
                        const interval = currentTime - prevTime;
                        rightBoundary = new Date(currentTime.getTime() + interval / 2);
                    } else {
                        // If there's only one candle
                        rightBoundary = new Date(currentTime.getTime() + 3600000); // 1 hour after
                    }
                } else {
                    // For other candles, halfway to next
                    const nextTime = new Date(sortedData[i + 1].timestamp);
                    rightBoundary = new Date(currentTime.getTime() + (nextTime - currentTime) / 2);
                }

                // Create snapping region rectangle
                snappingRegions.append("rect")
                    .attr("class", "snapping-region")
                    .attr("x", xScale(leftBoundary))
                    .attr("y", 0)
                    .attr("width", xScale(rightBoundary) - xScale(leftBoundary))
                    .attr("height", height)
                    .attr("fill", "transparent")  // Invisible
                    .attr("stroke", "none")
                    .attr("data-index", i)
                    .attr("data-timestamp", timestamp) // Store timestamp as data attribute
                    .attr("pointer-events", "all") // Capture mouse events
                    .on("mousemove", function(event) {
                        const timestamp = +d3.select(this).attr("data-timestamp");
                        const dataIndex = parseInt(d3.select(this).attr("data-index"));
                        handleSnappedMouseMove(event, dataIndex, timestamp);
                    })
                    .on("mouseleave", function(event) {
                        // Only clear if we're leaving the chart area, not just moving between regions
                        const [x, y] = d3.pointer(event, chartGroup.node());
                        if (x < 0 || x > width || y < 0 || y > height) {
                            hideCrosshair();
                        }
                    });
            }

            // Draw volume bars
            const volumeBars = dataGroup.append("g")
                .attr("class", "volume-bars")
                .selectAll(".volume-bar")
                .data(sortedData)
                .enter()
                .append("rect")
                .attr("class", "volume-bar")
                .attr("x", d => xScale(new Date(d.timestamp)) - (bandWidth * 0.4))
                .attr("y", d => volumeScale(d.volume))
                .attr("width", bandWidth * 0.8)
                .attr("height", d => height - volumeScale(d.volume))
                .attr("fill", d => d.close >= d.open ? "rgba(0, 128, 0, 0.3)" : "rgba(255, 0, 0, 0.3)");

            // Draw candles
            const candleGroup = dataGroup.append("g")
                .attr("class", "candle-group");

            const candles = candleGroup.selectAll(".candle")
                .data(sortedData)
                .enter()
                .append("g")
                .attr("class", "candle")
                .attr("data-index", (d, i) => i)
                .attr("data-timestamp", d => new Date(d.timestamp).getTime());

            // Wicks (high-low lines)
            candles.append("line")
                .attr("class", "wick")
                .attr("x1", d => xScale(new Date(d.timestamp)))
                .attr("x2", d => xScale(new Date(d.timestamp)))
                .attr("y1", d => yScale(d.high))
                .attr("y2", d => yScale(d.low))
                .attr("stroke", d => d.close >= d.open ? "#26a69a" : "#ef5350")
                .attr("stroke-width", 1);

            // Candle bodies
            candles.append("rect")
                .attr("class", "candle-body")
                .attr("x", d => xScale(new Date(d.timestamp)) - (bandWidth * 0.4))
                .attr("y", d => yScale(Math.max(d.open, d.close)))
                .attr("width", bandWidth * 0.8)
                .attr("height", d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
                .attr("fill", d => d.close >= d.open ? "#26a69a" : "#ef5350")
                .on("mouseover", function() {
                    d3.select(this)
                        .attr("stroke", "white")
                        .attr("stroke-width", 1);
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .attr("stroke", null)
                        .attr("stroke-width", 0);
                });

            // Add X axis
            const xAxis = chartGroup.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(xScale));

            // Add Y axis
            const yAxis = chartGroup.append("g")
                .attr("class", "y-axis")
                .call(d3.axisLeft(yScale));

            // Add crosshair container
            const crosshair = chartGroup.append("g")
                .attr("class", "crosshair")
                .style("display", "none");

            // Store reference to crosshair
            elementsRef.current.crosshair = crosshair;

            // Add vertical line
            crosshair.append("line")
                .attr("class", "crosshair-x")
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");

            // Add horizontal line
            crosshair.append("line")
                .attr("class", "crosshair-y")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");

            // Add price label on RIGHT side of y-axis
            const priceLabel = chartGroup.append("g")
                .attr("class", "price-label")
                .style("display", "none");

            // Store reference to price label
            elementsRef.current.priceLabel = priceLabel;

            priceLabel.append("rect")
                .attr("x", width)
                .attr("width", margin.right - 1)
                .attr("height", 20)
                .attr("fill", "#2a2e39");

            priceLabel.append("text")
                .attr("x", width + 5)
                .attr("y", 5)
                .attr("dy", ".7em")
                .attr("text-anchor", "start")
                .attr("fill", "white")
                .style("font-size", "11px");

            // Add date label on x-axis
            const dateLabel = chartGroup.append("g")
                .attr("class", "date-label")
                .attr("transform", `translate(0,${height})`)
                .style("display", "none");

            // Store reference to date label
            elementsRef.current.dateLabel = dateLabel;

            dateLabel.append("rect")
                .attr("y", 1)
                .attr("height", 20)
                .attr("width", 80)
                .attr("fill", "#2a2e39");

            dateLabel.append("text")
                .attr("x", 40)
                .attr("y", 16)
                .attr("text-anchor", "middle")
                .attr("fill", "white")
                .style("font-size", "11px");

            // Create data info box at top
            const infoBox = chartGroup.append("g")
                .attr("class", "info-box")
                .attr("transform", "translate(10, -20)")
                .style("display", "none");

            // Store reference to info box
            elementsRef.current.infoBox = infoBox;

            infoBox.append("text")
                .attr("class", "info-text")
                .attr("fill", "white")
                .style("font-size", "12px");

            // Define zoom behavior
            const zoom = d3.zoom()
                .scaleExtent([0.5, 20])  // Min and max zoom scale
                .extent([[0, 0], [width, height]])
                .on("zoom", (event) => {
                    // Get the new transform
                    const transform = event.transform;

                    // Apply zoom transform to scales
                    const newXScale = transform.rescaleX(xScale);

                    // Only rescale y if ctrl key is pressed (vertical zoom)
                    let newYScale;
                    if (event.sourceEvent && event.sourceEvent.ctrlKey) {
                        newYScale = transform.rescaleY(yScale);
                    } else {
                        newYScale = yScale;
                    }

                    // Update the axes
                    xAxis.call(d3.axisBottom(newXScale));
                    yAxis.call(d3.axisLeft(newYScale));

                    // Update grid
                    gridGroup.select(".x-grid")
                        .call(
                            d3.axisBottom(newXScale)
                                .tickSize(-height)
                                .tickFormat("")
                        );

                    gridGroup.select(".y-grid")
                        .call(
                            d3.axisLeft(newYScale)
                                .tickSize(-width)
                                .tickFormat("")
                        );

                    // Recalculate band width for the new scale
                    const newBandWidth = bandWidth * transform.k;

                    // Update snapping regions
                    snappingRegions.selectAll(".snapping-region")
                        .attr("x", function() {
                            const i = +d3.select(this).attr("data-index");
                            const currentTime = new Date(sortedData[i].timestamp);

                            let leftBoundary;
                            if (i === 0) {
                                if (sortedData.length > 1) {
                                    const nextTime = new Date(sortedData[i + 1].timestamp);
                                    const interval = nextTime - currentTime;
                                    leftBoundary = new Date(currentTime.getTime() - interval / 2);
                                } else {
                                    leftBoundary = new Date(currentTime.getTime() - 3600000);
                                }
                            } else {
                                const prevTime = new Date(sortedData[i - 1].timestamp);
                                leftBoundary = new Date(prevTime.getTime() + (currentTime - prevTime) / 2);
                            }

                            return newXScale(leftBoundary);
                        })
                        .attr("width", function() {
                            const i = +d3.select(this).attr("data-index");
                            const currentTime = new Date(sortedData[i].timestamp);

                            let leftBoundary, rightBoundary;
                            if (i === 0) {
                                if (sortedData.length > 1) {
                                    const nextTime = new Date(sortedData[i + 1].timestamp);
                                    const interval = nextTime - currentTime;
                                    leftBoundary = new Date(currentTime.getTime() - interval / 2);
                                } else {
                                    leftBoundary = new Date(currentTime.getTime() - 3600000);
                                }
                            } else {
                                const prevTime = new Date(sortedData[i - 1].timestamp);
                                leftBoundary = new Date(prevTime.getTime() + (currentTime - prevTime) / 2);
                            }

                            if (i === sortedData.length - 1) {
                                if (sortedData.length > 1) {
                                    const prevTime = new Date(sortedData[i - 1].timestamp);
                                    const interval = currentTime - prevTime;
                                    rightBoundary = new Date(currentTime.getTime() + interval / 2);
                                } else {
                                    rightBoundary = new Date(currentTime.getTime() + 3600000);
                                }
                            } else {
                                const nextTime = new Date(sortedData[i + 1].timestamp);
                                rightBoundary = new Date(currentTime.getTime() + (nextTime - currentTime) / 2);
                            }

                            return newXScale(rightBoundary) - newXScale(leftBoundary);
                        });

                    // Update candles position and size
                    candles.select(".wick")
                        .attr("x1", d => newXScale(new Date(d.timestamp)))
                        .attr("x2", d => newXScale(new Date(d.timestamp)))
                        .attr("y1", d => newYScale(d.high))
                        .attr("y2", d => newYScale(d.low));

                    candles.select(".candle-body")
                        .attr("x", d => newXScale(new Date(d.timestamp)) - (newBandWidth * 0.4))
                        .attr("y", d => newYScale(Math.max(d.open, d.close)))
                        .attr("width", newBandWidth * 0.8)
                        .attr("height", d => Math.max(1, Math.abs(newYScale(d.open) - newYScale(d.close))));

                    // Update volume bars
                    volumeBars
                        .attr("x", d => newXScale(new Date(d.timestamp)) - (newBandWidth * 0.4))
                        .attr("y", d => volumeScale(d.volume))
                        .attr("width", newBandWidth * 0.8);

                    // Update crosshair if currently visible
                    if (chartStateRef.current.hoveredTimestamp !== null) {
                        updateCrosshairPosition();
                    }
                });

            // Apply zoom behavior to SVG
            svg.call(zoom);

            // Global chart background for general mouse movement
            chartGroup.append("rect")
                .attr("class", "chart-background")
                .attr("width", width)
                .attr("height", height)
                .attr("fill", "transparent")
                .style("pointer-events", "none"); // Don't catch events, let them pass through

            // Function to handle mouse move for each snapping region
            function handleSnappedMouseMove(event, index, timestamp) {
                const [mouseX, mouseY] = d3.pointer(event);

                // Store the hovered timestamp and mouse Y position
                chartStateRef.current.hoveredTimestamp = timestamp;
                chartStateRef.current.mouseY = mouseY;

                // Get the current point from the sorted data
                const point = sortedData[index];

                // Get current scales from zoom
                const transform = d3.zoomTransform(svg.node());
                const currentXScale = transform.rescaleX(xScale);
                const currentYScale = transform.k > 1 && transform.rescaleY
                    ? transform.rescaleY(yScale)
                    : yScale;

                // Get the position of the selected candle
                const snappedX = currentXScale(new Date(point.timestamp));
                const priceAtMouse = currentYScale.invert(mouseY);

                // Update the crosshair
                crosshair.style("display", null);
                crosshair.select(".crosshair-x")
                    .attr("x1", snappedX)
                    .attr("x2", snappedX);

                crosshair.select(".crosshair-y")
                    .attr("y1", mouseY)
                    .attr("y2", mouseY);

                // Show and update price label
                priceLabel.style("display", null);
                priceLabel.attr("transform", `translate(0,${mouseY})`);
                priceLabel.select("text").text(priceAtMouse.toFixed(2));

                // Show and update date label
                dateLabel.style("display", null);
                dateLabel.attr("transform", `translate(${snappedX - 40},${height})`);

                // Format date
                const dateFormat = new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const pointDateFormat = dateFormat.format(new Date(point.timestamp));
                dateLabel.select("text").text(pointDateFormat);

                // Calculate change and percentage
                const change = (point.close - point.open).toFixed(2);
                const changePercent = ((point.close - point.open) / point.open * 100).toFixed(2);

                // Update hover data
                setHoveredData({
                    date: pointDateFormat,
                    open: point.open.toFixed(2),
                    high: point.high.toFixed(2),
                    low: point.low.toFixed(2),
                    close: point.close.toFixed(2),
                    change: change,
                    changePercent: changePercent,
                    volume: point.volume.toFixed(0)
                });

                // Show info box
                infoBox.style("display", null);
            }

            // Function to hide crosshair and reset hover state
            function hideCrosshair() {
                chartStateRef.current.hoveredTimestamp = null;
                chartStateRef.current.mouseY = null;

                if (elementsRef.current.crosshair) {
                    elementsRef.current.crosshair.style("display", "none");
                }
                if (elementsRef.current.priceLabel) {
                    elementsRef.current.priceLabel.style("display", "none");
                }
                if (elementsRef.current.dateLabel) {
                    elementsRef.current.dateLabel.style("display", "none");
                }
                if (elementsRef.current.infoBox) {
                    elementsRef.current.infoBox.style("display", "none");
                }

                setHoveredData(null);
            }

            // Handle mouse leave for the entire chart area
            svg.on("mouseleave", hideCrosshair);

            // Reset zoom button
            svg.append("g")
                .attr("class", "reset-button")
                .attr("transform", `translate(${width + margin.left - 30}, ${margin.top + 10})`)
                .append("circle")
                .attr("r", 10)
                .attr("fill", "#2a2e39")
                .attr("stroke", "#cccccc")
                .attr("stroke-width", 1)
                .attr("cursor", "pointer")
                .on("click", () => {
                    svg.transition().duration(750).call(
                        zoom.transform,
                        d3.zoomIdentity
                    );
                });

            svg.select(".reset-button")
                .append("text")
                .attr("text-anchor", "middle")
                .attr("dy", "0.3em")
                .attr("fill", "white")
                .style("font-size", "10px")
                .style("pointer-events", "none")
                .text("R");

            // If there was a previously hovered timestamp, try to restore it
            if (chartStateRef.current.hoveredTimestamp !== null) {
                setTimeout(() => {
                    updateCrosshairPosition();
                }, 100);
            }
        };

        renderChart();

        // Add window resize handler
        const handleResize = () => {
            if (chartRef.current) {
                renderChart();
            }
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [data, isLogarithmic]);

    return (
        <Card className="w-full h-80 dark">
            <CardContent className="flex flex-col h-full py-4 px-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex space-x-2 items-center">
                        <div className="text-xs text-gray-300">
                            {hoveredData ? (
                                <div className="flex space-x-4">
                                    <span>{hoveredData.date}</span>
                                    <span>O: <span className="text-white">{hoveredData.open}</span></span>
                                    <span>H: <span className="text-white">{hoveredData.high}</span></span>
                                    <span>L: <span className="text-white">{hoveredData.low}</span></span>
                                    <span>C: <span className="text-white">{hoveredData.close}</span></span>
                                    <span className={hoveredData.change >= 0 ? "text-green-500" : "text-red-500"}>
                                        {hoveredData.changePercent}%
                                    </span>
                                    <span>Vol: <span className="text-white">{parseInt(hoveredData.volume).toLocaleString()}</span></span>
                                </div>
                            ) : (
                                <span>Hover over chart to view data</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-300">Real-time</span>
                            <Switch
                                checked={realtimeEnabled}
                                onCheckedChange={setRealtimeEnabled}
                                className="data-[state=checked]:bg-green-500"
                            />
                        </div>

                        {!realtimeEnabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addNewCandle}
                                className="text-xs h-7 bg-gray-700 hover:bg-gray-600"
                            >
                                Add Candle
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsLogarithmic(!isLogarithmic)}
                            className="text-xs h-7 bg-gray-700 hover:bg-gray-600"
                        >
                            {isLogarithmic ? "Linear" : "Log"} Scale
                        </Button>
                    </div>
                </div>
                <div
                    ref={chartRef}
                    className="flex-1 w-full h-full bg-[#131722]"
                    style={{ touchAction: "none" }} // Prevents browser handling of touch gestures
                ></div>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
