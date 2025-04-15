import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
      <ToastProvider>
        {toasts.map(function ({ id, title, description, action, ...props }) {
          return (
              <Toast key={id} {...props}>
                {/* Progress bar animation */}
                <div
                    className="absolute top-0 left-0 h-1 bg-primary"
                    style={{
                      width: "100%",
                      animation: `progress ${(props.duration || 5000) / 1000}s linear forwards`
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

        {/* Define the progress animation */}
        <style jsx global>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      </ToastProvider>
  );
}
