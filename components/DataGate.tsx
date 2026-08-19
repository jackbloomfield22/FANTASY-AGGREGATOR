"use client";

import type { ReactNode } from "react";
import type { PortfolioSnapshot } from "@/lib/types";
import type { AggregatedPortfolio } from "@/lib/portfolio/aggregate";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { PageSkeleton, ErrorState } from "@/components/ui/states";

/**
 * Standard loading/error gate for data pages: skeleton while the first
 * snapshot loads, a retryable error state on failure, content otherwise.
 */
export function DataGate({
  children,
}: {
  children: (portfolio: AggregatedPortfolio, snapshot: PortfolioSnapshot) => ReactNode;
}) {
  const { portfolio, snapshot, loading, error, refresh } = usePortfolio();

  if (loading && !portfolio) return <PageSkeleton />;
  if (error && !portfolio) {
    return (
      <ErrorState
        title="Couldn't load your portfolio"
        message={error}
        onRetry={() => void refresh(true)}
      />
    );
  }
  if (!portfolio || !snapshot) return <PageSkeleton />;
  return <>{children(portfolio, snapshot)}</>;
}
