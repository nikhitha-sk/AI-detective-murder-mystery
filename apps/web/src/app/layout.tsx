import type { Metadata } from "next";
import { Inter, Playfair_Display, Special_Elite } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["600", "700", "800"] });
const specialElite = Special_Elite({ subsets: ["latin"], variable: "--font-special-elite", weight: "400" });

export const metadata: Metadata = {
  title: "AI Detective",
  description: "A multiplayer murder mystery where every suspect is an AI with hidden motives and private memories.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${specialElite.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
