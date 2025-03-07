import Header from "../components/Header";
import RegisterForm from "../components/RegisterForm";

const Register = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} />
            <main className="flex-1 flex items-start justify-center p-4">
                <RegisterForm navigate={navigate} />
            </main>
        </div>
    );
};

export default Register;
