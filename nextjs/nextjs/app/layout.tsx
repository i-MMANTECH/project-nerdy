import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Billing Panel",
  description: "Admin billing panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontSans.variable} dark min-h-dvh antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
