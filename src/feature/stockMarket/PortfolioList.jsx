import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.jsx";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.jsx";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../components/ui/alert.jsx";
import { usePortfolios } from "../../hooks/usePortfolios.js";

const PortfolioList = ({ selectedPortfolioId }) => {
    const { fetchPortfolioDetails, isLoading } = usePortfolios();
    const [portfolioData, setPortfolioData] = useState(null);

    useEffect(() => {
        if (selectedPortfolioId) {
            fetchPortfolioDetails(selectedPortfolioId).then(data => {
                if (data) {
                    setPortfolioData(data);
                }
            });
        } else {
            setPortfolioData(null);
        }
    }, [selectedPortfolioId, fetchPortfolioDetails]);

    if (!selectedPortfolioId) {
        return (
            <Card className="w-full mb-4">
                <CardContent className="flex items-center justify-center p-6">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Please select a portfolio to view holdings
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card className="w-full mb-4">
                <CardContent className="flex items-center justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    if (!portfolioData) {
        return (
            <Card className="w-full mb-4">
                <CardContent className="flex items-center justify-center p-6">
                    <p className="text-center">No portfolio data available</p>
                </CardContent>
            </Card>
        );
    }

    // Prepare stocks data
    const stocksChartData = portfolioData.stocks && portfolioData.stocks.length > 0
        ? [...portfolioData.stocks]
            .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
            .map(stock => ({
                month: stock.symbol,
                desktop: parseFloat(stock.value),
            }))
        : [];

    // Prepare cash vs stocks data
    const stocksValue = portfolioData.stocks?.reduce((sum, stock) => sum + parseFloat(stock.value), 0) || 0;

    let reservedCashValue = 0;
    if (portfolioData.reservedCash) {
        if (typeof portfolioData.reservedCash === 'object' && portfolioData.reservedCash.value !== undefined) {
            reservedCashValue = parseFloat(portfolioData.reservedCash.value);
        } else if (!isNaN(parseFloat(portfolioData.reservedCash))) {
            reservedCashValue = parseFloat(portfolioData.reservedCash);
        }
    }

    const divisionChartData = [
        { month: "Stocks", desktop: stocksValue },
        { month: "Cash", desktop: reservedCashValue }
    ].filter(item => item.desktop > 0);

    const chartConfig = {
        desktop: {
            label: "Value",
            color: "var(--chart-home-fixed)",
        },
    };

    return (
        <Card className="w-full mb-4">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Holdings</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
                <Tabs defaultValue="stocks" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="stocks">Stocks</TabsTrigger>
                        <TabsTrigger value="division">Cash vs Stocks</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stocks">
                        {stocksChartData.length === 0 ? (
                            <div className="flex items-center justify-center p-6 min-h-[150px]">
                                <p className="text-center text-sm text-muted-foreground">No stocks data available</p>
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-[150px]">
                                <BarChart
                                    accessibilityLayer
                                    data={stocksChartData}
                                    layout="vertical"
                                >
                                    <XAxis type="number" dataKey="desktop" hide />
                                    <YAxis
                                        dataKey="month"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
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
                        )}
                    </TabsContent>

                    <TabsContent value="division">
                        {divisionChartData.length === 0 ? (
                            <div className="flex items-center justify-center p-6 min-h-[150px]">
                                <p className="text-center text-sm text-muted-foreground">No value data available</p>
                            </div>
                        ) : (
                            <ChartContainer config={chartConfig} className="h-[150px]">
                                <BarChart
                                    accessibilityLayer
                                    data={divisionChartData}
                                    layout="vertical"
                                >
                                    <XAxis type="number" dataKey="desktop" hide />
                                    <YAxis
                                        dataKey="month"
                                        type="category"
                                        tickLine={false}
                                        tickMargin={5}
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
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default PortfolioList;