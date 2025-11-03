import { Inter, Roboto_Mono, Dancing_Script } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/components/context/AuthProvider";
import { Toaster } from "sonner"

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
        {/*  <Navbar /> */}
        <div className="flex justify-center h-screen">
          <div className="w-full">
            <AuthProvider>
              {children}
            </AuthProvider>
          </div>
        </div>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
