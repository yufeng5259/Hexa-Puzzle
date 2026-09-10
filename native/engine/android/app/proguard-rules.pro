# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in E:\developSoftware\Android\SDK/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Proguard Cocos2d-x-lite for release
-keep public class com.cocos.** { *; }
-dontwarn com.cocos.**


# Proguard Android Webivew for release. you can comment if you are not using a webview
-keep public class android.net.http.SslError
-keep public class android.webkit.WebViewClient

# SDK libraries supply their own consumer rules. Only these game JNI entry points
# are addressed by name from JavaScript.
-keep class com.world.hexapuzzle.yzad.ADCenter {
    public static void initAd(java.lang.String);
    public static void prepareVideo(java.lang.String);
    public static void showVideo(java.lang.String);
    public static java.lang.String isVideoPrepared(java.lang.String);
}
-keep class com.world.hexapuzzle.SDKHandleClass {
    public static void getRewardReceipts(java.lang.String);
    public static void acknowledgeReward(java.lang.String);
    public static void getPresentationState(java.lang.String);
    public static void getPrivacyOptionsRequired(java.lang.String);
    public static void showPrivacyOptions(java.lang.String);
}

-dontwarn android.webkit.WebView
-dontwarn android.net.http.SslError
-dontwarn android.webkit.WebViewClient

# This is generated automatically by the Android Gradle plugin.
-dontwarn android.hardware.BatteryState
-dontwarn android.hardware.lights.Light
-dontwarn android.hardware.lights.LightState$Builder
-dontwarn android.hardware.lights.LightState
-dontwarn android.hardware.lights.LightsManager$LightsSession
-dontwarn android.hardware.lights.LightsManager
-dontwarn android.hardware.lights.LightsRequest$Builder
-dontwarn android.hardware.lights.LightsRequest
-dontwarn android.net.ssl.SSLSockets
-dontwarn android.os.VibratorManager
