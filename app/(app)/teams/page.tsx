"use client";

import { useEffect } from "react";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { FantasyMatchupCard } from "@/components/FantasyMatchupCard";
import { EmptyState } from "@/components/ui/states";
import { track } from "@/lib/analytics";

export default function TeamsPage() {
  useEffect(() => {
    track("teams_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio) => {
        const { matchups } = portfolio;
        const wins = matchups.filter(
          (m) =>
            m.matchup.status === "winning" ||
            (m.matchup.status === "final" && m.matchup.userScore > m.matchup.opponentScore)
        ).length;
        const losses = matchups.filter(
          (m) =>
            m.matchup.status === "losing" ||
            (m.matchup.status === "final" && m.matchup.userScore < m.matchup.opponentScore)
        ).length;

        return (
          <div className="space-y-3">
            <PageHeader
              title="My Teams"
              subtitle={
                matchups.length > 0 ? (
                  <span className="tnum">
                    {matchups.length} matchups · {wins} projected wins · {losses} projected losses ·
                    overall projected record{" "}
                    <strong className="text-ink">
                      {wins}–{losses}
                    </strong>
                  </span>
                ) : undefined
              }
            />
            {matchups.length === 0 ? (
              <EmptyState
                title="No fantasy matchups"
                message="Connect a fantasy league in Settings, or explore demo mode to see matchups here."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {matchups.map((m) => (
                  <FantasyMatchupCard key={m.matchup.id} view={m} />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
