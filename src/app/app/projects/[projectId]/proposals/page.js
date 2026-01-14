"use client";

import { use } from "react";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useProposals } from "@/hooks/use-proposals";
import { formatRelativeTime } from "@/lib/utils";

function ProposalList({ items, projectId }) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No proposals in this category
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((proposal) => (
        <Link
          key={proposal.id}
          href={`/app/projects/${projectId}/proposals/${proposal.id}`}
          className="block rounded-lg border p-4 transition-colors hover:bg-accent"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium line-clamp-1">{proposal.summary}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {proposal.files?.length || 0} files
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(proposal.createdAt)}
                </span>
                <span className="text-xs">{proposal.modelLabel}</span>
              </div>
              {proposal.publishResult?.prUrl && (
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(proposal.publishResult.prUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  PR #{proposal.publishResult.prNumber}
                </button>
              )}
              {proposal.rejectionReason && (
                <p className="mt-2 text-sm text-destructive">
                  Rejected: {proposal.rejectionReason}
                </p>
              )}
            </div>
            <Badge
              variant={
                proposal.status === "published"
                  ? "default"
                  : proposal.status === "approved"
                  ? "success"
                  : proposal.status === "rejected"
                  ? "destructive"
                  : "warning"
              }
            >
              {proposal.status}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ProposalsPage({ params }) {
  const resolvedParams = use(params);
  const { projectId } = resolvedParams;
  const { data: allData, isLoading } = useProposals(projectId);

  const proposals = allData?.proposals || [];
  const pending = proposals.filter((p) => p.status === "pending");
  const approved = proposals.filter((p) => p.status === "approved");
  const published = proposals.filter((p) => p.status === "published");
  const rejected = proposals.filter((p) => p.status === "rejected");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
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
        <h1 className="text-2xl font-bold">Proposals</h1>
        <p className="text-muted-foreground">
          Review and manage AI-generated documentation updates
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending
            {pending.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <ProposalList items={pending} projectId={projectId} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          <ProposalList items={approved} projectId={projectId} />
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          <ProposalList items={published} projectId={projectId} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          <ProposalList items={rejected} projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
