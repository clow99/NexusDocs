"use client";

/**
 * @fileoverview Diff viewer component for displaying unified diffs
 */

import { cn } from "@/lib/utils";

/**
 * Parse unified diff string into structured lines
 * @param {string} diff - Unified diff string
 * @returns {Array<{type: 'added'|'removed'|'context'|'header', content: string, lineNumber?: number}>}
 */
function parseDiff(diff) {
  if (!diff) return [];
  
  const lines = diff.split("\n");
  const result = [];
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      // Parse hunk header for line numbers
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: "header", content: line });
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      result.push({
        type: "added",
        content: line.slice(1),
        lineNumber: newLineNum++,
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      result.push({
        type: "removed",
        content: line.slice(1),
        lineNumber: oldLineNum++,
      });
    } else if (line.startsWith(" ")) {
      result.push({
        type: "context",
        content: line.slice(1),
        lineNumber: newLineNum++,
      });
      oldLineNum++;
    }
  }

  return result;
}

/**
 * Diff viewer component
 * @param {Object} props
 * @param {string} props.diff - Unified diff string
 * @param {string} [props.className] - Additional CSS classes
 */
export function DiffViewer({ diff, className }) {
  const lines = parseDiff(diff);

  if (lines.length === 0) {
    return (
      <div className={cn("rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground", className)}>
        No changes to display
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <pre className="text-sm">
          <code>
            {lines.map((line, index) => (
              <div
                key={index}
                className={cn(
                  "px-4 py-0.5 font-mono",
                  line.type === "added" && "bg-green-500/10 text-green-700 dark:text-green-400",
                  line.type === "removed" && "bg-red-500/10 text-red-700 dark:text-red-400",
                  line.type === "context" && "text-muted-foreground",
                  line.type === "header" && "bg-muted text-muted-foreground font-semibold py-1"
                )}
              >
                <span className="inline-block w-8 text-right text-muted-foreground/50 select-none mr-4">
                  {line.lineNumber || ""}
                </span>
                <span className="inline-block w-4 select-none">
                  {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                </span>
                {line.content}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
