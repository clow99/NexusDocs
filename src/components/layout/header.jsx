"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, User, Search, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

export function Header() {
  const { data: userData } = useUser();
  const user = userData?.user;
  // No real notifications feed is wired yet; don't show an unread dot by default.
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const router = useRouter();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.projects || [];

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return projects
      .filter((p) => {
        const haystack = [
          p.name,
          `${p.repoOwner}/${p.repoName}`,
          p.repoOwner,
          p.repoName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [projects, query]);

  const showDropdown = searchOpen && (query.trim().length > 0 || projectsLoading);

  useEffect(() => {
    function onDocumentMouseDown(e) {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  function navigateToProject(project) {
    if (!project?.id) return;
    setSearchOpen(false);
    setActiveIndex(-1);
    router.push(`/app/projects/${project.id}`);
  }

  return (
    <header className="flex h-24 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div ref={searchRef} className="relative w-80 md:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="h-12 pl-9 text-base"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                setActiveIndex(-1);
                e.currentTarget.blur();
                return;
              }

              if (!showDropdown) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                const max = Math.max(results.length - 1, 0);
                setActiveIndex((idx) => Math.min(idx + 1, max));
                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((idx) => Math.max(idx - 1, 0));
                return;
              }

              if (e.key === "Enter") {
                if (activeIndex >= 0 && results[activeIndex]) {
                  e.preventDefault();
                  navigateToProject(results[activeIndex]);
                } else if (results.length === 1) {
                  e.preventDefault();
                  navigateToProject(results[0]);
                }
              }
            }}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="header-project-search-results"
          />

          {showDropdown ? (
            <div
              id="header-project-search-results"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
            >
              <div className="max-h-80 overflow-y-auto p-1">
                {projectsLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Loading projects…
                  </div>
                ) : results.length > 0 ? (
                  results.map((project, idx) => (
                    <button
                      key={project.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        // Prevent input blur before click runs (keeps dropdown stable).
                        e.preventDefault();
                      }}
                      onClick={() => navigateToProject(project)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                        idx === activeIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="truncate font-medium">{project.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {project.repoOwner}/{project.repoName}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No matching projects.
                  </div>
                )}
              </div>

              {!projectsLoading ? (
                <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Tip: use ↑/↓ then Enter
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) setHasUnreadNotifications(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" />
              {hasUnreadNotifications ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="flex flex-col items-start gap-1 py-2">
              <span className="text-sm font-medium">You’re all caught up</span>
              <span className="text-xs text-muted-foreground">
                No notifications yet.
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/audit">View audit log</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback>
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline-block">{user?.name || "User"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/account">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/account/integrations">
                <Link2 className="mr-2 h-4 w-4" />
                Integrations
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
