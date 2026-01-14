"use client";

import { useState } from "react";
import { Github, Cpu, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser, useGitHubDisconnect } from "@/hooks/use-auth";
import { useAIStatus } from "@/hooks/use-ai";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationsPage() {
  const { data: userData, isLoading: userLoading } = useUser();
  const { data: aiStatus, isLoading: aiLoading } = useAIStatus();
  const disconnectGitHub = useGitHubDisconnect();
  const { toast } = useToast();
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);

  const githubConnection = userData?.githubConnection;

  const handleDisconnect = async () => {
    try {
      await disconnectGitHub.mutateAsync();
      toast({ title: "GitHub disconnected" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to disconnect",
        description: err.message,
      });
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setIsConnectingGitHub(true);
      const res = await fetch("/api/auth/github/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to start GitHub connection.");
      }
      if (!data?.redirectUrl) {
        throw new Error("Missing redirect URL.");
      }
      window.location.assign(data.redirectUrl);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to connect GitHub",
        description: err.message,
      });
      setIsConnectingGitHub(false);
    }
  };

  if (userLoading || aiLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Manage your connected services
        </p>
      </div>

      {/* GitHub Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>GitHub</CardTitle>
                <CardDescription>
                  Repository access and PR creation
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={
                githubConnection?.status === "connected" ? "success" : "destructive"
              }
            >
              {githubConnection?.status === "connected" ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Connected
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Disconnected
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {githubConnection?.status === "connected" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Username</p>
                  <p className="text-sm text-muted-foreground">
                    @{githubConnection.username}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Connection Method</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {githubConnection.method}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Last Validated</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(githubConnection.lastValidatedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Scopes</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {githubConnection.scopes?.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Revalidate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnectGitHub.isPending}
                >
                  {disconnectGitHub.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : null}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleConnectGitHub} disabled={isConnectingGitHub}>
              {isConnectingGitHub ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Connect GitHub
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AI Service Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>AI Service</CardTitle>
                <CardDescription>
                  OpenAI integration for documentation generation
                </CardDescription>
              </div>
            </div>
            <Badge variant={aiStatus?.configured ? "success" : "secondary"}>
              {aiStatus?.configured ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Configured
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" />
                  Not Configured
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiStatus?.configured ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Model</p>
                <p className="text-sm text-muted-foreground">
                  {aiStatus.defaultModelLabel}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Rate Limits</p>
                <p className="text-sm text-muted-foreground">
                  {aiStatus.limits?.requestsPerMinute} req/min •{" "}
                  {aiStatus.limits?.tokensPerMinute?.toLocaleString()} tokens/min
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                AI service is configured by the app administrator. The OpenAI API
                key is stored securely on the server and is never exposed to the
                browser.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
