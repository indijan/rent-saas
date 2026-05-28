import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";
import RouteTransitionOverlay from "@/components/RouteTransitionOverlay";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rentapp",
  description: "Rentapp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hu">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} antialiased`}
      >
        {children}
        <Suspense fallback={null}>
          <RouteTransitionOverlay />
        </Suspense>
      </body>
    </html>
  );
}
