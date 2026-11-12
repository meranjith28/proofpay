import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { coachBrief } from "@/lib/ai";
import type { Category } from "@/lib/measure";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (user?.role !== "client") return NextResponse.json({ error: "Sign in as a client to use the brief coach." }, { status: 401 });
  const { title, brief, category } = await req.json();
  if (!brief || String(brief).trim().length < 15) {
    return NextResponse.json({ error: "Write a few sentences about what should be delivered first." }, { status: 400 });
  }
  try {
    return NextResponse.json(await coachBrief(String(title ?? ""), String(brief), (category ?? "writing") as Category));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The AI service is busy right now. Try again in a minute." }, { status: 503 });
  }
}
