"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, RefreshCw, Send, FileText, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DiffViewer } from "@/components/proposals/diff-viewer";
import { MarkdownEditor } from "@/components/proposals/markdown-editor";
import {
  useProposal,
  useApproveProposal,
  useRejectProposal,
  usePublishProposal,
  useRegenerateProposal,
} from "@/hooks/use-proposals";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ProposalDetailPage({ params }) {
  const resolvedParams = use(params);
  const { projectId, proposalId } = resolvedParams;
  const { data: proposal, isLoading } = useProposal(projectId, proposalId);
  const approveProposal = useApproveProposal(projectId, proposalId);
  const rejectProposal = useRejectProposal(projectId, proposalId);
  const publishProposal = usePublishProposal(projectId, proposalId);
  const regenerateProposal = useRegenerateProposal(projectId, proposalId);
  const { toast } = useToast();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateConstraints, setRegenerateConstraints] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const handleApprove = async () => {
    try {
      await approveProposal.mutateAsync();
      toast({ title: "Proposal approved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to approve", description: err.message });
    }
  };

  const handleReject = async () => {
    try {
      await rejectProposal.mutateAsync(rejectReason);
      setRejectDialogOpen(false);
      toast({ title: "Proposal rejected" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to reject", description: err.message });
    }
  };

  const handlePublish = async () => {
    try {
      await publishProposal.mutateAsync();
      toast({ title: "Proposal published", description: "A PR has been created" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to publish", description: err.message });
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerateProposal.mutateAsync({
        constraints: regenerateConstraints.split("\n").filter(Boolean),
      });
      setRegenerateDialogOpen(false);
      toast({ title: "Regenerating proposal..." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to regenerate", description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center">
        <p>Proposal not found</p>
      </div>
    );
  }

  const selectedFile = proposal.files?.[selectedFileIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/app/projects/${projectId}/proposals`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold line-clamp-1">{proposal.summary}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{formatDate(proposal.createdAt)}</span>
              <span>•</span>
              <span>{proposal.modelLabel}</span>
              <span>•</span>
              <span>{proposal.files?.length || 0} files</span>
            </div>
          </div>
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

      {/* Actions */}
      {proposal.status === "pending" && (
        <div className="flex gap-2">
          <Button onClick={handleApprove} disabled={approveProposal.isPending}>
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
          <Button variant="outline" onClick={() => setRejectDialogOpen(true)}>
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button variant="outline" onClick={() => setRegenerateDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
        </div>
      )}

      {proposal.status === "approved" && (
        <div className="flex gap-2">
          <Button onClick={handlePublish} disabled={publishProposal.isPending}>
            <Send className="mr-2 h-4 w-4" />
            {publishProposal.isPending ? "Publishing..." : "Publish to GitHub"}
          </Button>
        </div>
      )}

      {proposal.publishResult?.prUrl && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-4">
            <p className="text-sm">
              Published as{" "}
              <a
                href={proposal.publishResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                PR #{proposal.publishResult.prNumber}
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* File Tabs and Content */}
      {proposal.files && proposal.files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Changes</CardTitle>
              {proposal.status === "pending" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                    } else {
                      setEditedContent(selectedFile?.after || "");
                      setIsEditing(true);
                    }
                  }}
                >
                  <Edit className="mr-2 h-3 w-3" />
                  {isEditing ? "View Diff" : "Edit"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={String(selectedFileIndex)}
              onValueChange={(v) => {
                setSelectedFileIndex(parseInt(v));
                setIsEditing(false);
              }}
            >
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {proposal.files.map((file, index) => (
                  <TabsTrigger
                    key={file.path}
                    value={String(index)}
                    className="text-xs"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    {file.path.split("/").pop()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {proposal.files.map((file, index) => (
                <TabsContent key={file.path} value={String(index)}>
                  <div className="text-xs text-muted-foreground mb-2 font-mono">
                    {file.path}
                  </div>
                  {isEditing && index === selectedFileIndex ? (
                    <MarkdownEditor
                      value={editedContent}
                      onChange={setEditedContent}
                    />
                  ) : (
                    <DiffViewer diff={file.diff} />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Proposal</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this proposal.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason || rejectProposal.isPending}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Proposal</DialogTitle>
            <DialogDescription>
              Add constraints for the AI to follow when regenerating.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="constraints">Constraints (one per line)</Label>
            <Textarea
              id="constraints"
              value={regenerateConstraints}
              onChange={(e) => setRegenerateConstraints(e.target.value)}
              placeholder="Keep section X unchanged&#10;Use bullet points&#10;Make it shorter"
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={regenerateProposal.isPending}
            >
              {regenerateProposal.isPending ? "Regenerating..." : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
