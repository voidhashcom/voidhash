# The views core binds to these methods by class and method name, and calls back into its text host.
-keepclasseswithmembernames class com.voidhash.ui.ViewsNative {
    native <methods>;
}
-keep class com.voidhash.ui.ViewsTextHost {
    long measureText(java.lang.String, java.lang.String, float, float, float, int, boolean, int, int, float, float);
    boolean registerFont(java.lang.String, byte[]);
}

# The SDK finds the renderer through java.util.ServiceLoader, by the names in
# META-INF/services/com.voidhash.sdk.flows.FlowRenderer. R8 rewrites that file and the lookup
# itself; these rules keep the names and the constructor for other shrinkers and for an app that
# keeps the lookup.
-keepnames class com.voidhash.sdk.flows.FlowRenderer
-keep class com.voidhash.ui.FlowViewRenderer {
    public <init>();
}
