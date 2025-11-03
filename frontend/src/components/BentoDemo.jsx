import { CalendarIcon, FileTextIcon } from "@radix-ui/react-icons";
import { BellIcon, Share2Icon, FileChartPie, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedBeamMultipleOutputDemo } from "./AnimatedBeamMultipleOutputDemo";
import { AnimatedListDemo } from "./AnimatedListDemo";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import { Marquee } from "@/components/magicui/marquee";

const files = [
    {
        name: "ProjectPlan.xlsx",
        body: "Your master project schedule: timelines, milestones, task owners, and dependencies—all in one place. Captain understands every detail.",
    },
    {
        name: "BudgetTracking.xlsx",
        body: "Live budget tracking, including planned vs. actual spend, cost categories, and procurement status. Captain alerts you to overruns.",
    },
    {
        name: "RiskRegister.xlsx",
        body: "A detailed log of project risks, owners, mitigation strategies, and current status. Captain monitors and flags any critical updates automatically.",
    },
    {
        name: "MeetingNotes.docx",
        body: "Weekly meeting summaries, key decisions, new action items, and unresolved issues. Captain extracts follow-ups and updates the project plan.",
    },
    {
        name: "ChangeRequests.xlsx",
        body: "Log of all project change requests, approvals, impacts, and implementation progress. Captain tracks and reminds you of every open change.",
    },
];

const features = [
    {
        Icon: FileTextIcon,
        name: "Analyze your files",
        description: "Captain extracts key data from PDFs, docs & and more.",
        href: "/pages/learn",
        cta: "Learn more",
        className: "col-span-3 lg:col-span-1",
        background: (
            <Marquee
                pauseOnHover
                className="absolute top-10 [--duration:20s] [mask-image:linear-gradient(to_top,transparent_40%,#000_100%)] "
            >
                {files.map((f, idx) => (
                    <figure
                        key={idx}
                        className={cn(
                            "relative w-45 cursor-pointer overflow-hidden rounded-xl border p-4",
                            "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
                            "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
                            "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none",
                        )}
                    >
                        <div className="flex flex-row items-center gap-2">
                            <div className="flex flex-col">
                                <figcaption className="text-sm font-medium dark:text-white ">
                                    {f.name}
                                </figcaption>
                            </div>
                        </div>
                        <blockquote className="mt-2 text-xs">{f.body}</blockquote>
                    </figure>
                ))}
            </Marquee>
        ),
    },
    {
        Icon: FileChartPie,
        name: "Automated status updates",
        description: "No more manual follow-ups. Captain keeps your team and stakeholders in the loop.",
        href: "/pages/learn",
        cta: "Learn more",
        className: "col-span-3 lg:col-span-2",
        background: (
            <AnimatedListDemo className="absolute right-2 top-4 h-[300px] w-full scale-75 border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-90" />
        ),
    },
    {
        Icon: Share2Icon,
        name: "Integrations",
        description: "Jira, Slack, Notion, Drive, … Captain links your entire tool stack.",
        href: "/pages/learn",
        cta: "Learn more",
        className: "col-span-3 lg:col-span-2",
        background: (
            <AnimatedBeamMultipleOutputDemo className="absolute right-2 top-4 h-[300px] border-none transition-all duration-300 ease-out [mask-image:linear-gradient(to_top,transparent_10%,#000_100%)] group-hover:scale-105" />
        ),
    },
    {
        Icon: UserRound,
        name: "Your AI Project Lead",
        description: "Captain steers your project, detects risks, automates reporting and communicates with your team",
        className: "col-span-3 lg:col-span-1",
        href: "/pages/learn",
        cta: "Learn more",
        background: (
            <div className="flex justify-center items-center relative">
                <img src={"/emblem-dark.svg"} className="w-30 absolute top-10" />
            </div>

        ),
    },
];

export function BentoDemo() {
    return (
        <BentoGrid>
            {features.map((feature, idx) => (
                <BentoCard key={idx} {...feature} />
            ))}
        </BentoGrid>
    );
}
