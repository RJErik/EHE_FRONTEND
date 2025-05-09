// src/components/account/ApiKeyCard.jsx
import { Card, CardContent } from "../ui/card.jsx";
import { Button } from "../ui/button.jsx";
import { Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const ApiKeyCard = ({ apiKey, onUpdate, onDelete }) => {
    return (
        <Card className="w-full mb-3">
            <CardContent className="flex items-center justify-between p-4">
                <div className="flex flex-col md:flex-row md:items-center">
                    <span className="font-medium">{apiKey.platformName}</span>
                    <Separator className="hidden md:block mx-2 h-4 w-px" orientation="vertical" />
                    <span className="text-muted-foreground text-sm">{apiKey.maskedApiKeyValue}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => onUpdate(apiKey)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onDelete(apiKey)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default ApiKeyCard;
