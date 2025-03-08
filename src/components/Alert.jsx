// src/components/ui/alert.jsx
import * as React from "react";

const Alert = ({ children, variant = "default", className = "" }) => {
    const baseClass = "relative w-full rounded-lg border p-4 mb-4";

    const variantClasses = {
        default: "bg-gray-100 border-gray-200 text-gray-800",
        destructive: "bg-red-50 border-red-200 text-red-800",
        success: "bg-green-50 border-green-200 text-green-800"
    };

    return (
        <div className={`${baseClass} ${variantClasses[variant]} ${className}`} role="alert">
            {children}
        </div>
    );
};

const AlertTitle = ({ children, className = "" }) => (
    <h5 className={`text-lg font-medium mb-1 ${className}`}>
        {children}
    </h5>
);

const AlertDescription = ({ children, className = "" }) => (
    <div className={`text-sm ${className}`}>
        {children}
    </div>
);

export { Alert, AlertTitle, AlertDescription };
