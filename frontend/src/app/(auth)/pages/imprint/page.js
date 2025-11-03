export default function ImprintPage() {
    return (
        <main className="max-w-2xl mx-auto px-4 py-12 text-gray-900">
            <h1 className="text-2xl font-bold mb-6">Legal Notice / Imprint</h1>

            <section className="space-y-2 mb-8">
                <p><strong>Website Operator:</strong> Louis Karakas</p>
                <p><strong>Address:</strong> Scheffelstraße 2, 73252 Lenningen, Germany</p>
                <p><strong>Contact:</strong></p>
                <ul className="list-disc ml-6">
                    <li>Email: Louiskarakas.bw@gmail.com</li>
                    <li>Phone: +49 178 8048126</li>
                </ul>
            </section>

            <section className="space-y-2 text-sm text-gray-600">
                <h2 className="text-xl font-semibold">Disclaimer</h2>
                <p>
                    This website is operated by the founder in a pre-incorporation phase.
                    A corporate entity ("Captain Inc.") will be registered and updated in this imprint
                    as soon as the incorporation process is completed.
                </p>
            </section>
        </main>
    );
}
