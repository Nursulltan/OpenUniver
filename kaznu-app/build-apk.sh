set -e
export JAVA_HOME="$(cygpath -w ~/android-build/jdk)"
export ANDROID_HOME="$(cygpath -w ~/android-build/sdk)"
cd "$(dirname "$0")"
node build-web.mjs
npx cap sync android
cd android
./gradlew.bat assembleDebug --no-daemon --console=plain
