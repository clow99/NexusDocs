"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Scan,
  FileText,
  History,
  Settings,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "@/hooks/use-projects";

const navigation = [
  { name: "Projects", href: "/app/projects", icon: FolderGit2 },
  { name: "Audit Log", href: "/app/audit", icon: History },
];

const getProjectNavigation = (projectId) => [
  { name: "Overview", href: `/app/projects/${projectId}`, icon: LayoutDashboard },
  { name: "Scans", href: `/app/projects/${projectId}/scans`, icon: Scan },
  { name: "Proposals", href: `/app/projects/${projectId}/proposals`, icon: FileText },
  { name: "Settings", href: `/app/projects/${projectId}/settings`, icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects || [];

  // Extract current project ID from path
  const projectMatch = pathname.match(/\/app\/projects\/([^\/]+)/);
  const currentProjectId = projectMatch ? projectMatch[1] : null;
  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-24 items-center border-b px-6">
        <Link
          href="/app/projects"
          className="relative h-16 w-full rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Go to projects"
        >
          <Image
            src="/nexusdocs_logo.png"
            alt="NexusDocs"
            fill
            className="object-contain object-left"
            sizes="256px"
            priority
          />
        </Link>
      </div>

      {/* Project Switcher */}
      {projects.length > 0 && (
        <div className="border-b p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                role="combobox"
              >
                <span className="truncate">
                  {currentProject?.name || "Select project"}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {projects.map((project) => (
                <DropdownMenuItem key={project.id} asChild>
                  <Link href={`/app/projects/${project.id}`}>
                    <FolderGit2 className="mr-2 h-4 w-4" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 scrollbar-thin">
        {/* Project-specific navigation */}
        {currentProjectId && (
          <div className="mb-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project
            </p>
            {getProjectNavigation(currentProjectId).map((item) => {
              const isActive =
                item.href === `/app/projects/${currentProjectId}`
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Main navigation */}
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Main
          </p>
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          © 2026 NexusDocs
        </p>
      </div>
    </aside>
  );
}
