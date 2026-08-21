import type { ConformanceSuite } from "../types";
import type {
  RecordedExchange,
  ScenarioStep,
  ScriptedResponse,
  SessionReport,
  Violation,
} from "../types";
import { matchRequest, type ActualRequest } from "./verify";

interface SessionRecord {
  readonly id: string;
  readonly suite: ConformanceSuite;
  nextStepIndex: number;
  currentResponseIndex: number;
  exchanges: Array<RecordedExchange>;
  completed: boolean;
  report: SessionReport | null;
}

export type CreateSessionResult =
  | { readonly ok: true; readonly sessionId: string }
  | { readonly ok: false; readonly reason: "unknown-suite" | "active-session-exists" };

export type RecordRequestResult =
  | { readonly ok: true; readonly response: ScriptedResponse }
  | { readonly ok: false; readonly status: number; readonly message: string };

/**
 * In-memory session store backing the harness server. One active session at a
 * time keeps strict-order matching deterministic across concurrent runners.
 */
export class HarnessStore {
  private readonly suites: ReadonlyArray<ConformanceSuite>;
  private readonly sessions: Map<string, SessionRecord> = new Map();
  private nextSessionNumber = 1;

  constructor(suites: ReadonlyArray<ConformanceSuite>) {
    this.suites = suites;
  }
  listSuites(): ReadonlyArray<ConformanceSuite> {
    return this.suites;
  }

  getSuite(name: string): ConformanceSuite | undefined {
    return this.suites.find((suite) => suite.name === name);
  }

  private activeSession(): SessionRecord | null {
    for (const session of this.sessions.values()) {
      if (!session.completed) return session;
    }
    return null;
  }

  createSession(suiteName: string): CreateSessionResult {
    const suite = this.getSuite(suiteName);
    if (suite === undefined) {
      return { ok: false, reason: "unknown-suite" };
    }

    const active = this.activeSession();
    if (active !== null) {
      return { ok: false, reason: "active-session-exists" };
    }

    const id = `session_${this.nextSessionNumber++}`;
    this.sessions.set(id, {
      id,
      suite,
      nextStepIndex: 0,
      currentResponseIndex: 0,
      exchanges: [],
      completed: false,
      report: null,
    });
    return { ok: true, sessionId: id };
  }

  getSessionSteps(sessionId: string): ReadonlyArray<ScenarioStep> | undefined {
    return this.sessions.get(sessionId)?.suite.steps;
  }

  /**
   * Matches an observed request against the current expected step, records the
   * exchange (including all violations found), and returns the scripted
   * response the SDK should receive.
   */
  recordRequest(
    sessionId: string,
    actual: ActualRequest,
  ): RecordRequestResult {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return { ok: false, status: 404, message: `unknown session ${sessionId}` };
    }
    if (session.completed) {
      return { ok: false, status: 409, message: "session already completed" };
    }

    const steps = session.suite.steps;
    let violations: ReadonlyArray<Violation>;
    let stepId: string | null;

    const currentStep: ScenarioStep | undefined = steps.at(session.nextStepIndex);
    if (currentStep === undefined) {
      stepId = null;
      violations = [
        {
          kind: "unexpected-request",
          detail: `${actual.method} ${actual.path}: suite "${session.suite.name}" has no remaining steps`,
        },
      ];
    } else {
      stepId = currentStep.id;
      violations = matchRequest(currentStep, actual);
    }

    let response: ScriptedResponse;
    if (currentStep !== undefined && currentStep.responses.length > 0) {
      const responseIndex = Math.min(
        session.currentResponseIndex,
        currentStep.responses.length - 1,
      );
      const scripted = currentStep.responses[responseIndex];
      if (scripted === undefined) {
        return { ok: false, status: 500, message: `step ${currentStep.id} has no responses` };
      }
      response = scripted;
      session.currentResponseIndex += 1;
      if (session.currentResponseIndex >= currentStep.responses.length) {
        session.nextStepIndex += 1;
        session.currentResponseIndex = 0;
      }
    } else {
      response = { status: 500, body: { _tag: "HarnessUnexpectedRequest" } };
    }

    session.exchanges.push({
      index: session.exchanges.length,
      stepId,
      method: actual.method,
      path: actual.path,
      matched: violations.length === 0,
      violations,
    });

    return { ok: true, response };
  }

  completeSession(sessionId: string): SessionReport | null {
    const session = this.sessions.get(sessionId);
    if (session === undefined) return null;

    if (!session.completed) {
      const violations: Array<Violation> = [];
      const firstUnconsumed = Math.min(session.nextStepIndex, session.suite.steps.length);
      for (let index = firstUnconsumed; index < session.suite.steps.length; index++) {
        const step = session.suite.steps[index];
        if (step === undefined) continue;
        if (index === session.nextStepIndex && session.currentResponseIndex > 0) {
          violations.push({
            kind: "missing-step",
            stepId: `${step.id} (retry sequence incomplete: ${step.responses.length - session.currentResponseIndex} response(s) never consumed)`,
          });
        } else {
          violations.push({ kind: "missing-step", stepId: step.id });
        }
      }

      for (const exchange of session.exchanges) {
        violations.push(...exchange.violations);
      }

      session.report = {
        pass: violations.length === 0,
        suite: session.suite.name,
        totalSteps: session.suite.steps.length,
        executedExchanges: session.exchanges.length,
        exchanges: session.exchanges,
        violations,
      };
      session.completed = true;
    }

    return session.report;
  }
}
