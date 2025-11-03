// components/Typing.jsx
"use client";

import { WordRotate } from "@/components/magicui/word-rotate";

const PROMPTS = [
    "Create a project structure plan.",
    "Break this project into phases and subprojects.",
    "Define initial work packages with rough time estimates.",
    "Detect current blockers and risks.",
    "Give me a high-level project health overview.",
    "Generate a weekly stakeholder update.",
];

export default function RotatingWords({
    title = "Try asking Captain:",
    className = "text-xl font-semibold text-black dark:text-white",
}) {
    return (
        <div className="w-full flex flex-col items-center justify-center gap-2">
            <h1 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {title}
            </h1>
            <WordRotate className={className} words={PROMPTS} />
        </div>
    );
}
