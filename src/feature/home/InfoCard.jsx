import { Card, CardHeader, CardContent } from "../../components/ui/card.jsx";

const InfoCard = ({ title, children }) => {
    return (
        <Card className="h-full">
            <CardHeader className="text-center pb-2">
                <h3>{title}</h3>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    );
};

export default InfoCard;
