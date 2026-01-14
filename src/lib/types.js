/**
 * @fileoverview Type definitions for NexusDocs using JSDoc
 * These types are used throughout the application for type clarity
 */

// ============================================
// User & Authentication
// ============================================

/**
 * @typedef {Object} User
 * @property {string} id - Unique user identifier
 * @property {string} email - User email address
 * @property {string} name - User display name
 * @property {string} [avatarUrl] - URL to user's avatar image
 * @property {string} createdAt - ISO date string
 */

/**
 * @typedef {'connected' | 'disconnected' | 'error'} GitHubConnectionStatus
 */

/**
 * @typedef {'oauth' | 'pat'} GitHubConnectionMethod
 */

/**
 * @typedef {Object} GitHubConnection
 * @property {GitHubConnectionStatus} status - Connection status
 * @property {GitHubConnectionMethod} [method] - How the user connected
 * @property {string} [lastValidatedAt] - ISO date of last validation
 * @property {string[]} [scopes] - GitHub OAuth scopes granted
 * @property {string} [username] - GitHub username
 * @property {string} [error] - Error message if status is 'error'
 */

// ============================================
// Projects
// ============================================

/**
 * @typedef {Object} Project
 * @property {string} id - Unique project identifier
 * @property {string} name - Display name
 * @property {string} repoOwner - GitHub repo owner
 * @property {string} repoName - GitHub repo name
 * @property {string} defaultBranch - Default branch name
 * @property {boolean} enabled - Whether the project is active
 * @property {string} [lastScanAt] - ISO date of last scan
 * @property {string} [nextScanAt] - ISO date of next scheduled scan
 * @property {number} driftOpenCount - Count of open drift items
 * @property {number} proposalsPendingCount - Count of pending proposals
 * @property {string} createdAt - ISO date string
 * @property {string} updatedAt - ISO date string
 */

/**
 * @typedef {'hourly' | 'daily' | 'weekly' | 'custom'} SchedulePreset
 */

/**
 * @typedef {Object} ScanSchedule
 * @property {SchedulePreset} preset - Schedule preset type
 * @property {string[]} [customDays] - Days for custom schedule (mon, tue, etc.)
 * @property {string} [customTime] - Time for custom schedule (HH:MM)
 * @property {string} [timezone] - Timezone identifier
 * @property {string} [quietHoursStart] - Quiet hours start (HH:MM)
 * @property {string} [quietHoursEnd] - Quiet hours end (HH:MM)
 */

/**
 * @typedef {Object} DocTarget
 * @property {string} type - Target type: 'readme', 'guides', 'api'
 * @property {boolean} enabled - Whether this target is enabled
 * @property {string[]} paths - File/directory paths
 * @property {Object} [config] - Additional configuration
 * @property {string} [config.sourceOfTruth] - Source path for API docs
 * @property {string} [config.outputPath] - Output path for generated docs
 * @property {string} [config.format] - Format option
 */

/**
 * @typedef {Object} PathFilters
 * @property {string[]} includePatterns - Glob patterns to include
 * @property {string[]} excludePatterns - Glob patterns to exclude
 */

/**
 * @typedef {Object} AIPolicy
 * @property {string} tonePreset - Tone preset: 'professional', 'friendly', 'technical'
 * @property {string} linkStyle - Link style: 'relative', 'absolute'
 * @property {string[]} glossaryTerms - List of glossary terms
 * @property {string[]} doNotChangeMarkers - Markers for sections not to modify
 * @property {string[]} allowedFiles - Files AI is allowed to modify
 * @property {boolean} requireManualApproval - Whether proposals need manual approval
 */

/**
 * @typedef {Object} PublishPolicy
 * @property {boolean} prOnly - Only allow publishing via PR (not direct commit)
 * @property {string} [prBranchPrefix] - Prefix for PR branch names
 * @property {string[]} [reviewers] - GitHub usernames for PR reviewers
 */

/**
 * @typedef {Object} UpdateFrequency
 * @property {number} maxProposalsPerDay - Max proposals per day
 * @property {number} maxProposalsPerWeek - Max proposals per week
 * @property {string[]} ignorePatterns - Commit message patterns to ignore
 * @property {boolean} onlyMergedPRs - Only trigger on merged PRs
 */

/**
 * @typedef {Object} ProjectSettings
 * @property {string} projectId - Associated project ID
 * @property {ScanSchedule} scanSchedule - Scan schedule configuration
 * @property {UpdateFrequency} updateFrequency - Update frequency limits
 * @property {DocTarget[]} docTargets - Document targets configuration
 * @property {PathFilters} codePathFilters - Filters for code paths to watch
 * @property {PathFilters} docPathFilters - Filters for doc paths to update
 * @property {AIPolicy} aiPolicy - AI behavior policy
 * @property {PublishPolicy} publishPolicy - Publishing policy
 */

// ============================================
// Scans & Drift
// ============================================

/**
 * @typedef {'queued' | 'running' | 'succeeded' | 'failed'} ScanStatus
 */

/**
 * @typedef {'scheduled' | 'manual'} ScanSource
 */

/**
 * @typedef {Object} CommitInfo
 * @property {string} sha - Commit SHA
 * @property {string} message - Commit message
 * @property {string} authorName - Author name
 * @property {string} timestamp - ISO date string
 * @property {string[]} changedFiles - List of changed file paths
 */

/**
 * @typedef {Object} PullRequestInfo
 * @property {number} number - PR number
 * @property {string} title - PR title
 * @property {string} state - PR state: 'open', 'closed', 'merged'
 * @property {string} authorName - Author name
 * @property {string} mergedAt - ISO date of merge (if merged)
 */

/**
 * @typedef {Object} Scan
 * @property {string} id - Unique scan identifier
 * @property {string} projectId - Associated project ID
 * @property {ScanStatus} status - Current scan status
 * @property {ScanSource} source - What triggered the scan
 * @property {string} startedAt - ISO date when scan started
 * @property {string} [finishedAt] - ISO date when scan finished
 * @property {{percent: number, phase: (string|null), message: (string|null), updatedAt: (string|null)}} [progress] - Live scan progress
 * @property {number} [filesScanned] - Count of files or commits analyzed
 * @property {CommitInfo[]} commits - Commits analyzed
 * @property {PullRequestInfo[]} pullRequests - PRs analyzed
 * @property {number} driftItemsCreated - Number of drift items created
 * @property {DriftItem[]} [driftItems] - Drift items linked to the scan
 * @property {string} [errorMessage] - Error message if failed
 */

/**
 * @typedef {'low' | 'medium' | 'high'} DriftSeverity
 */

/**
 * @typedef {Object} DriftEvidence
 * @property {string[]} changedFiles - Files that changed
 * @property {string[]} commitSummaries - Summaries of relevant commits
 * @property {string} [relevantCode] - Code snippet if applicable
 */

/**
 * @typedef {Object} DriftItem
 * @property {string} id - Unique drift item identifier
 * @property {string} scanId - Associated scan ID
 * @property {string} projectId - Associated project ID
 * @property {string} title - Brief title of the drift
 * @property {string} area - Affected area/module
 * @property {DriftEvidence} evidence - Evidence of the drift
 * @property {string[]} suggestedTargets - Suggested doc targets to update
 * @property {number} confidence - Confidence score (0-100)
 * @property {DriftSeverity} severity - Severity level
 * @property {boolean} resolved - Whether this drift has been resolved
 * @property {string} createdAt - ISO date string
 */

// ============================================
// Proposals
// ============================================

/**
 * @typedef {'pending' | 'approved' | 'rejected' | 'published'} ProposalStatus
 */

/**
 * @typedef {Object} ProposalFile
 * @property {string} path - File path relative to repo root
 * @property {string} before - Content before changes
 * @property {string} after - Content after changes
 * @property {string} diff - Unified diff string
 */

/**
 * @typedef {Object} PublishResult
 * @property {string} [prUrl] - URL to the created PR
 * @property {number} [prNumber] - PR number
 * @property {string} [commitHash] - Commit hash (for direct commits)
 * @property {string} publishedAt - ISO date of publish
 */

/**
 * @typedef {Object} Proposal
 * @property {string} id - Unique proposal identifier
 * @property {string} projectId - Associated project ID
 * @property {ProposalStatus} status - Current status
 * @property {string} summary - Summary of proposed changes
 * @property {string} createdAt - ISO date string
 * @property {string} [scanId] - Associated scan ID
 * @property {string[]} [driftItemIds] - Associated drift item IDs
 * @property {string} modelLabel - AI model used (e.g., "OpenAI (app key)")
 * @property {string} promptVersion - Hash/version of the prompt used
 * @property {ProposalFile[]} files - Proposed file changes
 * @property {PublishResult} [publishResult] - Result if published
 * @property {string} [rejectionReason] - Reason if rejected
 * @property {string} [approvedBy] - User ID who approved
 * @property {string} [approvedAt] - ISO date of approval
 */

// ============================================
// Audit
// ============================================

/**
 * @typedef {Object} AuditEvent
 * @property {string} id - Unique event identifier
 * @property {string} at - ISO date of the event
 * @property {string} type - Event type: 'scan.started', 'proposal.approved', etc.
 * @property {string} actor - Who triggered: 'user', 'system', 'scheduler'
 * @property {string} [userId] - User ID if actor is 'user'
 * @property {string} [projectId] - Associated project ID
 * @property {Object} metadata - Additional event data
 */

// ============================================
// API
// ============================================

/**
 * @typedef {Object} APIError
 * @property {string} code - Error code
 * @property {string} message - Human-readable error message
 * @property {Object} [details] - Additional error details
 * @property {string} [requestId] - Request ID for debugging
 * @property {number} [retryAfterSeconds] - Seconds to wait before retry (for 429)
 */

/**
 * @typedef {Object} AIServiceStatus
 * @property {boolean} configured - Whether AI is configured
 * @property {string} [defaultModelLabel] - Model label (e.g., "OpenAI (app key)")
 * @property {Object} [limits] - Rate limit info
 * @property {number} [limits.requestsPerMinute] - Requests per minute limit
 * @property {number} [limits.tokensPerMinute] - Tokens per minute limit
 */

/**
 * @typedef {Object} GitHubRepo
 * @property {string} id - GitHub repo ID
 * @property {string} name - Repository name
 * @property {string} fullName - Full name (owner/repo)
 * @property {string} owner - Owner login
 * @property {string} description - Repository description
 * @property {string} defaultBranch - Default branch name
 * @property {boolean} private - Whether the repo is private
 * @property {string} htmlUrl - URL to repo on GitHub
 * @property {string} updatedAt - ISO date of last update
 */

// Export empty object to make this a module
export {};
