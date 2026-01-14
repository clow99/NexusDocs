"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get scans for a project
 * @param {string} projectId - Project ID
 */
export function useScans(projectId) {
  return useQuery({
    queryKey: ["projects", projectId, "scans"],
    queryFn: () => api.getScans(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    // Keep refreshing while any scan is still active
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActiveScan = data?.scans?.some(
        (scan) => scan.status === "running" || scan.status === "pending"
      );
      return hasActiveScan ? 5000 : false;
    },
  });
}

/**
 * Hook to get a single scan
 * @param {string} projectId - Project ID
 * @param {string} scanId - Scan ID
 */
export function useScan(projectId, scanId) {
  return useQuery({
    queryKey: ["projects", projectId, "scans", scanId],
    queryFn: () => api.getScan(projectId, scanId),
    enabled: !!projectId && !!scanId,
    staleTime: 30 * 1000,
    // Refetch if scan is running
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "running" ? 5000 : false;
    },
  });
}

/**
 * Hook to run a scan
 * @param {string} projectId - Project ID
 */
export function useRunScan(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.runScan(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "scans"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      // A scan can create/update proposals (docs generation), so refresh those too.
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "drift"] });
    },
  });
}

/**
 * Hook to get drift items for a project
 * @param {string} projectId - Project ID
 * @param {Object} options - Filter options
 * @param {boolean} [options.resolved] - Filter by resolved status
 */
export function useDriftItems(projectId, options = {}) {
  return useQuery({
    queryKey: ["projects", projectId, "drift", options],
    queryFn: () => api.getDriftItems(projectId, options),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}
