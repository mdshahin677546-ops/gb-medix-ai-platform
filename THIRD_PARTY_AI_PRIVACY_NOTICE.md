# GB Medix AI Third-Party AI Privacy Notice

Status: Operational notice draft for the minimum third-party AI processing consent gate.

## Third-Party AI Services

GB Medix AI may use third-party AI services to process health assessment information submitted by users. This processing is used to generate AI health management suggestions, wellness reports, lifestyle guidance, and TCM-inspired body pattern summaries.

In v1, explicit consent is required before using third-party AI providers:

- DeepSeek
- Qwen
- Kimi
- GLM
- Doubao

OpenAI is temporarily not gated in v1 to avoid interrupting the current production flow. A future release should consider one unified AI processing consent standard for all AI providers.

## AI Request Routing And Relay (AIHubMix)

Third-party AI requests may be sent through an AI gateway/relay service (AIHubMix), which routes each request to the selected underlying model (for example DeepSeek). The relay acts as a processing intermediary in the request path. The same data-minimization rules below apply before any request leaves GB Medix, whether the model is reached directly or through the relay.

## Data Types Processed

The AI provider may process:

- health assessment questionnaire answers;
- sleep, fatigue, diet, stress, activity, and digestion pattern inputs;
- user-submitted lifestyle notes;
- optional uploaded context summaries;
- current language;
- report type;
- desensitized health context required to generate a report.

## Data Minimization

GB Medix AI is designed to avoid sending the following fields to AI providers:

- email;
- user ID;
- payment ID;
- Stripe session ID;
- entitlement ID;
- IP address;
- auth session data;
- raw database records;
- internal notes;
- admin fields;
- secrets or API keys.

## Processing Purpose

Third-party AI processing is used only to support:

- AI health assessment;
- free health result generation;
- Premium AI health report generation;
- lifestyle guidance;
- health management recommendations.

## Withdrawal Of Consent

Users can revoke consent from the user dashboard. After consent is revoked, third-party AI providers cannot be used again for that user until the user accepts the notice again.

Revocation does not delete historical reports automatically. It prevents future third-party AI processing unless consent is accepted again.

## Non-Medical Disclaimer

GB Medix AI provides health management guidance and lifestyle education. It does not provide medical diagnosis, treatment, prescriptions, disease probability, or clinical triage. Users should consult licensed clinicians for medical decisions or urgent health concerns.

## Current V1 Boundary

This notice supports the minimum consent gate required before enabling third-party providers in production. It is not a complete privacy center or legal policy rewrite.
