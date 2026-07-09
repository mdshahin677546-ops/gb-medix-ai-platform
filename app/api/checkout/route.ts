import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getCurrentUser, setSessionCookie } from "@/lib/auth";
import {
  PRODUCT_CONSULT_PACK,
  PRODUCT_PREMIUM_REPORT,
  RESOURCE_ASSESSMENT,
  checkEntitlement
} from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

const checkoutSchema = z.object({
  lang: z.string().default("en"),
  provider: z.enum(["stripe", "alipay"]).default("stripe"),
  product: z
    .enum(["body_reset_plan", "consult_pack", PRODUCT_PREMIUM_REPORT])
    .default(PRODUCT_PREMIUM_REPORT),
  assessmentId: z.string().optional(),
  email: z.string().email().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const { lang, provider, product, assessmentId, email } = checkoutSchema.parse(await request.json());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

  if (product === PRODUCT_PREMIUM_REPORT) {
    if (!user) {
      return NextResponse.json({ error: "Please sign in before unlocking a premium report." }, { status: 401 });
    }
    if (!assessmentId) {
      return NextResponse.json({ error: "Assessment id is required for premium report checkout." }, { status: 400 });
    }
    const assessment = await prisma.tCMRecord.findFirst({
      where: { id: assessmentId, userId: user.id }
    });
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    const alreadyUnlocked = await checkEntitlement({
      userId: user.id,
      productId: PRODUCT_PREMIUM_REPORT,
      resourceType: RESOURCE_ASSESSMENT,
      resourceId: assessment.id
    });
    if (alreadyUnlocked) {
      const report = await prisma.aIReport.findUnique({
        where: {
          userId_assessmentId_type: {
            userId: user.id,
            assessmentId: assessment.id,
            type: "premium_health_report"
          }
        }
      });
      return NextResponse.json({
        alreadyUnlocked: true,
        url: report ? `/${lang}/report/${report.id}` : `/${lang}/report/${assessment.id}`
      });
    }
  }

  const productConfig = getProductConfig(product, lang, appUrl, assessmentId);

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
        resourceType: product === PRODUCT_PREMIUM_REPORT ? RESOURCE_ASSESSMENT : null,
        resourceId: product === PRODUCT_PREMIUM_REPORT ? assessmentId : null,
        status: "created",
        amountCents: productConfig.amountCents,
        currency: productConfig.currency
      }
    });

    const response = NextResponse.json({ url: process.env.ALIPAY_CHECKOUT_URL });
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

  const payment = await prisma.paymentRecord.create({
    data: {
      userId: user?.id,
      provider: "stripe",
      product,
      resourceType: product === PRODUCT_PREMIUM_REPORT ? RESOURCE_ASSESSMENT : null,
      resourceId: product === PRODUCT_PREMIUM_REPORT ? assessmentId : null,
      status: "created",
      amountCents: productConfig.amountCents,
      currency: productConfig.currency
    }
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: productConfig.successPath,
    cancel_url: productConfig.cancelPath,
    customer_email: email || user?.email || undefined,
    metadata: {
      paymentId: payment.id,
      userId: user?.id || "",
      product,
      resourceType: product === PRODUCT_PREMIUM_REPORT ? RESOURCE_ASSESSMENT : "",
      resourceId: product === PRODUCT_PREMIUM_REPORT ? assessmentId || "" : ""
    },
    line_items: [
      {
        price_data: {
          currency: productConfig.currency,
          product_data: { name: productConfig.name },
          unit_amount: productConfig.amountCents
        },
        quantity: 1
      }
    ]
  });

  await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: {
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      status: session.payment_status || "created"
    }
  });

  const response = NextResponse.json({ url: session.url });
  if (user) setSessionCookie(response, user.id);
  return response;
}

function getProductConfig(
  product: string,
  lang: string,
  appUrl: string,
  assessmentId?: string
) {
  if (product === PRODUCT_CONSULT_PACK) {
    return {
      name: "Online Consultation Beta Pack",
      amountCents: 69,
      currency: "usd",
      successPath: `${appUrl}/${lang}/consult?paid=1`,
      cancelPath: `${appUrl}/${lang}/consult`
    };
  }

  if (product === PRODUCT_PREMIUM_REPORT) {
    return {
      name: "Premium AI Health Management Report",
      amountCents: 999,
      currency: "usd",
      successPath: `${appUrl}/${lang}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelPath: `${appUrl}/${lang}/checkout?assessmentId=${assessmentId || ""}`
    };
  }

  return {
    name: "Full 7-Day Body Reset Plan",
    amountCents: 999,
    currency: "usd",
    successPath: `${appUrl}/${lang}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelPath: `${appUrl}/${lang}/checkout`
  };
}
