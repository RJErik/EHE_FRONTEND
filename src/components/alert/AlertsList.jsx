import { Card, CardContent } from "../ui/card.jsx";

const AlertsList = () => {
    // Placeholder for alerts list
    const alerts = [];

    return (
        <Card className="w-full h-full">
            <CardContent className="flex items-center justify-center h-full min-h-[600px]">
                <p className="text-xl text-muted-foreground">List of current alerts</p>
            </CardContent>
        </Card>
    );
};

export default AlertsList;
