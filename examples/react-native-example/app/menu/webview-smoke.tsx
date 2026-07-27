import {
  PaywallWebView,
  type PaywallWebViewImperativeRef,
  parsePaywallBridgeEnvelope,
} from "../../../../libraries/react-native/src/internal";
import { useRef } from "react";
import { Button, View } from "react-native";

const html = `
<!DOCTYPE html>
<html>
  <body style="background:black;color:white;font-family:-apple-system;padding:24px;">
    <h1>Paywall WebView Smoke</h1>
    <button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({version:1,type:'ready'}))">
      Send ready()
    </button>
  </body>
</html>
`;

export default function WebViewSmokeScreen() {
  const ref = useRef<PaywallWebViewImperativeRef>(null);

  return (
    <View style={{ flex: 1, paddingTop: 32 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16 }}>
        <Button onPress={() => ref.current?.reload()} title="Reload" />
        <Button
          onPress={() =>
            ref.current?.injectJavaScript(
              "window.ReactNativeWebView.postMessage(JSON.stringify({version:1,type:'log',payload:{level:'info',message:'inject ok'}}));",
            )
          }
          title="Inject"
        />
      </View>
      <PaywallWebView
        ref={ref}
        onMessage={(event: any) => {
          parsePaywallBridgeEnvelope(event.nativeEvent.data);
        }}
        originWhitelist={["https://*", "http://*"]}
        source={{
          baseUrl: "https://voidhash.com",
          html,
        }}
        startInLoadingState
      />
    </View>
  );
}
