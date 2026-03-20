"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface CheckpointProps {
  phase: number;
  phaseName: string;
  summary: string;
  details: string[];
  onApprove: () => void;
  onChange: (feedback: string) => void;
  loading?: boolean;
}

export function PhaseCheckpoint({
  phase,
  phaseName,
  summary,
  details,
  onApprove,
  onChange,
  loading,
}: CheckpointProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm font-mono">
            Phase {phase}
          </Badge>
          <h3 className="text-lg font-semibold">{phaseName}</h3>
        </div>
        <Badge className="bg-status-warning/15 text-status-warning">
          Awaiting Approval
        </Badge>
      </div>

      <p className="text-muted-foreground">{summary}</p>

      {details.length > 0 && (
        <ul className="space-y-1 text-sm">
          {details.map((detail, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-status-success mt-0.5">✓</span>
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}

      {showFeedback ? (
        <div className="space-y-3">
          <Textarea
            placeholder="What would you like to change?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowFeedback(false);
                setFeedback("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(feedback);
                setShowFeedback(false);
                setFeedback("");
              }}
              disabled={!feedback.trim()}
            >
              Submit Change
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 pt-2">
          <Button onClick={onApprove} disabled={loading} className="flex-1">
            {loading ? "Processing..." : "Continue →"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFeedback(true)}
            disabled={loading}
          >
            Change
          </Button>
        </div>
      )}
    </Card>
  );
}
