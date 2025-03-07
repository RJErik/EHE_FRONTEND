import Header from "../components/Header";
import LoginForm from "../components/LoginForm";

const Login = ({ navigate }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <Header navigate={navigate} />
            <main className="flex-1 flex items-start justify-center p-4">
                <LoginForm navigate={navigate} />
            </main>
        </div>
    );
};

export default Login;
