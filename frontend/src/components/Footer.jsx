import Link from "next/link";

export default function Footer() {
    return (
        <footer className="bg-white flex justify-center py-2 px-6">
            <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4 max-w-[90rem]">
                <Link href={"/pages/dashboard"}>
                    <div className="flex items-center gap-2">
                        <img src="/logo-dark.png" className="h-10 w-auto" alt="Logo" />
                    </div>
                </Link>

                <nav className="flex gap-6 text-xs">
                    <Link href="/pages/imprint">Imprint</Link>
                    <Link href="/pages/privacy">Privacy Policy</Link>
                    <Link href="/pages/tos">Terms of Service</Link>
                    <Link href="/pages/dpa">DPA</Link>
                </nav>
            </div>
        </footer>
    );
}
