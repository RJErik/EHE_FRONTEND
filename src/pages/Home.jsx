import HeroSection from "@/feature/home/HeroSection.jsx";
import InfoCard from "@/feature/home/InfoCard.jsx";

const Home = () => {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1">
                <HeroSection />

                <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-4 mb-12">
                    <InfoCard title="Latest trades by Our Customers">
                        {/* Placeholder for trade data */}
                        <div className="h-40"></div>
                    </InfoCard>

                    <InfoCard title="Best performing stocks today">
                        {/* Placeholder for best stocks */}
                        <div className="h-40"></div>
                    </InfoCard>

                    <InfoCard title="Worst performing stocks today">
                        {/* Placeholder for worst stocks */}
                        <div className="h-40"></div>
                    </InfoCard>
                </div>
            </main>
        </div>
    );
};

export default Home;
