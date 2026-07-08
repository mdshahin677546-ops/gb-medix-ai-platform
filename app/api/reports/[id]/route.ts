import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in before viewing reports." }, { status: 401 });
  }

  // Scope by both id and userId: a report id alone must never expose another user's report.
  const report = await prisma.aIReport.findFirst({
    where: { id: params.id, userId: user.id }
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json({ report });
}
