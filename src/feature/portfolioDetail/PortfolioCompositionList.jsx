import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../../components/ui/card.jsx";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
} from "../../components/ui/chart.jsx";

const PortfolioCompositionList = ({ portfolioData }) => {
    if (!portfolioData || !portfolioData.stocks || portfolioData.stocks.length === 0) {
        return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                    <p className="text-xl text-center">No stocks data available</p>
                </CardContent>
            </Card>
        );
    }

    // Sort stocks by value in descending order and format for the chart
    const chartData = [...portfolioData.stocks]
        .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
        .map(stock => ({
            stock: stock.symbol,
            value: parseFloat(stock.value),
        }));

    const chartConfig = {
        value: {
            label: "Value",
            color: "hsl(var(--chart-1))",
        },
    };

    // Custom tooltip to match ChartTooltipContent style but show "stock: value$"
    const CustomTooltipContent = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <div className="flex items-center gap-2">
                        <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: "var(--color-value)" }}
                        />
                        <span className="text-muted-foreground">{data.stock}:</span>
                        <span className="font-mono font-medium text-foreground">
                            {data.value.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}$
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Holdings Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        layout="vertical"
                    >
                        <XAxis type="number" dataKey="value" hide />
                        <YAxis
                            dataKey="stock"
                            type="category"
                            tickLine={false}
                            tickMargin={5}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(0, 10)}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<CustomTooltipContent />}
                        />
                        <Bar dataKey="value" fill="var(--color-value)" radius={5} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="leading-none text-muted-foreground">
                    Stocks sorted by value (highest to lowest)
                </div>
            </CardFooter>
        </Card>
    );
};

export default PortfolioCompositionList;