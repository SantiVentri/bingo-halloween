import type { Metadata, Viewport } from "next";
import { Luckiest_Guy, Nunito } from "next/font/google";
import "./globals.css";
import Avisos from "@/components/Avisos";
import RegistrarServiceWorker from "@/components/RegistrarServiceWorker";
import { CELDAS_TABLERO } from "@/lib/tablero";

// Parecidas a las del póster: Luckiest Guy para "BINGO" y los títulos, Nunito (redondeada) para el resto
const luckiest = Luckiest_Guy({
  variable: "--font-luckiest",
  weight: "400",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bingo de Halloween",
  description: `Encontrá a los ${CELDAS_TABLERO} disfrazados… si te animás. Creado por Santino Ventrice y Joaquín Urruty en 2026`,
  appleWebApp: { title: "Bingo", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#5e4c47",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${luckiest.variable} ${nunito.variable}`}>
      <body>
        <Avisos>{children}</Avisos>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
