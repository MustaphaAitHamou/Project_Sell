"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children, nonce, dir }: { children: React.ReactNode; nonce?: string; dir: "ltr" | "rtl" }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
      <Toaster position="top-center" dir={dir} richColors closeButton toastOptions={{ duration: 4000 }} />
    </ThemeProvider>
  );
}
