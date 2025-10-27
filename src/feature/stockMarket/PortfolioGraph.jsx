import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card.jsx";
import { PieChart, Pie, Cell, Label } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.jsx";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../../components/ui/alert.jsx";
import { usePortfolio } from "../../hooks/usePortfolio.js";

const PortfolioGraph = ({ selectedPortfolioId }) => {
    const { fetchPortfolioDetails, isLoading } = usePortfolio();
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
                            Please select a portfolio to view the graph
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

    // Prepare stocks composition data
    const stocksChartData = portfolioData.stocks && portfolioData.stocks.length > 0
        ? portfolioData.stocks.map((stock, index) => ({
            browser: stock.symbol,
            visitors: parseFloat(stock.value),
            fill: `hsl(${(index * 40) % 360}, 70%, 50%)`
        }))
        : [];

    const totalStocksValue = stocksChartData.reduce((sum, item) => sum + item.visitors, 0);

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

    const totalValue = stocksValue + reservedCashValue;

    const divisionChartData = [
        {
            browser: "Stocks",
            visitors: stocksValue,
            fill: "hsl(210, 70%, 50%)"
        },
        {
            browser: "Reserved Cash",
            visitors: reservedCashValue,
            fill: "hsl(120, 70%, 50%)"
        }
    ].filter(item => item.visitors > 0);

    const stocksChartConfig = {
        visitors: {
            label: "Value",
        },
        ...Object.fromEntries(
            stocksChartData.map((item, index) => [
                item.browser,
                {
                    label: item.browser,
                    color: `hsl(${(index * 40) % 360}, 70%, 50%)`,
                }
            ])
        )
    };

    const divisionChartConfig = {
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

    return (
        <Card className="w-full mb-4 flex flex-col">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Portfolio Composition</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-2">
                <Tabs defaultValue="composition" className="w-full h-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="composition">Stocks</TabsTrigger>
                        <TabsTrigger value="division">Cash vs Stocks</TabsTrigger>
                    </TabsList>

                    <TabsContent value="composition">
                        {stocksChartData.length === 0 ? (
                            <div className="flex items-center justify-center p-6 min-h-[120px]">
                                <p className="text-center text-sm text-muted-foreground">No stocks data available</p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={stocksChartConfig}
                                className="mx-auto aspect-square max-h-[120px]"
                            >
                                <PieChart>
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Pie
                                        data={stocksChartData}
                                        dataKey="visitors"
                                        nameKey="browser"
                                        innerRadius={30}
                                        outerRadius={50}
                                        strokeWidth={3}
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
                                                                className="fill-foreground text-lg font-bold"
                                                            >
                                                                ${totalStocksValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </tspan>
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={(viewBox.cy || 0) + 16}
                                                                className="fill-muted-foreground text-xs"
                                                            >
                                                                Stocks
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
                        )}
                    </TabsContent>

                    <TabsContent value="division">
                        {divisionChartData.length === 0 ? (
                            <div className="flex items-center justify-center p-6 min-h-[120px]">
                                <p className="text-center text-sm text-muted-foreground">No value data available</p>
                            </div>
                        ) : (
                            <ChartContainer
                                config={divisionChartConfig}
                                className="mx-auto aspect-square max-h-[120px]"
                            >
                                <PieChart>
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Pie
                                        data={divisionChartData}
                                        dataKey="visitors"
                                        nameKey="browser"
                                        innerRadius={30}
                                        outerRadius={50}
                                        strokeWidth={3}
                                    >
                                        {divisionChartData.map((entry, index) => (
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
                                                                className="fill-foreground text-lg font-bold"
                                                            >
                                                                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </tspan>
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={(viewBox.cy || 0) + 16}
                                                                className="fill-muted-foreground text-xs"
                                                            >
                                                                Total
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
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default PortfolioGraph;