import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../../components/ui/card.jsx";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
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
            month: stock.symbol,
            desktop: parseFloat(stock.value),
        }));

    const chartConfig = {
        desktop: {
            label: "Value",
            color: "hsl(var(--chart-1))",
        },
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
                        margin={{
                            left: -20,
                        }}
                    >
                        <XAxis type="number" dataKey="desktop" hide />
                        <YAxis
                            dataKey="month"
                            type="category"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            width={60}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={5} />
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
