"use client";

import { use } from "react";
import Link from "next/link";
import { Clock, AlertCircle, CheckCircle2, ExternalLink, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useScans, useDriftItems } from "@/hooks/use-scans";
import { formatRelativeTime, formatDate } from "@/lib/utils";

export default function ScansPage({ params }) {
  const resolvedParams = use(params);
  const { projectId } = resolvedParams;
  const { data: scansData, isLoading } = useScans(projectId);
  const { data: driftData } = useDriftItems(projectId, { resolved: false });

  const scans = scansData?.scans || [];
  const driftItems = driftData?.driftItems || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scans</h1>
        <p className="text-muted-foreground">
          View scan history and detected drift items
        </p>
      </div>

      {/* Drift Items Section */}
      {driftItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Open Drift Items ({driftItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {driftItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.area} • Confidence: {item.confidence}%
                  </p>
                </div>
                <Badge
                  variant={
                    item.severity === "high"
                      ? "destructive"
                      : item.severity === "medium"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {item.severity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scans Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet</p>
          ) : (
            <div className="space-y-4">
              {scans.map((scan) => (
                <Link
                  key={scan.id}
                  href={`/app/projects/${projectId}/scans/${scan.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(scan.status)}
                      <div>
                        <p className="font-medium">
                          {scan.source === "manual" ? "Manual scan" : "Scheduled scan"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {scan.startedAt
                            ? `Started ${formatDate(scan.startedAt)}`
                            : `Created ${formatDate(scan.createdAt)}`}
                        </p>
                        {scan.status === "running" && scan.progress?.message && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {scan.progress.message}
                            {typeof scan.progress.percent === "number" ? ` (${scan.progress.percent}%)` : ""}
                          </p>
                        )}
                        {scan.driftItemsCreated > 0 && (
                          <p className="mt-1 text-sm">
                            Found {scan.driftItemsCreated} drift{" "}
                            {scan.driftItemsCreated === 1 ? "item" : "items"}
                          </p>
                        )}
                        {scan.errorMessage && (
                          <p className="mt-1 text-sm text-destructive">
                            {scan.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={scan.status === "succeeded" ? "success" : "secondary"}>
                      {scan.status}
                    </Badge>
                  </div>
                  {(() => {
                    const analyzedCount = scan.filesScanned ?? scan.commits?.length ?? 0;
                    return analyzedCount > 0 ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                        Analyzed {analyzedCount} file
                        {analyzedCount > 1 ? "s" : ""}
                        {scan.pullRequests?.length > 0 &&
                          ` and ${scan.pullRequests.length} PR${
                            scan.pullRequests.length > 1 ? "s" : ""
                          }`}
                    </div>
                    ) : null;
                  })()}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
