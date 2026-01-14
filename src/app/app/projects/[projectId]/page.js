"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Play,
  Settings,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useProject } from "@/hooks/use-projects";
import { useScans, useRunScan } from "@/hooks/use-scans";
import { useProposals } from "@/hooks/use-proposals";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function ProjectOverviewPage({ params }) {
  const resolvedParams = use(params);
  const { projectId } = resolvedParams;
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const scansQuery = useScans(projectId);
  const { data: scansData } = scansQuery;
  const { data: proposalsData } = useProposals(projectId, { status: "pending" });
  const runScan = useRunScan(projectId);
  const { toast } = useToast();
  const [optimisticScanMessage, setOptimisticScanMessage] = useState(null);

  const recentScans = scansData?.scans?.slice(0, 5) || [];
  const pendingProposals = proposalsData?.proposals || [];

  const activeScan = useMemo(() => {
    const scans = scansData?.scans || [];
    return (
      scans.find((s) => s.status === "running" || s.status === "pending") ||
      null
    );
  }, [scansData]);

  const scanStatusText = useMemo(() => {
    const msg = activeScan?.progress?.message;
    if (msg) return msg;
    if (optimisticScanMessage) return optimisticScanMessage;
    if (activeScan?.progress?.phase) {
      const phase = String(activeScan.progress.phase);
      if (phase === "tree") return "Listing repository files...";
      if (phase === "read_files") return "Scanning files...";
      if (phase === "ai_digest") return "Summarizing repository...";
      if (phase === "generate_docs") return "Building documentation...";
      if (phase === "proposal") return "Preparing documentation proposal...";
      if (phase === "db") return "Saving proposal...";
      if (phase === "done") return "Completed";
      if (phase === "failed") return "Scan failed";
    }
    return null;
  }, [activeScan, optimisticScanMessage]);

  // While the scan request is in-flight, aggressively poll scan progress so the UI updates.
  useEffect(() => {
    if (!runScan.isPending) return;
    setOptimisticScanMessage((prev) => prev || "Starting scan...");

    // Kick an immediate refresh, then poll quickly for progress updates.
    scansQuery.refetch?.();
    const interval = setInterval(() => {
      scansQuery.refetch?.();
    }, 1200);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runScan.isPending, projectId]);

  // Clear optimistic text when scan finishes.
  useEffect(() => {
    if (!runScan.isPending && !activeScan) {
      setOptimisticScanMessage(null);
    }
  }, [runScan.isPending, activeScan]);

  const handleRunScan = async () => {
    try {
      setOptimisticScanMessage("Starting scan...");
      await runScan.mutateAsync();
      toast({
        title: "Scan complete",
        description: "Docs proposals were generated from your selected Documents.",
        action: (
          <ToastAction asChild altText="View proposals">
            <Link href={`/app/projects/${projectId}/proposals`}>View proposals</Link>
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

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span className="font-mono text-sm">
              {project.repoOwner}/{project.repoName}
            </span>
            <a
              href={`https://github.com/${project.repoOwner}/${project.repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/app/projects/${projectId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button onClick={handleRunScan} disabled={runScan.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {runScan.isPending ? "Starting..." : "Run Scan"}
          </Button>
        </div>
      </div>

      {(runScan.isPending || activeScan) && scanStatusText ? (
        <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/40 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <div className="text-sm font-medium">{scanStatusText}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {activeScan?.progress?.percent ?? 0}%
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {activeScan?.progress?.phase ? String(activeScan.progress.phase).replaceAll("_", " ") : "running"}
          </Badge>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Drift Status</CardTitle>
            {project.driftOpenCount > 0 ? (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.driftOpenCount}</div>
            <p className="text-xs text-muted-foreground">
              {project.driftOpenCount === 0 ? "All documentation is up to date" : "Open drift items"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Proposals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.proposalsPendingCount}</div>
            <p className="text-xs text-muted-foreground">
              <Link
                href={`/app/projects/${projectId}/proposals`}
                className="text-primary hover:underline"
              >
                Review proposals →
              </Link>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {project.lastScanAt ? formatRelativeTime(project.lastScanAt) : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              Next: {project.nextScanAt ? formatDate(project.nextScanAt) : "Not scheduled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Scans */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Scans</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/app/projects/${projectId}/scans`}>View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentScans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scans yet</p>
            ) : (
              <div className="space-y-4">
                {recentScans.map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/app/projects/${projectId}/scans/${scan.id}`}
                    className="flex items-center justify-between rounded-md p-2 -m-2 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          scan.status === "succeeded"
                            ? "bg-green-500"
                            : scan.status === "failed"
                            ? "bg-red-500"
                            : scan.status === "running"
                            ? "bg-blue-500 animate-pulse"
                            : "bg-yellow-500"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {scan.source === "manual" ? "Manual scan" : "Scheduled scan"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(scan.startedAt || scan.createdAt)}
                        </p>
                        {scan.errorMessage && (
                          <p className="mt-1 text-xs text-destructive line-clamp-2">
                            {scan.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        scan.status === "succeeded"
                          ? "success"
                          : scan.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {scan.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Proposals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Proposals</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/app/projects/${projectId}/proposals`}>View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending proposals</p>
            ) : (
              <div className="space-y-4">
                {pendingProposals.slice(0, 5).map((proposal) => (
                  <Link
                    key={proposal.id}
                    href={`/app/projects/${projectId}/proposals/${proposal.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <p className="text-sm font-medium line-clamp-1">{proposal.summary}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{proposal.files?.length || 0} files</span>
                      <span>•</span>
                      <span>{formatRelativeTime(proposal.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
