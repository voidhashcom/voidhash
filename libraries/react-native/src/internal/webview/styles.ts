import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    backgroundColor: "transparent",
    flex: 1,
  },
  loadingOrErrorView: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  errorTextTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    marginHorizontal: 16,
    textAlign: "center",
  },
});
