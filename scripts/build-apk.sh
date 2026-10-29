#!/bin/bash
# Użycie: scripts/build-apk.sh [lint|typecheck|test|build]  (domyślnie build)
set -euo pipefail
cd "$(dirname "$0")/.."
STEP="${1:-build}"
APP_ID="pl.friendpump.app"
VERSION="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' app/src/main/AndroidManifest.xml | head -1)"
TASK_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
TASK_JAVA="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
TOOLS="$TASK_SDK/build-tools/35.0.0"
PLATFORM="$TASK_SDK/platforms/android-35/android.jar"
export JAVA_HOME="$TASK_JAVA"
export PATH="$TASK_JAVA/bin:$PATH"
for executable in "$TOOLS/aapt2" "$TOOLS/d8" "$TOOLS/zipalign" "$TOOLS/apksigner" "$TOOLS/aapt" "$TASK_JAVA/bin/javac"; do
    if [ ! -x "$executable" ]; then echo "Missing tool: $executable" >&2; exit 1; fi
done
if [ ! -f "$PLATFORM" ]; then echo "Missing platform: $PLATFORM" >&2; exit 1; fi

rm -rf build/generated build/classes build/dex
mkdir -p build/generated build/classes build/dex signing dist

# lint: zasoby i manifest muszą się skompilować i zlinkować
"$TOOLS/aapt2" compile --dir app/src/main/res -o build/resources.zip
sed "s/<manifest /<manifest package=\"$APP_ID\" /" app/src/main/AndroidManifest.xml > build/AndroidManifest.xml
"$TOOLS/aapt2" link -o build/resources.apk -I "$PLATFORM" --manifest build/AndroidManifest.xml --java build/generated build/resources.zip
[ "$STEP" = lint ] && { echo "lint PASS"; exit 0; }

# typecheck: kod Java kompiluje się bez ostrzeżeń
find app/src/main/java build/generated -name '*.java' > build/sources.txt
"$TASK_JAVA/bin/javac" -Xlint:all,-options -Werror -encoding UTF-8 -source 8 -target 8 -bootclasspath "$PLATFORM:$TOOLS/core-lambda-stubs.jar" -d build/classes @build/sources.txt
[ -n "$(find build/classes -name '*.class' | head -1)" ] || { echo "Brak klas po kompilacji" >&2; exit 1; }
[ "$STEP" = typecheck ] && { echo "typecheck PASS"; exit 0; }

# dex, podpis, APK
find build/classes -name '*.class' > build/classes.txt
"$TOOLS/d8" --lib "$PLATFORM" --min-api 26 --output build/dex @build/classes.txt
cp build/resources.apk build/unsigned.apk
(cd build/dex && zip -q -j ../unsigned.apk classes*.dex)
"$TOOLS/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
if [ ! -f signing/local.keystore ]; then
    umask 077
    "$TASK_JAVA/bin/keytool" -genkeypair -keystore signing/local.keystore -storepass local-friendpump -keypass local-friendpump -alias friendpump -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=FriendPump Local, O=FriendPump, C=PL"
fi
APK="dist/FriendPump-$VERSION.apk"
"$TOOLS/apksigner" sign --ks signing/local.keystore --ks-key-alias friendpump --ks-pass pass:local-friendpump --key-pass pass:local-friendpump --out "$APK" build/aligned.apk
"$TOOLS/apksigner" verify "$APK"
"$TOOLS/aapt" dump badging "$APK" > "dist/apk-info-$VERSION.txt"

# test: APK ma oczekiwany pakiet, minSdk i launcher
grep -q "package: name='$APP_ID'" "dist/apk-info-$VERSION.txt" || { echo "Zły package w APK" >&2; exit 1; }
grep -q "sdkVersion:'26'" "dist/apk-info-$VERSION.txt" || { echo "Zły minSdk w APK" >&2; exit 1; }
grep -q "uses-permission: name='android.permission.INTERNET'" "dist/apk-info-$VERSION.txt" || { echo "Brak uprawnienia INTERNET w APK" >&2; exit 1; }
grep -q "launchable-activity: name='$APP_ID.MainActivity'" "dist/apk-info-$VERSION.txt" || { echo "Brak launchera w APK" >&2; exit 1; }
mkdir -p build/tests
"$TASK_JAVA/bin/javac" -encoding UTF-8 -d build/tests app/src/main/java/pl/friendpump/app/Secret.java tests/SecretTest.java
"$TASK_JAVA/bin/java" -cp build/tests pl.friendpump.app.SecretTest
[ "$STEP" = test ] && { echo "test PASS"; exit 0; }

shasum -a 256 "$APK" > "dist/SHA256SUMS-$VERSION"
echo "APK: $APK"
