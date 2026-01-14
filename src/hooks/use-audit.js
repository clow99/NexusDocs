"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get audit events
 * @param {Object} options - Filter options
 * @param {string} [options.projectId] - Project filter
 * @param {string} [options.type] - Event type filter
 */
export function useAuditEvents(options = {}) {
  return useQuery({
    queryKey: ["audit", options],
    queryFn: () => api.getAuditEvents(options),
    staleTime: 30 * 1000,
  });
}
