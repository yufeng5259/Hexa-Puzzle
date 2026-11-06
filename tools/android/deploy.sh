#!/usr/bin/env bash
# Debug build → APK → install on the connected device → launch. Usage: bash tools/android/deploy.sh [--no-creator]
# Uses build/android/cocos.compile.config.json (the editor's Android settings) with debug forced on.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CREATOR="/c/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe"
export JAVA_HOME="${JAVA_HOME_ANDROID:-/c/Program Files/Android/Android Studio/jbr}"
PKG=com.hexa.block.puzzlegame
CFG="$ROOT/../tmp/hexa-dev/android-build.json"
mkdir -p "$(dirname "$CFG")"
if [ "$1" != "--no-creator" ]; then
  node -e "const c=require(process.argv[1]);require('fs').writeFileSync(process.argv[2],JSON.stringify({...c,debug:true}))" "$ROOT/build/android/cocos.compile.config.json" "$CFG"
  env -u ELECTRON_RUN_AS_NODE "$CREATOR" --project "$ROOT" --build "configPath=$CFG" > "$ROOT/../tmp/hexa-dev/android-build.log" 2>&1 || true
  grep -q "build Task (android) Finished" "$ROOT/../tmp/hexa-dev/android-build.log" || { echo "Creator build failed, see tmp/hexa-dev/android-build.log"; exit 1; }
fi
cd "$ROOT/build/android/proj"
# The generated Gradle root name comes from the app name, whose ":" Gradle rejects.
sed -i 's/^rootProject.name = .*/rootProject.name = "HexaMosaic"/' settings.gradle
# Bypass the user-level Gradle proxy when it is not running.
./gradlew.bat :CocosGame:assembleDebug -q "-Dhttp.nonProxyHosts=*" "-Dhttps.nonProxyHosts=*"
adb install -r -t build/CocosGame/outputs/apk/debug/CocosGame-debug.apk | tail -1
adb shell input keyevent KEYCODE_WAKEUP
adb shell am force-stop $PKG
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
echo "launched"
