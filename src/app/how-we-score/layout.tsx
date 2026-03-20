import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How We Score — Council",
  description:
    "Learn how Council evaluates startup ideas across 5 dimensions with a transparent scoring rubric, penalty system, and verdict decision tree.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
