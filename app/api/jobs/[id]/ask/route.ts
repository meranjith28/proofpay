import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser, accessTo } from "@/lib/auth";
import { askAboutJob } from "@/lib/agent";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const [job] = await sql`select client_email, freelancer_email, status from jobs where id = ${id}`;
  const access = job && user ? accessTo(job as never, user) : null;
  if (!access || !(access.isClient || access.isFreelancer)) {
    return NextResponse.json({ error: "Only the client and the freelancer on this job can ask about it." }, { status: 403 });
  }
  const { question } = await req.json();
  const q = String(question ?? "").trim().slice(0, 500);
  if (!q) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
  try {
    const answer = await askAboutJob(id, access.isClient ? "client" : "freelancer", q);
    return NextResponse.json({ answer });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The agent is busy right now. Try again in a minute." }, { status: 503 });
  }
}
