import { useToast } from "@/hooks/use-toast"
import {
    Toast,
    ToastClose,
    ToastDescription,
    ToastProvider,
    ToastTitle,
    ToastViewport,
} from "@/components/ui/toast"
import { useEffect } from "react"

export function Toaster() {
    const { toasts } = useToast()

    // Add the animation styles to the document head once
    useEffect(() => {
        // Create the style element if it doesn't exist
        if (!document.getElementById('toast-progress-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-progress-animation';
            style.innerHTML = `
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `;
            document.head.appendChild(style);
        }

        // Clean up on unmount
        return () => {
            const style = document.getElementById('toast-progress-animation');
            if (style) {
                style.remove();
            }
        };
    }, []);

    return (
        <ToastProvider>
            {toasts.map(function ({ id, title, description, action, ...props }) {
                return (
                    <Toast key={id} {...props}>
                        {/* Progress bar animation - using the keyframe we defined in useEffect */}
                        <div
                            className="absolute top-0 left-0 h-1 bg-primary"
                            style={{
                                width: "100%",
                                animation: `toastProgress ${(props.duration || 5000) / 1000}s linear forwards`
                            }}
                        />
                        <div className="grid gap-1">
                            {title && <ToastTitle>{title}</ToastTitle>}
                            {description && (
                                <ToastDescription>{description}</ToastDescription>
                            )}
                        </div>
                        {action}
                        <ToastClose />
                    </Toast>
                );
            })}
            <ToastViewport />
        </ToastProvider>
    );
}
