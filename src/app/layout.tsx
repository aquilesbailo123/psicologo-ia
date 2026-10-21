import type { Metadata } from "next";
import { Nunito, Fraunces } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calma · Tu espacio para hablar",
  description: "Un acompañante con IA para tu bienestar emocional.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${nunito.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
