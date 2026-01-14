"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, XCircle, GitCommit, GitPullRequest, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useScan } from "@/hooks/use-scans";
import { formatDate } from "@/lib/utils";

function ProgressBar({ value }) {
  const pct = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-blue-500 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function ScanDetailPage({ params }) {
  const resolvedParams = use(params);
  const { projectId, scanId } = resolvedParams;
  const { data: scan, isLoading } = useScan(projectId, scanId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center">
        <p>Scan not found</p>
      </div>
    );
  }

  const analyzedCount = scan.filesScanned ?? scan.commits?.length ?? 0;
  const progressPercent = scan.progress?.percent ?? 0;
  const progressMessage = scan.progress?.message ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/app/projects/${projectId}/scans`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {scan.source === "manual" ? "Manual Scan" : "Scheduled Scan"}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(scan.startedAt)}
          </p>
        </div>
        <Badge
          variant={
            scan.status === "succeeded"
              ? "success"
              : scan.status === "failed"
              ? "destructive"
              : "secondary"
          }
          className="ml-auto"
        >
          {scan.status}
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {scan.finishedAt
                ? `${Math.round((new Date(scan.finishedAt) - new Date(scan.startedAt)) / 1000)}s`
                : "In progress"}
            </p>
            {scan.status === "running" && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progressMessage || "Working…"}</span>
                  <span>{progressPercent}%</span>
                </div>
                <ProgressBar value={progressPercent} />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Files Scanned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analyzedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Drift Items Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{scan.driftItemsCreated}</p>
          </CardContent>
        </Card>
      </div>

      {/* Generated Proposal */}
      {scan.proposalId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generated Proposal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              This scan generated a documentation proposal you can review and publish.
            </div>
            <Button asChild>
              <Link href={`/app/projects/${projectId}/proposals/${scan.proposalId}`}>
                View proposal
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Commits */}
      {scan.commits?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              Commits Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scan.commits.map((commit) => (
              <div key={commit.sha} className="rounded-lg border p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{commit.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {commit.authorName} • {formatDate(commit.timestamp)}
                    </p>
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {commit.sha.substring(0, 7)}
                  </code>
                </div>
                {commit.changedFiles?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {commit.changedFiles.slice(0, 5).map((file) => (
                      <Badge key={file} variant="secondary" className="text-xs">
                        {file.split("/").pop()}
                      </Badge>
                    ))}
                    {commit.changedFiles.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{commit.changedFiles.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pull Requests */}
      {scan.pullRequests?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" />
              Pull Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scan.pullRequests.map((pr) => (
              <div key={pr.number} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">#{pr.number} {pr.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pr.authorName} • {pr.state}
                    </p>
                  </div>
                  <Badge variant={pr.state === "merged" ? "success" : "secondary"}>
                    {pr.state}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {scan.errorMessage && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{scan.errorMessage}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
