import type { Metadata, Viewport } from "next";
import { Anton, Nunito_Sans, Rubik_Wet_Paint } from "next/font/google";
import "./globals.css";
import Avisos from "@/components/Avisos";
import RegistrarServiceWorker from "@/components/RegistrarServiceWorker";
import { CELDAS_TABLERO } from "@/lib/tablero";

// Rubik Wet Paint solo para "BINGO", Anton para títulos y botones, Nunito Sans para el resto
const rubikWetPaint = Rubik_Wet_Paint({
  variable: "--font-rubik-wet-paint",
  weight: "400",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bingo de Halloween",
  description: `Encontrá a los ${CELDAS_TABLERO} disfrazados… si te animás. Creado por Santino Ventrice y Joaquín Urruty en 2026`,
  appleWebApp: { title: "Bingo", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e0b0b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${rubikWetPaint.variable} ${anton.variable} ${nunitoSans.variable}`}>
      <body>
        <Avisos>{children}</Avisos>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
