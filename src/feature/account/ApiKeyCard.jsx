// src/components/account/ApiKeyCard.jsx
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator.jsx";

const ApiKeyCard = ({ apiKey, onUpdate, onDelete }) => {
    return (
        <Card className="w-full mb-3">
            <CardContent className="flex flex-col p-4">
                <div className="flex justify-between items-start">
                    <span className="font-medium">{apiKey.platformName}</span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="icon" onClick={() => onUpdate(apiKey)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => onDelete(apiKey)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="mt-2 text-sm">
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <span className="font-medium text-xs">API Key:</span>
                        <span>{apiKey.maskedApiKeyValue}</span>
                    </div>

                    {apiKey.maskedSecretKey && (
                        <div className="flex items-center space-x-2 text-muted-foreground mt-1">
                            <span className="font-medium text-xs">Secret Key:</span>
                            <span>{apiKey.maskedSecretKey}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default ApiKeyCard;
