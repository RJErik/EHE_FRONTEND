import HeroSection from "@/feature/home/HeroSection.jsx";
import InfoCard from "@/feature/home/InfoCard.jsx";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { useHomeInfoChart } from "@/hooks/useHomeInfoChart";
import { useState, useEffect } from "react";
import {ChartContainer, ChartTooltip, ChartTooltipContent} from "@/components/ui/chart.jsx";

const Home = () => {
    const { fetchBestStocks, fetchWorstStocks, fetchLatestTransactions, isLoading } = useHomeInfoChart();
    const [bestStocks, setBestStocks] = useState([]);
    const [worstStocks, setWorstStocks] = useState([]);
    const [latestTransactions, setLatestTransactions] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            const [best, worst, transactions] = await Promise.all([
                fetchBestStocks(),
                fetchWorstStocks(),
                fetchLatestTransactions(),
            ]);

            if (best) setBestStocks(best);
            if (worst) setWorstStocks(worst);
            if (transactions) setLatestTransactions(transactions);
        };

        loadData();
    }, [fetchBestStocks, fetchWorstStocks, fetchLatestTransactions]);

    // Transform data for charts with sorting
    const bestStockChartData = bestStocks
        .map((stock) => ({
            stock: stock.symbol,
            platform: stock.platform,
            change: parseFloat(stock.changePercentage),
        }))
        .sort((a, b) => b.change - a.change); // Sort descending for best stocks

    const worstStockChartData = worstStocks
        .map((stock) => ({
            stock: stock.symbol,
            platform: stock.platform,
            change: Math.abs(parseFloat(stock.changePercentage)),
        }))
        .sort((a, b) => a.change - b.change); // Sort ascending by absolute value for worst stocks

    const chartConfig = {
        change: {
            label: "Change %",
            color: "var(--chart-home-fixed)",
        },
    };

    if (isLoading && bestStocks.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1">
                <HeroSection />

                <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-4 mb-12">
                    {/* Latest Transactions */}
                    <InfoCard title="Latest trades by Our Customers">
                        <div className="space-y-2">
                            {latestTransactions.map((transaction, index) => (
                                <div
                                    key={index}
                                    className="rounded-lg p-3 border "
                                >
                                    <h3 className=" font-medium text-sm mb-1">
                                        {transaction.pseudonym}
                                    </h3>
                                    <p className=" text-xs mb-2">
                                        {transaction.platform} - {transaction.symbol}
                                    </p>
                                    <div className="flex justify-between items-center text-xs">
                                        <div>
                                            <span>Type: </span>
                                            <span
                                                className={transaction.type === "Buy" ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                        {transaction.type}
                    </span>
                                        </div>
                                        <div>
                                            <span >Amount: </span>
                                            <span className="font-medium">
                        {parseFloat(transaction.amount).toFixed(4)}
                    </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </InfoCard>

                    {/* Best Performing Stocks */}
                    <InfoCard title="Best performing stocks today">
                        <ChartContainer config={chartConfig}>
                            <BarChart
                                accessibilityLayer
                                data={bestStockChartData}
                                layout="vertical"
                            >
                                <XAxis type="number" dataKey="change" hide/>
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
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar
                                    dataKey="change"
                                    fill="var(--color-change)"
                                    radius={5}
                                />
                            </BarChart>
                        </ChartContainer>
                    </InfoCard>

                    {/* Worst Performing Stocks */}
                    <InfoCard title="Worst performing stocks today">
                        <ChartContainer config={chartConfig}>
                            <BarChart
                                accessibilityLayer
                                data={worstStockChartData}
                                layout="vertical"
                            >
                                <XAxis type="number" dataKey="change" hide />
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
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar
                                    dataKey="change"
                                    fill="var(--color-change)"
                                    radius={5}
                                />
                            </BarChart>
                        </ChartContainer>
                    </InfoCard>
                </div>
            </main>
        </div>
    );
};

export default Home;
