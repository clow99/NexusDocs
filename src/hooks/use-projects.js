"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get all projects
 */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.getProjects,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get a single project
 * @param {string} projectId - Project ID
 */
export function useProject(projectId) {
  return useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api.getProject(projectId),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Hook to get project settings
 * @param {string} projectId - Project ID
 */
export function useProjectSettings(projectId) {
  return useQuery({
    queryKey: ["projects", projectId, "settings"],
    queryFn: () => api.getProjectSettings(projectId),
    enabled: !!projectId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Hook to update project settings
 * @param {string} projectId - Project ID
 */
export function useUpdateProjectSettings(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => api.updateProjectSettings(projectId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}
