import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import * as Option from "effect/Option";

import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card, Field } from "../../components/card";
import { Screen } from "../../components/screen";
import { type NimbusUser, signIn } from "../../lib/fake-auth";
import { NEW_ONBOARDING_FLAG, PRO_PERK } from "../../lib/nimbus";
import { useNotes } from "../../lib/notes";
import { useTheme } from "../../lib/theme";
import { voidhash } from "../../lib/voidhash";

const FLAG_KEYS = [NEW_ONBOARDING_FLAG];

const formatDate = (value: string | null) =>
  value === null ? "never" : new Date(value).toLocaleDateString();

export default function AccountScreen() {
  const theme = useTheme();
  const notes = useNotes();
  const [user, setUser] = useState<NimbusUser | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: person, refetch: refetchPerson } = voidhash.useCurrentPerson();
  const { hasAccess: isPro, refetch: refetchAccess } = voidhash.useHasPerk(PRO_PERK);
  const {
    getVariant,
    isEnabled,
    isLoading: areFlagsLoading,
    refetch: refetchFlags,
  } = voidhash.useFeatureFlags(FLAG_KEYS);

  const plan = isPro ? "pro" : "free";
  const grants = person?.entitlements.grants ?? [];
  const variant = Option.getOrNull(getVariant(NEW_ONBOARDING_FLAG));
  const isFlagEnabled = isEnabled(NEW_ONBOARDING_FLAG);
  const inputStyle = [
    styles.input,
    { backgroundColor: theme.subtleBackground, borderColor: theme.border, color: theme.text },
  ];

  const handleSignIn = useCallback(async () => {
    if (email.trim().length === 0) {
      Alert.alert("Email required", "Enter an email to sign in with.");
      return;
    }

    setIsSigningIn(true);
    const displayName = name.length === 0 ? (email.split("@")[0] ?? "Nimbus user") : name;
    const signedIn = signIn(email, displayName);

    // `identify` moves the current anonymous person onto your user id. Anything
    // captured before this point is merged into the identified person.
    const identified = await voidhash.client.identify(signedIn.id, {
      email: signedIn.email,
      name: signedIn.name,
    });
    setIsSigningIn(false);

    if (identified.isErr()) {
      Alert.alert("Sign in failed", identified.error.message);
      return;
    }

    setUser(signedIn);
    await Promise.all([refetchPerson(), refetchAccess(), refetchFlags()]);
  }, [email, name, refetchAccess, refetchFlags, refetchPerson]);

  const handleSyncAttributes = useCallback(async () => {
    setIsSyncing(true);
    const updated = await voidhash.client.setPersonAttributes({
      notes_created: notes.length,
      plan,
    });
    // Attributes ride the analytics queue, so they arrive on the next batch
    // unless you ask for them now.
    const flushed = await voidhash.client.flush();
    setIsSyncing(false);

    if (updated.isErr()) {
      Alert.alert("Sync failed", updated.error.message);
      return;
    }
    if (flushed.isErr()) {
      Alert.alert("Sync failed", flushed.error.message);
      return;
    }

    await refetchPerson();
  }, [notes.length, plan, refetchPerson]);

  const handleSignOut = useCallback(async () => {
    // `reset()` drops to a fresh anonymous distinct id. `client.signOut()` does
    // the same after capturing the built-in `$sign_out` event.
    const result = await voidhash.client.reset();
    if (result.isErr()) {
      Alert.alert("Sign out failed", result.error.message);
      return;
    }

    setUser(null);
    setEmail("");
    setName("");
    await Promise.all([refetchPerson(), refetchAccess(), refetchFlags()]);
  }, [refetchAccess, refetchFlags, refetchPerson]);

  return (
    <Screen>
      {user === null ? (
        <Card
          subtitle={
            "Nimbus signs you in with its own user id. Voidhash only needs to know " +
            "which person is using the app."
          }
          title="Sign in"
        >
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.mutedText}
            style={inputStyle}
            value={email}
          />
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Your name (optional)"
            placeholderTextColor={theme.mutedText}
            style={inputStyle}
            value={name}
          />
          <Button
            loading={isSigningIn}
            onPress={() => {
              void handleSignIn();
            }}
            title="Sign in"
          />
        </Card>
      ) : (
        <Card subtitle={user.email} title={user.name}>
          <Field label="External user id" value={user.id} />
          <Button
            onPress={() => {
              void handleSignOut();
            }}
            title="Sign out"
            variant="secondary"
          />
        </Card>
      )}

      <Card
        subtitle="Attributes are your data on the person Voidhash already tracks."
        title="Person"
      >
        <Field label="Distinct id" value={person?.distinctId ?? "—"} />
        <Field label="Email" value={person?.email ?? "—"} />
        <Field label="Name" value={person?.name ?? "—"} />
        <Field label="plan" value={plan} />
        <Field label="notes_created" value={String(notes.length)} />
        <Button
          loading={isSyncing}
          onPress={() => {
            void handleSyncAttributes();
          }}
          title="Sync attributes"
          variant="secondary"
        />
      </Card>

      <Card
        subtitle="What this person is entitled to, straight from the person snapshot."
        title="Entitlements"
      >
        {grants.length === 0 ? (
          <Text style={[styles.hint, { color: theme.mutedText }]}>
            No active grants. Buy Pro on the Upgrade tab and this list fills in.
          </Text>
        ) : (
          grants.map((grant) => (
            <View
              key={`${grant.perkId}-${grant.sourceId ?? grant.sourcePersonId}`}
              style={styles.grant}
            >
              <View style={styles.grantHeader}>
                <Text style={[styles.grantPerk, { color: theme.text }]}>{grant.perkId}</Text>
                <Badge
                  label={grant.status}
                  tone={grant.status === "active" ? "positive" : "neutral"}
                />
              </View>
              <Text style={[styles.hint, { color: theme.mutedText }]}>
                {grant.source} · expires {formatDate(grant.expiresAt)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card
        subtitle="Flags are evaluated for the current person, so they follow identify and reset."
        title={NEW_ONBOARDING_FLAG}
      >
        {areFlagsLoading ? (
          <Badge label="Evaluating…" />
        ) : (
          <Badge
            label={isFlagEnabled ? "enabled" : "disabled"}
            tone={isFlagEnabled ? "positive" : "neutral"}
          />
        )}
        {variant === null
          ? null
          : Option.match(variant.variantKey, {
              onNone: () => null,
              onSome: (variantKey) => <Field label="Variant" value={variantKey} />,
            })}
        <Button
          onPress={() => {
            void refetchFlags();
          }}
          title="Re-evaluate"
          variant="secondary"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grant: {
    gap: 4,
  },
  grantHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  grantPerk: {
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
});
