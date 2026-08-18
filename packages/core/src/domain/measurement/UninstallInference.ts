export interface PushRegistrationEvidence {
  readonly environment: "development" | "production";
  readonly installationId: string;
  readonly personId?: string;
  readonly previousPushDeviceTokenId?: string;
  readonly pushDeviceTokenId: string;
  readonly registeredAt: string;
  readonly unregisteredAt?: string;
}

export interface PushDeliveryAttemptEvidence {
  readonly attemptId: string;
  readonly occurredAt: string;
  readonly provider: "apns" | "fcm";
  readonly providerInvalidAt?: string;
  readonly pushDeviceTokenId: string;
  readonly result: "success" | "unregistered" | "bad-token" | "invalid-argument" | "throttled" | "server-error";
}

export interface UninstallInferenceRecord {
  readonly confidence: "high" | "medium";
  readonly contributingAttemptIds: ReadonlyArray<string>;
  readonly environment: "development" | "production";
  readonly inferredAfter: string;
  readonly inferredBefore: string;
  readonly installationId: string;
  readonly personId?: string;
  readonly pushDeviceTokenId: string;
  readonly status: "active" | "superseded";
  readonly supersededAt?: string;
}

const time = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid push evidence timestamp: ${value}`);
  return parsed;
};

/** Derives deterministic uninstall windows from existing registration and delivery evidence. */
export const inferUninstalls = (
  registrations: ReadonlyArray<PushRegistrationEvidence>,
  attempts: ReadonlyArray<PushDeliveryAttemptEvidence>,
): ReadonlyArray<UninstallInferenceRecord> => {
  const registrationsByToken = new Map(registrations.map((registration) => [registration.pushDeviceTokenId, registration]));
  return attempts
    .filter(({ result }) => result === "unregistered" || result === "bad-token")
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.attemptId.localeCompare(right.attemptId))
    .flatMap((attempt) => {
      const registration = registrationsByToken.get(attempt.pushDeviceTokenId);
      if (!registration || registration.unregisteredAt) return [];
      const successorAtFailure = registrations.find((candidate) =>
        candidate.installationId === registration.installationId
          && candidate.pushDeviceTokenId !== registration.pushDeviceTokenId
          && time(candidate.registeredAt) <= time(attempt.occurredAt)
          && time(candidate.registeredAt) > time(registration.registeredAt),
      );
      if (successorAtFailure) return [];
      const invalidAt = attempt.providerInvalidAt ?? attempt.occurredAt;
      if (time(invalidAt) < time(registration.registeredAt)) return [];
      const successes = attempts.filter((candidate) =>
        candidate.pushDeviceTokenId === attempt.pushDeviceTokenId
          && candidate.result === "success"
          && time(candidate.occurredAt) <= time(attempt.occurredAt),
      );
      const lastSuccess = successes.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
      const laterRegistration = registrations.find((candidate) =>
        candidate.installationId === registration.installationId
          && time(candidate.registeredAt) > time(attempt.occurredAt),
      );
      return [{
        confidence: attempt.provider === "apns" && attempt.providerInvalidAt ? "high" : "medium",
        contributingAttemptIds: [attempt.attemptId],
        environment: registration.environment,
        inferredAfter: lastSuccess?.occurredAt ?? registration.registeredAt,
        inferredBefore: invalidAt,
        installationId: registration.installationId,
        personId: registration.personId,
        pushDeviceTokenId: registration.pushDeviceTokenId,
        status: laterRegistration ? "superseded" : "active",
        supersededAt: laterRegistration?.registeredAt,
      } satisfies UninstallInferenceRecord];
    })
    .filter((inference, index, all) =>
      all.findIndex((candidate) => candidate.pushDeviceTokenId === inference.pushDeviceTokenId) === index,
    );
};
