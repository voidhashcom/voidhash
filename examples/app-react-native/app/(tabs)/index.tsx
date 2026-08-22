import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { EVENTS, FREE_NOTE_LIMIT, ONBOARDING_LOCATION, PRO_PERK } from "../../lib/nimbus";
import { addNote, useNotes } from "../../lib/notes";
import { describePaywallOutcome } from "../../lib/paywall-outcome";
import { useTheme } from "../../lib/theme";
import { voidhash } from "../../lib/voidhash";

export default function NotesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const notes = useNotes();
  const [pendingAction, setPendingAction] = useState<"create" | "export" | null>(null);

  const {
    error: perkError,
    hasAccess: isPro,
    isLoading: isCheckingAccess,
    isStale,
    refetch: refetchAccess,
  } = voidhash.useHasPerk(PRO_PERK);

  const { show } = voidhash.usePaywallByLocation(ONBOARDING_LOCATION, {
    onError: (error, context) => {
      Alert.alert("Something went wrong", `The ${context.action} failed: ${error.message}`);
    },
    onPreloadError: (error) => {
      console.warn("[nimbus] the onboarding paywall failed to preload", error);
    },
    onPurchase: () => {
      void refetchAccess();
    },
    onRestore: () => {
      void refetchAccess();
    },
  });

  /**
   * Presents the hosted paywall, or the app's own Upgrade screen when it can't
   * be shown. `show()` never rejects — it reports why through its status — so
   * there is no `try`/`catch` here, only a decision.
   */
  const presentUpgrade = useCallback(async () => {
    const result = await show();

    const outcome = describePaywallOutcome(result);
    if (!outcome.fallback) {
      voidhash.client.capture(EVENTS.paywallViewed, {
        location: ONBOARDING_LOCATION,
        presentation: "hosted",
      });
      return;
    }

    router.navigate({ params: { reason: outcome.reason }, pathname: "/upgrade" });
  }, [router, show]);

  const handleCreateNote = useCallback(async () => {
    if (!isPro && notes.length >= FREE_NOTE_LIMIT) {
      setPendingAction("create");
      await presentUpgrade();
      setPendingAction(null);
      return;
    }

    const nextNotes = addNote();
    voidhash.client.capture(EVENTS.noteCreated, {
      note_count: nextNotes.length,
      plan: isPro ? "pro" : "free",
    });

    const attributes = await voidhash.client.setPersonAttributes({
      notes_created: nextNotes.length,
    });
    if (attributes.isErr()) {
      console.warn("[nimbus] could not update notes_created", attributes.error.code);
    }
  }, [isPro, notes.length, presentUpgrade]);

  const handleExport = useCallback(async () => {
    voidhash.client.capture(EVENTS.exportRequested, { note_count: notes.length });

    if (isPro) {
      Alert.alert("Export ready", `${notes.length} notes exported as Markdown.`);
      return;
    }

    setPendingAction("export");
    await presentUpgrade();
    setPendingAction(null);
  }, [isPro, notes.length, presentUpgrade]);

  const remaining = Math.max(0, FREE_NOTE_LIMIT - notes.length);
  const quota = isPro
    ? "Unlimited notes and export."
    : `${remaining} of ${FREE_NOTE_LIMIT} notes left.`;

  return (
    <Screen>
      <Card subtitle={quota} title={isPro ? "Nimbus Pro" : "Nimbus Free"}>
        <View style={styles.badges}>
          {isCheckingAccess ? (
            <Badge label="Checking access…" />
          ) : (
            <Badge label={isPro ? "pro" : "free"} tone={isPro ? "positive" : "neutral"} />
          )}
          {isStale ? <Badge label="Offline — last known access" tone="warning" /> : null}
        </View>
        {perkError !== null && !isStale ? (
          <Text style={[styles.note, { color: theme.mutedText }]}>
            Your access could not be refreshed, so free limits apply for now.
          </Text>
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          disabled={pendingAction !== null}
          loading={pendingAction === "create"}
          onPress={() => {
            void handleCreateNote();
          }}
          title="New note"
        />
        <Button
          disabled={pendingAction !== null}
          loading={pendingAction === "export"}
          onPress={() => {
            void handleExport();
          }}
          title={isPro ? "Export notes" : "Export notes (Pro)"}
          variant="secondary"
        />
      </View>

      <Card title="Your notes">
        {notes.map((note, index) => (
          <View
            key={note.id}
            style={[
              styles.noteRow,
              index === 0
                ? null
                : {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    paddingTop: 12,
                  },
            ]}
          >
            <Text style={[styles.noteTitle, { color: theme.text }]}>{note.title}</Text>
            <Text style={[styles.note, { color: theme.mutedText }]}>{note.body}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteRow: {
    gap: 4,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
});
