import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

const ApiKeyManager = () => {
    // Placeholder for API keys - this would be populated with real data in a production app
    const apiKeys = [];

    return (
        <div className="flex flex-col h-full">
            <Card className="bg-gray-200 flex-1 mb-4">
                <CardHeader className="text-center text-gray-500">
                    <h3>List of current API keys</h3>
                </CardHeader>
                <CardContent>
                    {apiKeys.length > 0 ? (
                        <ul>
                            {apiKeys.map((key, index) => (
                                <li key={index}>{key}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            {/* Empty state - no API keys */}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex space-x-4 mb-4">
                <Button variant="outline" className="flex-1">
                    Delete
                </Button>
                <Button className="flex-1 bg-gray-500 hover:bg-gray-600">
                    Add
                </Button>
            </div>

            <Button className="bg-gray-500 hover:bg-gray-600">
                Deactivate
            </Button>
        </div>
    );
};

export default ApiKeyManager;
