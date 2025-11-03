export default function PricingPage() {
    const plans = [
        {
            name: "Starter",
            price: "Free",
            description: "Perfect for small teams or your first project.",
            features: [
                "Up to 3 active projects",
                "File analysis",
                "Status updates",
                "1 integration (e.g. Slack or Jira)",
                "Basic support",
            ],
            cta: "Get started",
            highlighted: false,
        },
        {
            name: "Pro",
            price: "€29",
            period: "/month",
            description: "Advanced tools for growing teams and real projects.",
            features: [
                "Unlimited projects",
                "All file types & AI summaries",
                "All integrations (Jira, Slack, Notion, ...)",
                "Automated reporting",
                "Priority support",
            ],
            cta: "Start Pro",
            highlighted: true,
        },
        {
            name: "Enterprise",
            price: "Custom",
            description: "Tailored for large organizations.",
            features: [
                "Enterprise onboarding",
                "Custom integrations",
                "Dedicated success manager",
                "SLAs & security reviews",
                "Personalized setup",
            ],
            cta: "Contact sales",
            highlighted: false,
        },
    ];

    return (
        <div className="py-16 px-4">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-4xl font-bold text-center mb-4 tracking-tight">
                    Simple pricing for every team
                </h1>
                <p className="text-lg text-gray-500 text-center mb-12">
                    Try Captain for free. Upgrade anytime. Cancel anytime.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, i) => (
                        <div
                            key={i}
                            className={`rounded-3xl border border-gray-200 bg-white p-8 shadow-sm flex flex-col 
                                ${plan.highlighted ? "scale-105 border-accent shadow-lg z-10" : ""}
                                transition-all duration-200`}
                        >
                            <div className="mb-4 flex flex-col gap-1">
                                <h2 className={`text-2xl font-semibold mb-1 ${plan.highlighted ? "text-accent" : "text-gray-900"}`}>
                                    {plan.name}
                                </h2>
                                <span className="text-4xl font-bold">
                                    {plan.price}
                                    <span className="text-base font-normal text-gray-500">
                                        {plan.period || ""}
                                    </span>
                                </span>
                                <p className="text-gray-500 text-sm mt-2">{plan.description}</p>
                            </div>
                            <ul className="flex-1 my-6 space-y-3">
                                {plan.features.map((f, j) => (
                                    <li key={j} className="flex items-center gap-2 text-gray-700">
                                        <span className="w-2 h-2 rounded-full bg-accent/80 block"></span>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                className={`w-full mt-4 py-2 px-4 rounded-xl font-semibold text-white 
                                    ${plan.highlighted ? "bg-accent hover:bg-accent/90" : "bg-gray-900 hover:bg-gray-800"}
                                    transition`}
                            >
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
