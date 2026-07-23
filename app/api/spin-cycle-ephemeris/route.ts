import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  computePlanetRows,
  computeCrossAspects,
  formatAspectBlock,
  formatEphemerisBlock,
} from "@/lib/spin-cycle-ephemeris";
import { requireSpinCycleMember } from "@/lib/spin-cycle-access";

export const runtime = "nodejs";

const bodySchema = z.object({
  transitIso: z.string().min(1),
  birthIso: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const access = await requireSpinCycleMember(
    supabase,
    "Spin Cycle interactive ephemeris",
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "transitIso required (ISO 8601); birthIso optional" },
      { status: 400 },
    );
  }

  const transitDate = new Date(parsed.data.transitIso);
  if (Number.isNaN(transitDate.getTime())) {
    return NextResponse.json({ error: "transitIso is not a valid date" }, { status: 400 });
  }

  const transitRows = computePlanetRows(transitDate);
  const transitText = formatEphemerisBlock("Transit sky", transitDate, transitRows);

  let birthText: string | undefined;
  let birthRows: ReturnType<typeof computePlanetRows> | undefined;
  let aspectText: string | undefined;
  if (parsed.data.birthIso) {
    const birthDate = new Date(parsed.data.birthIso);
    if (Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: "birthIso is not a valid date" }, { status: 400 });
    }
    birthRows = computePlanetRows(birthDate);
    birthText = formatEphemerisBlock("Natal sky (same longitudes as birth moment)", birthDate, birthRows);
    const aspects = computeCrossAspects(transitRows, birthRows);
    aspectText = formatAspectBlock("Transit-to-natal major aspects", aspects);
  }

  return NextResponse.json({
    source: "astronomy-engine",
    licenseNote: "MIT Astronomy Engine — tropical geocentric longitudes; educational / synoptic use.",
    transit: { iso: transitDate.toISOString(), rows: transitRows, text: transitText },
    birth:
      birthRows && birthText
        ? { iso: new Date(parsed.data.birthIso!).toISOString(), rows: birthRows, text: birthText }
        : null,
    aspects: aspectText ? { text: aspectText } : null,
    /** Ready to paste into Spin Cycle notes */
    combinedText: birthText
      ? `${transitText}\n\n${birthText}${aspectText ? `\n\n${aspectText}` : ""}`
      : transitText,
  });
}
