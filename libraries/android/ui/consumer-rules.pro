# The native library binds to these methods by class and method name.
-keepclasseswithmembernames class com.voidhash.ui.VoidhashUiNative {
    native <methods>;
}

# The views core binds to these methods by class and method name, and calls back into its text host.
-keepclasseswithmembernames class com.voidhash.ui.views.VoidhashViewsNative {
    native <methods>;
}
-keep class com.voidhash.ui.views.ViewsTextHost {
    long measureText(java.lang.String, java.lang.String, float, float, float, int, boolean, int, int, float, float);
    boolean registerFont(java.lang.String, byte[]);
}
