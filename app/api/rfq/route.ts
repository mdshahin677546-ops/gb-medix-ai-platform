import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const rfqSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  email: z.string().email(),
  country: z.string().min(1),
  productInterest: z.string().min(1),
  quantity: z.coerce.number().positive()
});

export async function POST(request: Request) {
  const input = rfqSchema.parse(await request.json());
  await ensureDatabase();

  const record = await prisma.tCMRecord.create({
    data: {
      input: JSON.stringify({ kind: "rfq", ...input }),
      result: JSON.stringify({ status: "submitted" })
    }
  });

  return NextResponse.json({ id: record.id, ok: true });
}
