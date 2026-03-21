"use client";

import { useState } from "react";
import { X, Link2, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/track-event";

interface ShareTier {
  name: string;
  url: string;
  description: string;
  available: boolean;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  threadId: string;
  threadName: string;
  latestMissionId: string | null;
  runCount: number;
  hasGenesis: boolean;
}

export function ShareModal({
  open,
  onClose,
  threadId,
  threadName,
  latestMissionId,
  runCount,
  hasGenesis,
}: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const tiers: ShareTier[] = [
    {
      name: "Brief Card",
      url: latestMissionId ? `${origin}/brief/${latestMissionId}` : "",
      description: "Share your latest strategic brief",
      available: !!latestMissionId,
    },
    {
      name: "Transformation Card",
      url: `${origin}/thread/${threadId}/share`,
      description: "Show your score journey over time",
      available: runCount >= 2,
    },
    {
      name: "Genesis Card",
      url: `${origin}/thread/${threadId}/share?view=genesis`,
      description: "Share your built product",
      available: hasGenesis,
    },
  ];

  const handleCopy = (tier: ShareTier) => {
    navigator.clipboard.writeText(tier.url).then(() => {
      setCopied(tier.name);
      trackEvent({
        event: "share_copied",
        thread_id: threadId,
        metadata: { tier: tier.name },
      });
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleNativeShare = (tier: ShareTier) => {
    if (navigator.share) {
      navigator.share({
        title: `Council — ${threadName}`,
        url: tier.url,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Share</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-lg border p-3 ${
                tier.available
                  ? "bg-card"
                  : "bg-muted/20 opacity-50 pointer-events-none"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{tier.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.description}
                  </p>
                </div>
                {tier.available && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(tier)}
                      className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                      title="Copy link"
                    >
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <button
                        onClick={() => handleNativeShare(tier)}
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {copied === tier.name && (
                <p className="text-[10px] text-status-success mt-1">Copied!</p>
              )}
              {!tier.available && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {tier.name === "Transformation Card"
                    ? "Available after 2+ runs"
                    : "Available after Genesis"}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
