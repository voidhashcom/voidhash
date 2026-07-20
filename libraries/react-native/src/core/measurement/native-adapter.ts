import { Measurement, Notifications } from "../../nitro";
import type { MeasurementCommand } from "../../specs/measurement/MeasurementTypes.nitro";
import type { PushPermissionStatus } from "./types";
import type { MeasurementRuntimeAdapter } from "./runtime";

const permissionStatuses = new Set<PushPermissionStatus>([
  "notDetermined",
  "denied",
  "authorized",
  "provisional",
  "ephemeral",
  "notRequired",
]);

const commandKind = (recordType: string): MeasurementCommand["kind"] => {
  if (recordType.startsWith("session.")) return "sessionSignal";
  if (recordType.startsWith("identity.")) return "identityTransition";
  if (recordType.startsWith("consent.")) return "consentTransition";
  if (recordType.startsWith("link.") || recordType.startsWith("referrer.")) return "linkInput";
  if (recordType.startsWith("push.")) return "pushInput";
  if (recordType.startsWith("purchase.")) return "purchaseInput";
  if (recordType.startsWith("identifier.")) return "identifierInput";
  return "enqueueRecord";
};

/** Creates the React Native bridge adapter used by the framework-independent coordinator. */
export const createNativeMeasurementRuntimeAdapter = (): MeasurementRuntimeAdapter => {
  let nativeWrites = Promise.resolve();
  return {
    isReleaseBuild: typeof __DEV__ === "boolean" ? !__DEV__ : true,
    initializeMeasurement: async (publishableKey, configuration) => {
      const state = await Measurement.initialize(publishableKey, {
        ...configuration,
        trustedConfigKeyIds: [...configuration.trustedConfigKeyIds],
      });
      return {
        installationId: state.installationId,
        firstOpenedAt: state.firstOpenedAt,
        installationSequence: state.installationSequence,
      };
    },
    enqueueMeasurement: (command) => {
      nativeWrites = nativeWrites.then(async () => {
        const result = await Measurement.enqueue({
          commandId: command.commandId,
          kind: commandKind(command.recordType),
          recordType: command.recordType,
          occurredAt: command.occurredAt,
          source: command.source,
          priority: command.priority,
          publicPayload: new TextEncoder().encode(JSON.stringify(command.envelope)).buffer,
          protectedEvidenceRef: command.protectedPayload,
          identity: command.identity,
          consent: command.consent,
          session: command.session,
        });
        if (!result.accepted) throw new Error(result.error?.code ?? "NATIVE_ENQUEUE_REJECTED");
      });
      return nativeWrites;
    },
    flushMeasurement: async () => {
      await nativeWrites;
      return Measurement.flush();
    },
    putProtectedEvidence: (input) => {
      let result = input.blobId;
      nativeWrites = nativeWrites.then(async () => {
        result = await Measurement.putProtectedEvidence({
          blobId: input.blobId,
          purpose: input.purpose,
          consentRevision: input.consentRevision,
          retentionClass: input.retentionClass,
          value: new Uint8Array(input.value).buffer,
        });
      });
      return nativeWrites.then(() => result);
    },
    deleteProtectedEvidence: (blobId) => {
      let deleted = false;
      nativeWrites = nativeWrites.then(async () => {
        deleted = await Measurement.deleteProtectedEvidence(blobId);
      });
      return nativeWrites.then(() => deleted);
    },
    deleteProtectedData: (requestId) => {
      let deleted = false;
      nativeWrites = nativeWrites.then(async () => {
        deleted = await Measurement.deleteProtectedData(requestId);
      });
      return nativeWrites.then(() => deleted);
    },
    getMeasurementConfigurationState: async () => {
      await nativeWrites;
      const state = await Measurement.getMeasurementConfigurationState();
      return {
        version: state.version,
        payload: state.payload ? new Uint8Array(state.payload) : undefined,
      };
    },
    persistMeasurementConfigurationState: (version, payload) => {
      let persisted = false;
      nativeWrites = nativeWrites.then(async () => {
        persisted = await Measurement.persistMeasurementConfigurationState(
          version,
          new Uint8Array(payload).buffer,
        );
      });
      return nativeWrites.then(() => persisted);
    },
    applyMeasurementConfiguration: async (version, payload) => {
      await nativeWrites;
      await Measurement.applyMeasurementConfiguration(
        version,
        new TextEncoder().encode(JSON.stringify(payload)).buffer,
      );
    },
    applyMeasurementStorageLimits: async (limits) => {
      await nativeWrites;
      await Measurement.applyMeasurementStorageLimits(
        limits.maxOutboxRecords,
        limits.maxOutboxBytes,
        limits.maxProtectedBytes,
      );
    },
    getPushRegistrationState: async () => {
      await nativeWrites;
      const state = await Measurement.getPushRegistrationState();
      return state.payload ? new Uint8Array(state.payload) : undefined;
    },
    persistPushRegistrationState: (payload) => {
      let persisted = false;
      nativeWrites = nativeWrites.then(async () => {
        persisted = await Measurement.persistPushRegistrationState(
          new Uint8Array(payload).buffer,
        );
      });
      return nativeWrites.then(() => persisted);
    },
    clearPushRegistrationState: () => {
      let cleared = false;
      nativeWrites = nativeWrites.then(async () => {
        cleared = await Measurement.clearPushRegistrationState();
      });
      return nativeWrites.then(() => cleared);
    },
    getTestDeviceState: async () => {
      await nativeWrites;
      return Measurement.getTestDeviceState();
    },
    persistTestDeviceState: async (enabled) => {
      await nativeWrites;
      return Measurement.persistTestDeviceState(enabled);
    },
    waitForPendingWrites: () => nativeWrites,
    hasDedupe: async (namespace, key) => {
      await nativeWrites;
      return Measurement.hasDedupe(namespace, key);
    },
    checkAndSetDedupe: async (namespace, key, expiresAtMs) => {
      await nativeWrites;
      return Measurement.checkAndSetDedupe(namespace, key, expiresAtMs);
    },
    getPermissionStatus: async () => {
      const status = await Notifications.getPermissionStatus();
      return permissionStatuses.has(status as PushPermissionStatus)
        ? (status as PushPermissionStatus)
        : "notDetermined";
    },
    requestPermission: async (options) => {
      const status = await Notifications.requestPermission(options?.provisional ?? false);
      return permissionStatuses.has(status as PushPermissionStatus)
        ? (status as PushPermissionStatus)
        : "notDetermined";
    },
    getPushToken: () => Notifications.getToken(),
    setBadgeCount: (count) => Notifications.setBadgeCount(count),
    subscribeNotificationEvents: (listener) => {
      const subscriptionId = `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      Notifications.subscribe(subscriptionId, listener);
      return () => Notifications.unsubscribe(subscriptionId);
    },
    subscribeNativeInbox: (listener) => {
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let draining = false;
      const schedule = (delay: number) => {
        if (!active) return;
        timer = setTimeout(() => void drain(), delay);
      };
      const drain = async () => {
        if (!active || draining) return;
        draining = true;
        try {
          await nativeWrites;
          while (active) {
            const entries = await Measurement.peekInbox(32);
            if (entries.length === 0) break;
            for (const entry of entries) {
              if (!active) break;
              const payload = await Measurement.readProtectedEvidence(entry.protectedEvidenceRef);
              await listener({
                id: entry.id,
                kind: entry.kind,
                source: entry.source,
                appState: entry.appState,
                receivedAt: entry.receivedAt,
                value: new TextDecoder().decode(payload),
                protectedEvidenceRef: entry.protectedEvidenceRef,
              });
              await Measurement.acknowledgeInbox(entry.id);
            }
            if (entries.length < 32) break;
          }
        } catch {
          // The entry remains unacknowledged and is retried on the next drain.
        } finally {
          draining = false;
          schedule(250);
        }
      };
      void drain();
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    },
  };
};
