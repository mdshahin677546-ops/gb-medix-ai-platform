import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureDatabase } from "@/lib/db";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { lang = "en" } = await request.json().catch(() => ({ lang: "en" }));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await ensureDatabase();

  if (!process.env.STRIPE_SECRET_KEY) {
    await prisma.paymentRecord.create({
      data: { status: "demo_without_stripe_key" }
    });

    return NextResponse.json({
      url: `${appUrl}/${lang}/success?demo=1`
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appUrl}/${lang}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/${lang}/checkout`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Full 7-Day Body Reset Plan"
          },
          unit_amount: 999
        },
        quantity: 1
      }
    ]
  });

  await prisma.paymentRecord.create({
    data: { status: session.payment_status || "created" }
  });

  return NextResponse.json({ url: session.url });
}
