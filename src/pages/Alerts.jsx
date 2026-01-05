import SearchAlerts from "@/feature/alert/SearchAlerts.jsx";
import CreateAlert from "@/feature/alert/CreateAlert.jsx";
import AlertList from "@/feature/alert/AlertList.jsx";
import { AlertProvider, useAlert } from "../context/AlertsContext.jsx";
import { useEffect } from "react";

const AlertsContent = () => {
    const { fetchAlerts } = useAlert();

    useEffect(() => {
        console.log("Initial alerts fetch...");
        fetchAlerts();
    }, []);

    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-center mb-8">Alerts</h1>

                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Left section - Search and Create */}
                        <div className="w-full md:w-1/4">
                            <SearchAlerts />
                            <CreateAlert />
                        </div>

                        {/* Right section - List of alerts */}
                        <div className="w-full md:w-3/4">
                            <AlertList />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const Alerts = () => {
    return (
        <AlertProvider>
            <AlertsContent />
        </AlertProvider>
    );
};

export default Alerts;