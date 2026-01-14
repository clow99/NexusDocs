"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Github, Key, Check, ChevronRight, FolderGit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGitHubRepos, useGitHubPATConnect } from "@/hooks/use-auth";
import { useCreateProject } from "@/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const steps = ["Connect GitHub", "Select Repositories", "Create Projects"];

const DOCUMENT_PRESETS = [
  {
    type: "README",
    label: "README",
    description: "Project overview and quickstart.",
    paths: ["README.md"],
    defaultEnabled: true,
  },
  {
    type: "API Reference",
    label: "API Reference",
    description: "Endpoints and usage details extracted from the repo.",
    paths: ["docs/api/reference.md"],
    defaultEnabled: false,
  },
  {
    type: "User Guide",
    label: "User Guide",
    description: "How-to docs for day-to-day usage.",
    paths: ["docs/guides/user-guide.md"],
    defaultEnabled: false,
  },
  {
    type: "Tutorial",
    label: "Tutorial",
    description: "Step-by-step walkthroughs for onboarding.",
    paths: ["docs/tutorials/getting-started.md"],
    defaultEnabled: false,
  },
  {
    type: "Architecture",
    label: "Architecture",
    description: "High-level system and repo layout.",
    paths: ["docs/architecture/overview.md"],
    defaultEnabled: false,
  },
];

function buildDefaultDocTargets() {
  return DOCUMENT_PRESETS.map((p) => ({
    type: p.type,
    paths: p.paths,
    enabled: p.defaultEnabled,
  }));
}

export default function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(() => {
    const connected = searchParams.get("connected");
    const step = searchParams.get("step");
    if (connected === "true" && step) {
      const parsed = Number.parseInt(step, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  });
  const [patToken, setPatToken] = useState("");
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingProjects, setIsCreatingProjects] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docTargets, setDocTargets] = useState(() => buildDefaultDocTargets());
  const { toast } = useToast();

  const patConnect = useGitHubPATConnect();
  const { data: reposData, isLoading: reposLoading } = useGitHubRepos({
    enabled: currentStep >= 1,
  });
  const createProject = useCreateProject();

  const repos = reposData?.repos || [];

  // Handle OAuth callback parameters
  useEffect(() => {
    const connected = searchParams.get("connected");
    const step = searchParams.get("step");
    const error = searchParams.get("error");

    if (error) {
      toast({
        variant: "destructive",
        title: "GitHub Connection Failed",
        description: error,
      });
      // Clean URL
      router.replace("/app/onboarding");
    } else if (connected === "true" && step) {
      // Clean URL (step is applied via initial state)
      router.replace("/app/onboarding");
    }
  }, [searchParams, toast, router]);

  const handleOAuthConnect = async () => {
    try {
      setIsConnecting(true);
      const res = await fetch("/api/auth/github/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to start GitHub connection.");
      if (!data?.redirectUrl) throw new Error("Missing redirect URL.");
      window.location.assign(data.redirectUrl);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to connect GitHub",
        description: err.message,
      });
      setIsConnecting(false);
    }
  };

  const handlePATConnect = async () => {
    if (!patToken) return;
    try {
      await patConnect.mutateAsync(patToken);
      setCurrentStep(1);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Invalid token",
        description: err.message,
      });
    }
  };

  const handleRepoSelect = (repo) => {
    setSelectedRepos((prev) => {
      const exists = prev.find((r) => r.id === repo.id);
      if (exists) {
        return prev.filter((r) => r.id !== repo.id);
      }
      return [...prev, repo];
    });
  };

  const toggleDocument = (type, checked) => {
    setDocTargets((prev) =>
      prev.map((t) => (String(t.type) === String(type) ? { ...t, enabled: Boolean(checked) } : t))
    );
  };

  const handleConfirmCreateProjects = async () => {
    const enabledCount = docTargets.filter((t) => t?.enabled !== false).length;
    if (enabledCount === 0) {
      toast({
        variant: "destructive",
        title: "Select at least one document",
        description: "Choose which docs NexusDocs should generate (e.g. README).",
      });
      return;
    }

    try {
      setIsCreatingProjects(true);
      for (const repo of selectedRepos) {
        await createProject.mutateAsync({
          repoOwner: repo.owner,
          repoName: repo.name,
          name: repo.name,
          docsPaths: docTargets,
        });
      }
      toast({
        title: "Projects created!",
        description: `Created ${selectedRepos.length} project(s)`,
      });
      setDocPickerOpen(false);
      router.push("/app/projects");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to create projects",
        description: err.message,
      });
    } finally {
      setIsCreatingProjects(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                  index < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === currentStep
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground"
                )}
              >
                {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  index <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="mx-4 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Connect GitHub */}
      {currentStep === 0 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Connect to GitHub</CardTitle>
            <CardDescription>Link your GitHub account to discover repositories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              className="w-full"
              size="lg"
              onClick={handleOAuthConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Connect with GitHub OAuth
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use a Personal Access Token</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pat">Personal Access Token</Label>
                <Input
                  id="pat"
                  type="password"
                  placeholder="ghp_..."
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Token needs repo and read:org scopes</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePATConnect}
                disabled={!patToken || patConnect.isPending}
              >
                <Key className="mr-2 h-4 w-4" />
                Connect with PAT
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Select Repositories */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Repositories</CardTitle>
            <CardDescription>
              Choose which repositories to track for documentation updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reposLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {repos.map((repo) => {
                  const isSelected = selectedRepos.some((r) => r.id === repo.id);
                  return (
                    <div
                      key={repo.id}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-accent"
                      )}
                      onClick={() => handleRepoSelect(repo)}
                    >
                      <Checkbox checked={isSelected} />
                      <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{repo.fullName}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {repo.description || "No description"}
                        </p>
                      </div>
                      {repo.private && <Badge variant="secondary">Private</Badge>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button onClick={() => setCurrentStep(2)} disabled={selectedRepos.length === 0}>
                Continue ({selectedRepos.length} selected)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Create Projects */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Projects</CardTitle>
            <CardDescription>Review and create projects for your selected repositories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {selectedRepos.map((repo) => (
                <div key={repo.id} className="flex items-center gap-4 rounded-lg border p-4">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{repo.name}</p>
                    <p className="text-sm text-muted-foreground">{repo.fullName}</p>
                  </div>
                  <Badge variant="success">Ready</Badge>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setDocPickerOpen(true)}
                disabled={createProject.isPending || isCreatingProjects}
              >
                {createProject.isPending || isCreatingProjects ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Create {selectedRepos.length} Project(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={docPickerOpen} onOpenChange={(open) => (!isCreatingProjects ? setDocPickerOpen(open) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select documents to generate</DialogTitle>
            <DialogDescription>
              Pick the docs NexusDocs should create/update for each new project. You can change this later in Project
              Settings → Documents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {DOCUMENT_PRESETS.map((preset) => {
              const target = docTargets.find((t) => String(t.type) === preset.type) || {
                type: preset.type,
                paths: preset.paths,
                enabled: false,
              };
              return (
                <div key={preset.type} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Switch
                        checked={Boolean(target.enabled)}
                        onCheckedChange={(checked) => toggleDocument(preset.type, checked)}
                        disabled={isCreatingProjects}
                      />
                      <div className="space-y-1">
                        <Label className="text-base">{preset.label}</Label>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Output:{" "}
                          <code>
                            {Array.isArray(target.paths) ? target.paths.join(", ") : String(target.paths || "")}
                          </code>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDocPickerOpen(false)} disabled={isCreatingProjects}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCreateProjects} disabled={isCreatingProjects}>
              {isCreatingProjects ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create projects
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

