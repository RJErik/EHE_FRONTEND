import { Card, CardHeader, CardContent } from "../ui/card.jsx";

const InfoCard = ({ title, children }) => {
    return (
        <Card className="h-full bg-gray-200">
            <CardHeader className="text-center pb-2">
                <h3 className="text-gray-600">{title}</h3>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
};

export default InfoCard;
