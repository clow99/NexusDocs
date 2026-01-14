"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get current user and connection status
 */
export function useUser() {
  return useQuery({
    queryKey: ["user"],
    queryFn: api.getMe,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update current user's profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

/**
 * Hook to connect GitHub via OAuth
 */
export function useGitHubConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.connectGitHubOAuth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

/**
 * Hook to connect GitHub via PAT
 */
export function useGitHubPATConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token) => api.connectGitHubPAT(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

/**
 * Hook to disconnect GitHub
 */
export function useGitHubDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.disconnectGitHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}

/**
 * Hook to get GitHub repositories
 * @param {Object} options - Query options
 * @param {string} [options.org] - Organization filter
 * @param {number} [options.page] - Page number
 * @param {boolean} [options.enabled] - Whether query is enabled
 */
export function useGitHubRepos(options = {}) {
  const { org, page = 1, enabled = true } = options;

  return useQuery({
    queryKey: ["github", "repos", { org, page }],
    queryFn: () => api.getRepos({ org, page }),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
