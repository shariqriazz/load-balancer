"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <Sidebar />

        <main className="flex-1 p-6 overflow-y-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>

        <Toaster />
      </div>
    </ErrorBoundary>
  );
}
