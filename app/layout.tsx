import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import "./globals.css";
import SkipLinks from "@/app/components/SkipLinks";
import { WebVitals } from "@/app/components/WebVitals";
import { ToastProvider } from "@/app/components/ui/Toast";

const barlow = Barlow({
  weight: ['400', '500', '600', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Invoice Processing Dashboard",
  description: "Centralized workspace for intelligent invoice processing and workflow management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${barlow.className} antialiased`}>
        <WebVitals />
        <SkipLinks />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}