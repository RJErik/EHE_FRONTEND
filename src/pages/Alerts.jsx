import Header from "../components/Header";
import SearchAlerts from "../components/SearchAlerts";
import CreateAlert from "../components/CreateAlert";
import AlertsList from "../components/AlertsList";

const Alerts = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} currentPage="alerts" />

            <main className="flex-1 p-4">
                <h1 className="text-4xl font-semibold text-gray-600 text-center mb-8">Alerts</h1>

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
    );
};

export default Alerts;
