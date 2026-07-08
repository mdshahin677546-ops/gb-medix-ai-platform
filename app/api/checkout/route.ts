import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const checkoutSchema = z.object({
  lang: z.string().default("en"),
  provider: z.enum(["stripe", "alipay"]).default("stripe"),
  product: z.enum(["body_reset_plan", "consult_pack"]).default("body_reset_plan"),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const { lang, provider, product, email } = checkoutSchema.parse(await request.json());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const productConfig =
    product === "consult_pack"
      ? {
          name: "Online Consultation Beta Pack",
          amountCents: 69,
          currency: "usd",
          successPath: `${appUrl}/${lang}/consult?paid=1`
        }
      : {
          name: "Full 7-Day Body Reset Plan",
          amountCents: 999,
          currency: "usd",
          successPath: `${appUrl}/${lang}/success?session_id={CHECKOUT_SESSION_ID}`
        };
  const currentUser = await getCurrentUser();
  const user =
    currentUser ||
    (email
      ? await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email }
        })
      : null);

  if (provider === "alipay") {
    if (!process.env.ALIPAY_CHECKOUT_URL) {
      return NextResponse.json(
        { error: "Alipay checkout is not configured." },
        { status: 503 }
      );
    }

    await prisma.paymentRecord.create({
      data: {
        userId: user?.id,
        provider: "alipay",
        product,
        status: "created",
        amountCents: productConfig.amountCents,
        currency: productConfig.currency
      }
    });

    const response = NextResponse.json({
      url: process.env.ALIPAY_CHECKOUT_URL
    });
    if (user) setSessionCookie(response, user.id);
    return response;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured." },
      { status: 503 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia"
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: productConfig.successPath,
    cancel_url:
      product === "consult_pack"
        ? `${appUrl}/${lang}/consult`
        : `${appUrl}/${lang}/checkout`,
    customer_email: email || undefined,
    metadata: {
      userId: user?.id || "",
      product
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: productConfig.name
          },
          unit_amount: productConfig.amountCents
        },
        quantity: 1
      }
    ]
  });

  await prisma.paymentRecord.create({
    data: {
      userId: user?.id,
      provider: "stripe",
      product,
      sessionId: session.id,
      status: session.payment_status || "created",
      amountCents: productConfig.amountCents,
      currency: productConfig.currency
    }
  });

  const response = NextResponse.json({ url: session.url });
  if (user) setSessionCookie(response, user.id);
  return response;
}
