"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CouncilMark } from "./council-mark";
import { LoadingDots } from "./loading-dots";
import {
  isPowerUser,
  isReflection,
  parseReflection,
  type ConversationMessage,
  type IntakeContext,
} from "@/lib/intake/conversation-engine";

interface CouncilConversationProps {
  onComplete: (context: IntakeContext, compiledPrompt: string) => void;
  onSkip: () => void;
  language?: "en" | "tr";
}

const FIRST_QUESTION = {
  en: "Whose life do you want to change?",
  tr: "Kimin hayatında bir şeyi değiştirmek istiyorsun?",
};

export function CouncilConversation({
  onComplete,
  onSkip,
  language = "en",
}: CouncilConversationProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { role: "council", content: FIRST_QUESTION[language] },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const powerUserRef = useRef<boolean | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTyping]);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ConversationMessage = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    // Detect power user on first message
    if (powerUserRef.current === null) {
      powerUserRef.current = isPowerUser(trimmed);
    }

    // Check if user confirmed a reflection
    const lastCouncil = messages.filter((m) => m.role === "council").at(-1);
    if (lastCouncil && isReflection(lastCouncil.content)) {
      const yes = /^(yes|evet|doğru|correct|right|tamam|ok)/i.test(trimmed);
      if (yes) {
        const ctx = parseReflection(lastCouncil.content);
        if (ctx) {
          ctx.raw_conversation = updated;
          const compiled = compilePrompt(ctx);
          setConfirmed(true);
          setLoading(false);
          onComplete(ctx, compiled);
          return;
        }
      }
      // User wants to adjust — continue conversation
    }

    // Show typing indicator
    setShowTyping(true);
    await new Promise((r) => setTimeout(r, 500));

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          isPowerUser: powerUserRef.current,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setShowTyping(false);

      const councilMsg: ConversationMessage = {
        role: "council",
        content: data.response,
      };
      setMessages((prev) => [...prev, councilMsg]);

      // Auto-complete if reflection was confirmed
      if (isReflection(data.response)) {
        // Wait for user confirmation
      }
    } catch {
      setShowTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "council",
          content:
            language === "tr"
              ? "Bir sorunla karşılaştı. Tekrar deneyelim."
              : "Hit a snag. Let's try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, language, onComplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (confirmed) return null;

  return (
    <div
      data-slot="council-conversation"
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
    >
      <div className="flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-up ${
              msg.role === "council" ? "flex gap-3 items-start" : "pl-10"
            }`}
          >
            {msg.role === "council" && (
              <CouncilMark className="h-6 w-6 shrink-0 mt-0.5" />
            )}
            <p
              className={
                msg.role === "council"
                  ? "text-[15px] leading-relaxed text-foreground whitespace-pre-wrap"
                  : "text-[15px] leading-relaxed text-muted-foreground"
              }
            >
              {msg.role === "council"
                ? formatCouncilMessage(msg.content)
                : msg.content}
            </p>
          </div>
        ))}

        {showTyping && (
          <div className="flex gap-3 items-start animate-fade-up">
            <CouncilMark className="h-6 w-6 shrink-0 mt-0.5" />
            <LoadingDots />
          </div>
        )}
      </div>

      {/* Reflection actions */}
      {!loading &&
        isReflection(
          messages.filter((m) => m.role === "council").at(-1)?.content ?? ""
        ) && (
          <div className="flex gap-3 pl-10 animate-fade-up">
            <button
              onClick={() => {
                setInput(language === "tr" ? "Evet, doğru" : "Yes, that's right");
                setTimeout(handleSubmit, 50);
              }}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              {language === "tr" ? "Evet, analiz et" : "Yes, analyze"}
            </button>
            <button
              onClick={() => inputRef.current?.focus()}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {language === "tr" ? "Düzeltmek istiyorum" : "I want to adjust"}
            </button>
          </div>
        )}

      <div ref={bottomRef} />

      {/* Input */}
      <div className="sticky bottom-4 bg-background/80 backdrop-blur-sm rounded-xl border p-1 flex items-center gap-1">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            language === "tr" ? "Cevabını yaz..." : "Type your answer..."
          }
          disabled={loading}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 disabled:opacity-15 hover:opacity-80 transition-all mr-1"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Skip link — only on first question */}
      {messages.length === 1 && (
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors text-center"
        >
          {language === "tr"
            ? "Fikrimi direkt anlatmak istiyorum"
            : "I want to describe my idea directly"}
        </button>
      )}
    </div>
  );
}

function formatCouncilMessage(content: string): string {
  // Strip reflection markers for display
  return content
    .replace(/\[REFLECTION\]/g, "")
    .replace(/\[\/REFLECTION\]/g, "")
    .trim();
}

function compilePrompt(ctx: IntakeContext): string {
  return `Target User: ${ctx.target_user}
Problem: ${ctx.problem}
Vision: ${ctx.vision}
Team: ${ctx.team}
Traction: ${ctx.traction}
${ctx.differentiator ? `Differentiator: ${ctx.differentiator}` : ""}`.trim();
}
