import { Button } from "components/button";
import { Schema, SchemaGetter, SchemaTransformation } from "effect";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voidhash } from "utils/voidhash/client";

const IndentedJson = Schema.Unknown.pipe(
  Schema.encodeTo(
    Schema.String,
    new SchemaTransformation.Transformation<unknown, string>(
      SchemaGetter.parseJson(),
      SchemaGetter.stringifyJson({ space: 2 }),
    ),
  ),
);

const encodeIndentedJson = Schema.encodeSync(IndentedJson);

/** Renders any debug value as indented JSON text; absent values render as nothing. */
const formatJson = (value: unknown): string => {
  if (value === undefined) return "";
  return encodeIndentedJson(value);
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { client } = voidhash.useVoidhash();
  const {
    data: person,
    isLoading: isPersonLoading,
    error: personError,
  } = voidhash.useCurrentPerson();

  if (isPersonLoading) {
    return null;
  }

  const containerStyle = [
    styles.container,
    {
      paddingBottom: Math.max(16, insets.bottom + 16),
      paddingTop: Math.max(32, insets.top + 16),
    },
  ];

  // If no active subscription, show the paywall
  return (
    <View style={containerStyle}>
      <View>
        <Text style={styles.title}>Person</Text>
        <Text style={styles.jsonText}>{formatJson(person)}</Text>
        <Text style={styles.jsonText}>{formatJson(personError)}</Text>

        {Platform.OS === "ios" && (
          <View style={styles.actions}>
            <Button
              onPress={() => client.iosPresentCodeRedemptionSheet()}
              style={styles.outlineButton}
              title="Present code redemption sheet"
            />
            <Button
              onPress={() => client.iosShowManageSubscriptions()}
              style={styles.outlineButton}
              title="Show manage subscriptions"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  jsonText: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  actions: {
    gap: 16,
    marginTop: 16,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderColor: "#3f3f46",
    borderWidth: 1,
  },
});
