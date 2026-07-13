// GB MEDIX AI Medical Roundtable — Batch 2.2B in-memory orchestration doubles.
//
// TEST / PROTOTYPE adapters only. None of these performs a real network call,
// touches a database, or runs a real AI provider. They are deterministic and
// single-process; they do NOT provide cross-process concurrency, a real cron,
// or a database unique constraint (see OrchestrationRunStore note in ./types).

import { CandidateTopic } from "../topic-policy";
import { EvidenceSource } from "../evidence";
import { EvidenceClaim } from "../claims";
import { AssetContentInput } from "../distribution";
import {
  ConsensusComposer,
  EvidenceService,
  ExpertAnalysis,
  ExpertPanel,
  OrchestrationRunStore,
  StoredRun,
  TopicSource,
  TransientProviderError,
  TranslationService,
} from "./types";

export class InMemoryTopicSource implements TopicSource {
  constructor(private readonly candidates: readonly CandidateTopic[]) {}
  fetchCandidates(): CandidateTopic[] {
    return this.candidates.map((c) => ({ ...c }));
  }
}

export interface ExpertPanelConfig {
  roles: string[];
  tokensPerRole?: number;
  /** Roles that fail (transient) while attempt <= expertFailUntilAttempt. */
  failRoles?: string[];
  failUntilAttempt?: number;
  /** Roles that fail PERMANENTLY (marked "failed", never complete). */
  permanentlyFailRoles?: string[];
}

export class InMemoryExpertPanel implements ExpertPanel {
  constructor(private readonly config: ExpertPanelConfig) {}
  roles(): string[] {
    return [...this.config.roles];
  }
  runIndependentAnalysis(role: string, attempt: number): ExpertAnalysis {
    const failUntil = this.config.failUntilAttempt ?? 0;
    if ((this.config.failRoles ?? []).includes(role) && attempt <= failUntil) {
      throw new TransientProviderError(`expert ${role} transient failure on attempt ${attempt}`);
    }
    if ((this.config.permanentlyFailRoles ?? []).includes(role)) {
      return { role, status: "failed", tokens: 0 };
    }
    return { role, status: "completed", tokens: this.config.tokensPerRole ?? 100 };
  }
}

export interface EvidenceServiceConfig {
  sources: EvidenceSource[];
  claims: EvidenceClaim[];
  failUntilAttempt?: number;
}

export class InMemoryEvidenceService implements EvidenceService {
  constructor(private readonly config: EvidenceServiceConfig) {}
  gather(_topicId: string, attempt: number): { sources: EvidenceSource[]; claims: EvidenceClaim[] } {
    if (attempt <= (this.config.failUntilAttempt ?? 0)) {
      throw new TransientProviderError(`evidence service transient failure on attempt ${attempt}`);
    }
    return {
      sources: this.config.sources.map((s) => ({ ...s })),
      claims: this.config.claims.map((c) => ({ ...c })),
    };
  }
}

/**
 * Returns a fixed AI draft-input object. Pass `attackFields` to simulate an AI
 * that tries to smuggle review/approval or forbidden clinical fields — the
 * coordinator hands the raw object to the real parseConsensusDraft, which
 * rejects it.
 */
export class InMemoryConsensusComposer implements ConsensusComposer {
  constructor(private readonly draft: Record<string, unknown>) {}
  compose(): unknown {
    return JSON.parse(JSON.stringify(this.draft));
  }
}

export interface TranslationConfig {
  byLanguage: Record<string, Omit<AssetContentInput, "language" | "translatedClaimIds">>;
}

export class InMemoryTranslationService implements TranslationService {
  constructor(private readonly config: TranslationConfig) {}
  translate(language: string, sourceClaimIds: string[]): AssetContentInput {
    const content = this.config.byLanguage[language];
    if (!content) {
      throw new Error(`no translation content configured for language ${language}`);
    }
    return { ...content, language, translatedClaimIds: [...sourceClaimIds] };
  }
}

/** Single-process in-memory run store (idempotency / recovery only). */
export class InMemoryOrchestrationRunStore implements OrchestrationRunStore {
  private readonly runs = new Map<string, StoredRun>();
  get(operationId: string): StoredRun | undefined {
    const r = this.runs.get(operationId);
    return r ? { ...r } : undefined;
  }
  put(record: StoredRun): void {
    this.runs.set(record.operationId, { ...record });
  }
}
