"use client";

import { useState } from "react";
import { History, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditEvents } from "@/hooks/use-audit";
import { useProjects } from "@/hooks/use-projects";
import { formatDate, formatRelativeTime } from "@/lib/utils";

const eventTypeLabels = {
  "scan.started": "Scan Started",
  "scan.completed": "Scan Completed",
  "proposal.created": "Proposal Created",
  "proposal.approved": "Proposal Approved",
  "proposal.rejected": "Proposal Rejected",
  "proposal.published": "Proposal Published",
  "project.created": "Project Created",
  "project.disabled": "Project Disabled",
};

const eventTypeBadgeVariant = {
  "scan.started": "secondary",
  "scan.completed": "success",
  "proposal.created": "default",
  "proposal.approved": "success",
  "proposal.rejected": "destructive",
  "proposal.published": "default",
  "project.created": "success",
  "project.disabled": "warning",
};

export default function AuditPage() {
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState(null);

  const { data: projectsData } = useProjects();
  const { data: auditData, isLoading } = useAuditEvents({
    projectId: projectFilter !== "all" ? projectFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
  });

  const projects = projectsData?.projects || [];
  const events = auditData?.events || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all activity across your projects
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {Object.entries(eventTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No events found
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const project = projects.find((p) => p.id === event.projectId);
                const isExpanded = expandedEvent === event.id;

                return (
                  <div
                    key={event.id}
                    className="rounded-lg border overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent"
                      onClick={() =>
                        setExpandedEvent(isExpanded ? null : event.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={eventTypeBadgeVariant[event.type] || "secondary"}
                          >
                            {eventTypeLabels[event.type] || event.type}
                          </Badge>
                          {project && (
                            <span className="text-sm text-muted-foreground">
                              {project.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.actor === "user" ? "User" : event.actor} •{" "}
                          {formatRelativeTime(event.at)}
                        </p>
                      </div>
                    </div>
                    {isExpanded && event.metadata && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="rounded bg-muted p-3 text-sm">
                          <pre className="overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
