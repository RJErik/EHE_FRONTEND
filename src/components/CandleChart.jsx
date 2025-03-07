import { Card, CardContent } from "./ui/card";

const CandleChart = () => {
    return (
        <Card className="bg-gray-200 w-full h-80">
            <CardContent className="flex items-center justify-center h-full">
                <p className="text-xl text-gray-500">Candle chart</p>
            </CardContent>
        </Card>
    );
};

export default CandleChart;
