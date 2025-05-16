// src/pages/Alerts.jsx
import SearchAlerts from "../components/alert/SearchAlerts.jsx";
import CreateAlert from "../components/alert/CreateAlert.jsx";
import AlertsList from "../components/alert/AlertsList.jsx";
import { AlertProvider } from "../context/AlertContext";

const Alerts = ({ navigate }) => {
    return (
        <AlertProvider>
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
                                <AlertsList />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AlertProvider>
    );
};

export default Alerts;
