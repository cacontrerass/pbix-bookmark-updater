import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Actualización de Bookmarks · Power BI | Data Champions",
  description:
    "Actualiza bookmarks de archivos .pbix sin abrir Power BI Desktop. 100% en tu navegador, cero uploads.",
  openGraph: {
    title: "Actualización de Bookmarks · Power BI",
    description:
      "Actualiza bookmarks de .pbix sin abrir Power BI Desktop. 100% en tu navegador, cero uploads.",
    type: "website",
    siteName: "Data Champions Toolkit",
    // images: ["/brand/og-image.png"]  // TODO: agregar cuando exista
  },
  twitter: {
    card: "summary_large_image",
    title: "Actualización de Bookmarks · Power BI",
    description:
      "Actualiza bookmarks de .pbix sin abrir Power BI Desktop.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
