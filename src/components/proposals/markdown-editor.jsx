"use client";

/**
 * @fileoverview Markdown editor with live preview
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Markdown editor with live preview
 * @param {Object} props
 * @param {string} props.value - Current markdown content
 * @param {(value: string) => void} props.onChange - Change handler
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.minHeight] - Minimum height in pixels
 */
export function MarkdownEditor({
  value,
  onChange,
  className,
  minHeight = 400,
}) {
  const [activeTab, setActiveTab] = useState("write");

  return (
    <div className={cn("rounded-lg border", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="border-b px-4">
          <TabsList className="h-10 bg-transparent p-0">
            <TabsTrigger
              value="write"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Write
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Preview
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="write" className="m-0">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your markdown here..."
            className="resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0"
            style={{ minHeight }}
          />
        </TabsContent>
        <TabsContent value="preview" className="m-0">
          <div
            className="markdown-preview p-4 overflow-auto"
            style={{ minHeight }}
          >
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">Nothing to preview</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
