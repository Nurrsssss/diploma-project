import type { Metadata } from "next";
import ClientLayout from "@/components/layout/general/ClientLayout";
import { AuthProvider } from "@/context/AuthContext";
import "@/styles/globals.css";
import { Outfit, IBM_Plex_Sans } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Clintech",
  description: "Clintech — современный медицинский сервис для онлайн-записи к врачу, хранения истории посещений и поиска лучших специалистов.",
  keywords: [
    "медицина", "запись к врачу", "онлайн запись", "история посещений", "специалисты", "клиника", "vitaem", "виталем"
  ],
  icons: {
    icon: '/logo/logo-vit.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${outfit.variable} ${ibmPlexSans.variable} min-h-screen`}>
        <AuthProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AuthProvider>
      </body>
    </html >
  );
}
