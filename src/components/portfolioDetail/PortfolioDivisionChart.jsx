import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card.jsx";
import { PieChart, Pie, Cell, Label, ResponsiveContainer } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "../ui/chart";

const PortfolioDivisionChart = ({ portfolioData }) => {
    if (!portfolioData) {
        return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                    <p className="text-xl text-center">No portfolio data available</p>
                </CardContent>
            </Card>
        );
    }

    // Calculate total stocks value
    const stocksValue = portfolioData.stocks?.reduce((sum, stock) => sum + parseFloat(stock.value), 0) || 0;

    // Get reserved cash value (handle either object format or direct value)
    let reservedCashValue = 0;
    if (portfolioData.reservedCash) {
        if (typeof portfolioData.reservedCash === 'object' && portfolioData.reservedCash.value !== undefined) {
            reservedCashValue = parseFloat(portfolioData.reservedCash.value);
        } else if (!isNaN(parseFloat(portfolioData.reservedCash))) {
            reservedCashValue = parseFloat(portfolioData.reservedCash);
        }
    }

    // Total portfolio value
    const totalValue = stocksValue + reservedCashValue;

    // Prepare data for the pie chart - stocks vs cash
    const chartData = [
        {
            browser: "Stocks",
            visitors: stocksValue,
            fill: "hsl(210, 70%, 50%)" // Blue for stocks
        },
        {
            browser: "Reserved Cash",
            visitors: reservedCashValue,
            fill: "hsl(120, 70%, 50%)" // Green for cash
        }
    ].filter(item => item.visitors > 0); // Only include non-zero values

    // Define chart configuration
    const chartConfig = {
        visitors: {
            label: "Value",
        },
        Stocks: {
            label: "Stocks",
            color: "hsl(210, 70%, 50%)",
        },
        "Reserved Cash": {
            label: "Reserved Cash",
            color: "hsl(120, 70%, 50%)",
        },
    };

    if (chartData.length === 0) {
        return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                    <p className="text-xl text-center">No value data available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="items-center pb-0">
                <CardTitle>Cash vs. Investments</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="visitors"
                            nameKey="browser"
                            innerRadius={60}
                            outerRadius={80}
                            strokeWidth={5}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Total Value
                                                </tspan>
                                            </text>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
                <div className="leading-none text-muted-foreground">
                    Distribution between cash reserves and investments
                </div>
            </CardFooter>
        </Card>
    );
};

export default PortfolioDivisionChart;
