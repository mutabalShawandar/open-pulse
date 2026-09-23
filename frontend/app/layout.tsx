import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Praxisumfrage",
  description: "Umfrage Verwaltungs App",
  icons: {
    icon: [{ url: "/cropped-Reintjes_favicon-32x32.webp", type: "image/webp", sizes: "32x32" }],
    shortcut: "/cropped-Reintjes_favicon-32x32.webp",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
