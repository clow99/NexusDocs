"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get AI service status
 */
export function useAIStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: api.getAIStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
