"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/client";

/**
 * Hook to get proposals for a project
 * @param {string} projectId - Project ID
 * @param {Object} options - Filter options
 * @param {string} [options.status] - Status filter
 */
export function useProposals(projectId, options = {}) {
  return useQuery({
    queryKey: ["projects", projectId, "proposals", options],
    queryFn: () => api.getProposals(projectId, options),
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to get a single proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 */
export function useProposal(projectId, proposalId) {
  return useQuery({
    queryKey: ["projects", projectId, "proposals", proposalId],
    queryFn: () => api.getProposal(projectId, proposalId),
    enabled: !!projectId && !!proposalId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to generate new proposals
 * @param {string} projectId - Project ID
 */
export function useGenerateProposals(projectId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.generateProposals(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
    },
  });
}

/**
 * Hook to regenerate a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 */
export function useRegenerateProposal(projectId, proposalId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.regenerateProposal(projectId, proposalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
    },
  });
}

/**
 * Hook to approve a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 */
export function useApproveProposal(projectId, proposalId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.approveProposal(projectId, proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

/**
 * Hook to reject a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 */
export function useRejectProposal(projectId, proposalId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason) => api.rejectProposal(projectId, proposalId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

/**
 * Hook to publish a proposal
 * @param {string} projectId - Project ID
 * @param {string} proposalId - Proposal ID
 */
export function usePublishProposal(projectId, proposalId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.publishProposal(projectId, proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
