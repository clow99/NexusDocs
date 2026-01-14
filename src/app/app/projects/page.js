"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Play, Settings, FileText, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { useRunScan } from "@/hooks/use-scans";
import { formatRelativeTime, getStatusVariant } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastScanAt");
  const { toast } = useToast();
  const router = useRouter();

  const projects = data?.projects || [];

  const filteredProjects = projects
    .filter((project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      `${project.repoOwner}/${project.repoName}`.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "lastScanAt") {
        return new Date(b.lastScanAt || 0) - new Date(a.lastScanAt || 0);
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Failed to load projects</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your documentation projects
          </p>
        </div>
        <Button asChild>
          <Link href="/app/onboarding">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="lastScanAt">Last Scanned</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No projects found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search
                ? "Try adjusting your search terms"
                : "Get started by connecting a GitHub repository"}
            </p>
            {!search && (
              <Button asChild className="mt-4">
                <Link href="/app/onboarding">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }) {
  const runScan = useRunScan(project.id);
  const { toast } = useToast();
  const router = useRouter();

  const handleRunScan = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await runScan.mutateAsync();
      toast({
        title: "Scan complete",
        description: `Generated doc proposals for ${project.name}.`,
        action: (
          <ToastAction asChild altText="View proposals">
            <Link href={`/app/projects/${project.id}/proposals`}>View proposals</Link>
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to start scan",
        description: err.message,
      });
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <Link href={`/app/projects/${project.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {project.repoOwner}/{project.repoName}
              </CardDescription>
            </div>
            <Badge variant={project.enabled ? "success" : "secondary"}>
              {project.enabled ? "Active" : "Paused"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Drift Items</p>
              <p className="font-medium flex items-center gap-1">
                {project.driftOpenCount > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    {project.driftOpenCount} open
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    All clear
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Proposals</p>
              <p className="font-medium">
                {project.proposalsPendingCount} pending
              </p>
            </div>
          </div>

          {/* Timing */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last scan: {project.lastScanAt ? formatRelativeTime(project.lastScanAt) : "Never"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleRunScan}
              disabled={runScan.isPending}
            >
              <Play className="mr-1 h-3 w-3" />
              {runScan.isPending ? "Starting..." : "Scan Now"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/app/projects/${project.id}/settings`);
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
