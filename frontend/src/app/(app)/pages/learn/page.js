export default function LearnPage() {
    const useCases = [
        {
            title: "Analyze your files",
            description:
                "Upload your project docs, meeting notes, schedules or financials – Captain understands and extracts the relevant data for your workflow.",
        },
        {
            title: "Automated status updates",
            description:
                "Captain keeps your team and stakeholders always up to date. No more manual status mails or forgotten follow-ups.",
        },
        {
            title: "Integrations",
            description:
                "Connect Jira, Slack, Notion, Drive and more. Captain brings all your tools and data into one clear workflow.",
        },
        {
            title: "AI Project Lead",
            description:
                "Captain detects risks, automates reporting and communicates with your team – like a real project manager, 24/7.",
        },
        {
            title: "One-click workflows",
            description:
                "Automate repetitive project management tasks with a single click: progress tracking, reporting, follow-ups, and more.",
        },
        {
            title: "Smart reminders",
            description:
                "Captain reminds your team about upcoming deadlines and tasks, so nothing slips through.",
        },
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8 text-center">
                What can Captain do?
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {useCases.map((uc, idx) => (
                    <div
                        key={idx}
                        className="rounded-xl border bg-white shadow-sm p-6 flex flex-col gap-2"
                    >
                        <h2 className="text-lg font-semibold text-accent">{uc.title}</h2>
                        <p className="text-gray-600 text-sm">{uc.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
