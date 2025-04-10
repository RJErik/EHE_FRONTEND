// src/pages/Login.jsx
import Header from "../components/Header";
import LoginForm from "../components/login/LoginForm.jsx";
import { useAuth } from "../context/AuthContext";
import { useEffect } from "react";

const Login = ({ navigate }) => {
    const { user } = useAuth();

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate("stockMarket");
        }
    }, [user, navigate]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Header navigate={navigate} currentPage="login" />
            <main className="flex-1 flex items-center justify-center p-4">
                <LoginForm navigate={navigate} />
            </main>
        </div>
    );
};

export default Login;
