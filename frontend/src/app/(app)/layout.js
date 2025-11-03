import { Inter, Roboto_Mono, Dancing_Script } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/components/context/AuthProvider";
import Navbar from "@/components/Navbar";
import ProtectedLayout from "@/components/auth/ProtectedLayout";
import Footer from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-secondary",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-tertiary",
  subsets: ["latin"],
});


export const metadata = {
  title: "Captain – Your AI Project Manager",
  description:
    "Captain is your AI-powered project lead. Executes tasks, detects risks, and supports your team – integrated with Notion, Jira, Slack, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} ${dancingScript.variable} antialiased`}
      >
        <Navbar />
        <div className="flex justify-center bg-[url(/bg.png)] bg-no-repeat bg-cover min-h-screen">
          <div className="p-4 w-full max-w-[90rem]">
            <AuthProvider>
              <ProtectedLayout>{children}</ProtectedLayout>
            </AuthProvider>
          </div>
        </div>
        <Footer />

      </body>
    </html>
  );
}
