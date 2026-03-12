import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MUNify — AI Document Generator for MUN Simulations",
  description: "Plataforma diplomática de IA para simulaciones de Naciones Unidas. Genera posiciones, resoluciones y enmiendas en segundos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
