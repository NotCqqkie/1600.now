import { useThemeMode } from "@/lib/theme";
import { Toaster as Sonner, toast as sonnerToast, type ExternalToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;
const APP_ERROR_TOAST_ID = "app-error-toast";

const toast = Object.assign(
  (message: Parameters<typeof sonnerToast>[0], data?: Parameters<typeof sonnerToast>[1]) => sonnerToast(message, data),
  sonnerToast,
  {
    error: (message: Parameters<typeof sonnerToast.error>[0], data?: ExternalToast) =>
      sonnerToast.error(message, { ...data, id: APP_ERROR_TOAST_ID }),
  },
) as typeof sonnerToast;

const Toaster = ({ duration, style, ...props }: ToasterProps) => {
  const isDarkMode = useThemeMode();

  return (
    <Sonner
      {...props}
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group"
      duration={duration}
      expand={false}
      visibleToasts={1}
      style={
        {
          "--sonner-toast-duration": typeof duration === "number" ? `${duration}ms` : "4000ms",
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "sonner-progress-toast relative overflow-hidden group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          content: "min-w-0",
          title: "break-words leading-[1.35]",
          description: "break-words leading-[1.35] group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
};

export { Toaster, toast };
