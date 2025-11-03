'use client'
import useAuth from "@/hooks/useAuth";
import Hero from "@/components/Hero";
import ProjectsGrid from "@/components/ProjectsGrid";
import { useRouter } from "next/navigation";
import Auth from "@/components/auth/Auth";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/pages/dashboard")
    }
  }, [user, loading])

  return (
    <div className="flex flex-col gap-2">
      {loading ? <h1>Loading...</h1> : <Auth />}
    </div>
  );
}
