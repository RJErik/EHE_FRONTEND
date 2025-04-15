import { Card, CardContent, CardHeader } from "../ui/card.jsx";
import { Slider } from "../ui/slider.jsx";
import { Input } from "../ui/input.jsx";
import { Button } from "../ui/button.jsx";
import { useState } from "react";

const TradePanel = () => {
    const [quantity, setQuantity] = useState(50);
    const [price, setPrice] = useState(50);

    return (
        <Card className="w-full">
            <CardHeader className="text-center pb-2">
                <h3 className="text-muted-foreground text-lg">Buy / Sale</h3>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground mb-1">How many</p>
                    <Slider
                        value={[quantity]}
                        onValueChange={(values) => setQuantity(values[0])}
                        max={100}
                        step={1}
                        className="mb-2"
                    />
                    <Input
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                        placeholder="Amount"
                        className="mt-2"
                    />
                </div>

                <div>
                    <p className="text-sm text-muted-foreground mb-1">For how much</p>
                    <Slider
                        value={[price]}
                        onValueChange={(values) => setPrice(values[0])}
                        max={100}
                        step={1}
                        className="mb-2"
                    />
                    <Input
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value) || 0)}
                        placeholder="Amount"
                        className="mt-2"
                    />
                </div>

                <div className="flex gap-4 pt-2">
                    <Button variant="destructive" className="flex-1">
                        Sell
                    </Button>
                    <Button variant="default" className="flex-1">
                        Buy
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default TradePanel;
