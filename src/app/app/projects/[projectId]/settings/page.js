"use client";

import { use, useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectSettings, useUpdateProjectSettings } from "@/hooks/use-projects";
import { useToast } from "@/hooks/use-toast";

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

const LEGACY_DOC_PATH_MAP = new Map([
  ["docs/api/README.md", "docs/api/reference.md"],
  ["docs/guides/README.md", "docs/guides/user-guide.md"],
  ["docs/tutorials/README.md", "docs/tutorials/getting-started.md"],
  ["docs/architecture/README.md", "docs/architecture/overview.md"],
]);

function mapLegacyPaths(paths = []) {
  if (!Array.isArray(paths)) return [];
  return paths.map((p) => LEGACY_DOC_PATH_MAP.get(p) || p);
}

function normalizeDocsPaths(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toDocTargetShape(target) {
  const paths = Array.isArray(target?.paths)
    ? target.paths
    : typeof target?.paths === "string"
    ? [target.paths]
    : [];

  return {
    type: String(target?.type || "Other"),
    paths: mapLegacyPaths(paths).filter(Boolean),
    enabled: target?.enabled !== false,
  };
}

function buildDefaultDocTargets() {
  return DOCUMENT_PRESETS.map((p) => ({
    type: p.type,
    paths: p.paths,
    enabled: p.defaultEnabled,
  }));
}

function mergeDocTargetsFromSettings(existingTargets) {
  const normalized = Array.isArray(existingTargets) ? existingTargets.map(toDocTargetShape) : [];
  const byType = new Map(normalized.map((t) => [String(t.type), t]));

  const mergedPresets = DOCUMENT_PRESETS.map((preset) => {
    const existing = byType.get(preset.type);
    if (!existing) {
      return {
        type: preset.type,
        paths: preset.paths,
        enabled: false,
      };
    }

    return {
      type: preset.type,
      paths: mapLegacyPaths(existing.paths?.length ? existing.paths : preset.paths),
      enabled: existing.enabled !== false,
    };
  });

  const presetTypes = new Set(DOCUMENT_PRESETS.map((p) => p.type));
  const extras = normalized.filter((t) => !presetTypes.has(String(t.type)));

  return [...mergedPresets, ...extras];
}

export default function SettingsPage({ params }) {
  const resolvedParams = use(params);
  const { projectId } = resolvedParams;
  const { data: settings, isLoading } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);
  const { toast } = useToast();

  // Local state for form fields
  // We map the backend schema (flat) to the frontend UI structure
  const [docTargets, setDocTargets] = useState([]);
  const [scanFrequency, setScanFrequency] = useState("daily");
  const [targetBranch, setTargetBranch] = useState("main");
  const [codePaths, setCodePaths] = useState([]);
  
  // Flag to prevent overwriting local state on re-renders
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize state from fetched data
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings && !isInitialized) {
      const normalizedDocsPaths = normalizeDocsPaths(settings.docsPaths);
      const hasStoredDocsPaths = normalizedDocsPaths.length > 0;

      if (hasStoredDocsPaths) {
        setDocTargets(mergeDocTargetsFromSettings(normalizedDocsPaths));
      } else {
        setDocTargets(buildDefaultDocTargets());
      }

      // Map backend `codePaths` (JSON)
      if (Array.isArray(settings.codePaths)) {
        setCodePaths(settings.codePaths);
      }

      if (settings.scanFrequency) setScanFrequency(settings.scanFrequency);
      if (settings.targetBranch) setTargetBranch(settings.targetBranch);
      
      setIsInitialized(true);
    }
  }, [settings, isInitialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      // Transform local state back to backend schema
      const payload = {
        docsPaths: docTargets, // Save document selection to docsPaths JSON
        codePaths: codePaths,
        scanFrequency,
        targetBranch,
        // Add other mappings as needed
      };

      await updateSettings.mutateAsync(payload);
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to save settings", description: err.message });
    }
  };

  const toggleDocument = (type, checked) => {
    setDocTargets((prev) =>
      prev.map((t) => (String(t.type) === String(type) ? { ...t, enabled: Boolean(checked) } : t))
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure project scanning and documentation settings
        </p>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Scan Schedule</CardTitle>
              <CardDescription>
                Configure when and how often to scan for documentation drift
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scan Frequency</Label>
                  <Select value={scanFrequency} onValueChange={setScanFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Branch</Label>
                  <Input 
                    value={targetBranch} 
                    onChange={(e) => setTargetBranch(e.target.value)} 
                    placeholder="main"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Select which documents NexusDocs should generate/update during scans.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
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

              {docTargets.some((t) => !DOCUMENT_PRESETS.some((p) => p.type === String(t.type))) ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium">Other (legacy/custom)</h3>
                    <p className="text-xs text-muted-foreground">
                      These were previously configured. They’re preserved for now.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {docTargets
                      .filter((t) => !DOCUMENT_PRESETS.some((p) => p.type === String(t.type)))
                      .map((t) => (
                        <div key={String(t.type)} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Switch
                                checked={Boolean(t.enabled)}
                                onCheckedChange={(checked) => toggleDocument(t.type, checked)}
                              />
                              <div className="space-y-1">
                                <Label className="text-base">{String(t.type)}</Label>
                                <p className="text-sm text-muted-foreground">
                                  {Array.isArray(t.paths) ? t.paths.join(", ") : String(t.paths || "")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
