import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { currentUser, accessTo } from "@/lib/auth";

/** Screenshots the agent took of a website submission. Only the job's client and freelancer can see them. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const view = req.nextUrl.searchParams.get("view") === "mobile" ? "mobile" : "desktop";
  const user = await currentUser();
  const [row] = await sql`
    select s.shot_desktop, s.shot_mobile, j.client_email, j.freelancer_email, j.status
    from submissions s join jobs j on j.id = s.job_id where s.id = ${Number(sid)}`;
  const access = row && user ? accessTo(row as never, user) : null;
  if (!access || !(access.isClient || access.isFreelancer)) return new NextResponse("Not found", { status: 404 });
  const img = view === "mobile" ? row.shot_mobile : row.shot_desktop;
  if (!img) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(img), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
