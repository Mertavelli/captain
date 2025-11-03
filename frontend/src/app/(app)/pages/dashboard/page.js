'use client'
import useAuth from "@/hooks/useAuth";
import Hero from "@/components/Hero";
import ProjectsGrid from "@/components/ProjectsGrid";
import { useRouter } from "next/router";

export default function Dashboard() {

    return (
        <div className="flex flex-col gap-2">
            <div className="mt-80 mb-40">
                <Hero />
            </div>
            <ProjectsGrid />

        </div>
    );
}
