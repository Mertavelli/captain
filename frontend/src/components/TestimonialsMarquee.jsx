import { cn } from "@/lib/utils";
import { Marquee } from "@/components/magicui/marquee";
import { Zap, MessageCircle, Bug, FileBarChart2, Bell, Users } from "lucide-react";

// Feature-Daten mit Lucide-Icons als JSX!
const features = [
    {
        icon: <Zap size={32} className="text-purple-600" />,
        name: "Automate Jira Issues",
        username: "Jira",
        body: "Create, update, and track Jira issues without leaving Captain.",
    },
    {
        icon: <MessageCircle size={32} className="text-blue-500" />,
        name: "Sync with Slack",
        username: "Slack",
        body: "Get project updates and send messages directly to your team.",
    },
    {
        icon: <Bug size={32} className="text-pink-600" />,
        name: "Blocker Detection",
        username: "AI",
        body: "AI scans all your project channels for hidden blockers.",
    },
    {
        icon: <FileBarChart2 size={32} className="text-green-600" />,
        name: "One-click Reporting",
        username: "Reporting",
        body: "Export reports and share project health instantly.",
    },
    {
        icon: <Bell size={32} className="text-yellow-500" />,
        name: "Real-time Notifications",
        username: "Notifications",
        body: "Never miss a change in your most important projects.",
    },
    {
        icon: <Users size={32} className="text-fuchsia-500" />,
        name: "Stakeholder Dashboard",
        username: "Dashboard",
        body: "Give external partners controlled project access.",
    },
];

const firstRow = features.slice(0, features.length / 2);
const secondRow = features.slice(features.length / 2);

// Card: icon statt img, sonst wie gehabt!
const FeatureCard = ({ icon, name, username, body }) => (
    <figure
        className={cn(
            "relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4",
            "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
            "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
        )}
    >
        <div className="flex flex-row items-center gap-2">
            <div className="rounded-full flex items-center justify-center bg-gray-100 dark:bg-background w-8 h-8">
                {icon}
            </div>
            <div className="flex flex-col">
                <figcaption className="text-sm font-medium dark:text-white">
                    {name}
                </figcaption>
                <span className="inline-block bg-purple-100 text-purple-600 text-[11px] px-2 py-[2px] rounded font-medium dark:bg-purple-900/60 dark:text-purple-200">
                    {username}
                </span>
            </div>
        </div>
        <blockquote className="mt-2 text-sm">{body}</blockquote>
    </figure>
);

// Marquee bleibt wie gehabt!
export function FeaturesMarquee() {
    return (
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-2">
            <Marquee pauseOnHover className="[--duration:20s]">
                {firstRow.map((feature, i) => (
                    <FeatureCard key={feature.name} {...feature} />
                ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="[--duration:20s]">
                {secondRow.map((feature, i) => (
                    <FeatureCard key={feature.name + "-2"} {...feature} />
                ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background"></div>
        </div>
    );
}
