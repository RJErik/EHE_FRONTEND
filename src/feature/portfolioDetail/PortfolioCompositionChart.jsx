import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../../components/ui/card.jsx";
import { PieChart, Pie, Label } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "../../components/ui/chart.jsx";

const PortfolioCompositionChart = ({ portfolioData }) => {
    if (!portfolioData || !portfolioData.stocks || portfolioData.stocks.length === 0) {
        return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center p-6 h-full min-h-[320px]">
                    <p className="text-xl text-center">No stocks data available</p>
                </CardContent>
            </Card>
        );
    }

    // Prepare data for the pie chart
    const chartData = portfolioData.stocks.map((stock, index) => ({
        stock: stock.symbol,
        value: parseFloat(stock.value),
        fill: `hsl(${(index * 40) % 360}, 70%, 50%)`
    }));

    const totalStocksValue = chartData.reduce((sum, item) => sum + item.value, 0);

    const chartConfig = {
        value: {
            label: "Value",
        },
        ...Object.fromEntries(
            chartData.map((item, index) => [
                item.stock,
                {
                    label: item.stock,
                    color: `hsl(${(index * 40) % 360}, 70%, 50%)`,
                }
            ])
        )
    };

    return (
        <Card className="flex flex-col h-full">
            <CardHeader className="items-center pb-0">
                <CardTitle>Portfolio Composition</CardTitle>
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
                            dataKey="value"
                            nameKey="stock"
                            innerRadius={60}
                            outerRadius={80}
                            strokeWidth={5}
                        >
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
                                                    ${totalStocksValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Stocks Value
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
                    Distribution of investments by stock
                </div>
            </CardFooter>
        </Card>
    );
};

export default PortfolioCompositionChart;