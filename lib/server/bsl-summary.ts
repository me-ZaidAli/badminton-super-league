import OpenAI from "openai";
import { db } from "./db";

// AI-written "state of the league" update for the BSL dashboard. Regenerates
// whenever a match finishes (recomputeStandings calls invalidateBslSummary()).

// Lazy OpenAI client — only constructed on first use so build-time analysis
// doesn't throw when OPENAI_API_KEY is absent.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export type BslSummaryContext = {
  standings: {
    name: string;
    points: number;
    played: number;
    won: number;
    lost: number;
  }[];
  recentResults: {
    home: string;
    away: string;
    homePoints: number;
    awayPoints: number;
    homeSets: number;
    awaySets: number;
  }[];
  topPlayers: { name: string; club: string; points: number }[];
  totalFinished: number;
};

export type BslSummary = {
  headline: string;
  text: string;
  generatedAt: number;
  basedOnFinished: number;
  ai: boolean;
};

let cache: BslSummary | null = null;
let dirty = true;
let inflight: Promise<BslSummary> | null = null;

export function invalidateBslSummary() {
  dirty = true;
}

function fallbackSummary(ctx: BslSummaryContext): BslSummary {
  const leader = ctx.standings[0];
  const chaser = ctx.standings[1];
  let text: string;
  let headline: string;
  if (!leader || ctx.totalFinished === 0) {
    headline = "The season is warming up";
    text =
      "No rubbers have been scored yet. As soon as the first matches finish, the table and these league notes will spring to life.";
  } else {
    const gap = chaser ? leader.points - chaser.points : 0;
    headline = `${leader.name} lead the way`;
    const lines: string[] = [];
    lines.push(
      `${leader.name} top the table on ${leader.points} points from ${leader.played} matches.`,
    );
    if (chaser) {
      lines.push(
        gap <= 0
          ? `${chaser.name} are right on their heels — this title race is wide open.`
          : `${chaser.name} sit ${gap} point${gap === 1 ? "" : "s"} back in second.`,
      );
    }
    const star = ctx.topPlayers[0];
    if (star)
      lines.push(
        `${star.name} (${star.club}) is the league's standout, racking up ${star.points} points.`,
      );
    const last = ctx.recentResults[0];
    if (last)
      lines.push(
        `Latest result: ${last.home} ${last.homePoints}–${last.awayPoints} ${last.away}.`,
      );
    text = lines.join(" ");
  }
  return {
    headline,
    text,
    generatedAt: Date.now(),
    basedOnFinished: ctx.totalFinished,
    ai: false,
  };
}

async function regenerate(ctx: BslSummaryContext): Promise<BslSummary> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return fallbackSummary(ctx);
  try {
    const data = {
      standings: ctx.standings.slice(0, 8),
      recentResults: ctx.recentResults.slice(0, 6),
      topPlayers: ctx.topPlayers.slice(0, 5),
      totalFinished: ctx.totalFinished,
    };
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content:
            "You are the in-house analyst for the Birmingham Super League (BSL), a badminton league. " +
            "Write a punchy, upbeat 'state of the league' update for the league homepage. " +
            "Use ONLY the JSON data provided — never invent clubs, players, or numbers. " +
            'Ranking is by POINTS only. Reply strictly as JSON: {"headline":"...","text":"..."}. ' +
            "headline: max 8 words, no period. text: 2-4 short sentences (max ~70 words), mention the leader, the title race, a standout player, and the latest result if present. " +
            "Energetic sports-broadcast tone, no emojis, no markdown.",
        },
        {
          role: "user",
          content: `Here is the current league data:\n${JSON.stringify(data)}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (parsed?.headline && parsed?.text) {
      return {
        headline: String(parsed.headline).slice(0, 120),
        text: String(parsed.text).slice(0, 600),
        generatedAt: Date.now(),
        basedOnFinished: ctx.totalFinished,
        ai: true,
      };
    }
  } catch (e) {
    console.warn(
      "[BSL SUMMARY] generation failed, using fallback:",
      (e as any)?.message,
    );
  }
  return fallbackSummary(ctx);
}

export async function getBslSummary(
  build: () => Promise<BslSummaryContext>,
): Promise<BslSummary> {
  const run = async (): Promise<BslSummary> => {
    try {
      const ctx = await build();
      const result = await regenerate(ctx);
      cache = result;
      dirty = false;
      return result;
    } finally {
      inflight = null;
    }
  };

  if (!cache) {
    if (!inflight) inflight = run();
    return inflight;
  }
  if (dirty && !inflight) {
    inflight = run();
    inflight.catch(() => {
      /* keep stale cache on failure */
    });
  }
  return cache;
}
