// Android debug APK without opening the Creator editor window:
//   1. Creator command-line build (exports build/android: assets, scripts, gradle project)
//   2. fix the generated gradle root project name (the app name may contain ':' which Gradle rejects)
//   3. gradle :CocosGame:assembleDebug
//   4. optional: adb install -r and launch on the connected device
// Usage: node tools/v2/build-apk.mjs [--skip-export] [--install]
// Machine paths come from env (defaults are this team's PC): COCOS_CREATOR_ROOT, ANDROID_SDK, ANDROID_NDK, JAVA_HOME.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PROJECT, creatorRoot } from './env.mjs';

const SDK = process.env.ANDROID_SDK ?? 'D:\\android\\Sdk';
const NDK = process.env.ANDROID_NDK ?? path.join(SDK, 'ndk', '25.2.9519653');
const JAVA = process.env.JAVA_HOME ?? 'C:\\Program Files\\Android\\Android Studio\\jbr';
const PROJ = path.join(PROJECT, 'build/android/proj');
const APK = path.join(PROJ, 'build/CocosGame/outputs/apk/debug/CocosGame-debug.apk');
const PACKAGE = 'com.hexa.block.puzzlegame';
const args = new Set(process.argv.slice(2));

function run(cmd, argv, options = {}) {
    const started = Date.now();
    const result = spawnSync(cmd, argv, { stdio: 'inherit', windowsHide: true, ...options });
    if (result.error) throw result.error;
    console.log(`[build-apk] ${path.basename(cmd)} exit ${result.status} in ${Math.round((Date.now() - started) / 1000)}s`);
    return result.status;
}

/** Build options in the Creator build-panel format; keeps the package/keystore settings of the last panel build. */
function buildConfig() {
    const last = path.join(PROJECT, 'build/android/cocos.compile.config.json');
    const prev = fs.existsSync(last) ? JSON.parse(fs.readFileSync(last, 'utf8')) : { packages: {} };
    const config = {
        platform: 'android', buildPath: 'project://build', outputName: 'android', name: prev.name ?? 'HexaPuzzle', debug: true,
        md5Cache: false, sourceMaps: false, useSplashScreen: false, packAutoAtlas: true, skipCompressTexture: false,
        mainBundleCompressionType: 'merge_dep', mainBundleIsRemote: false, nativeCodeBundleMode: 'wasm',
        startScene: '18d4953b-98af-4367-aed2-67c183a3faaf', scenes: [{ url: 'db://assets/scenes/Main.scene', uuid: '18d4953b-98af-4367-aed2-67c183a3faaf' }],
        packages: {
            android: { packageName: PACKAGE, orientation: { portrait: true, upsideDown: false, landscapeLeft: false, landscapeRight: false }, apiLevel: 36,
                appABIs: ['arm64-v8a'], useDebugKeystore: true, renderBackEnd: { vulkan: false, gles3: true, gles2: true },
                ...prev.packages.android, sdkPath: SDK, ndkPath: NDK },
            ...(prev.packages.native ? { native: prev.packages.native } : {}),
        },
    };
    const file = path.join(PROJECT, 'temp/build-apk.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(config, null, 2));
    return file;
}

if (!args.has('--skip-export')) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE; // set inside VS Code terminals; makes Creator start as plain node
    const code = run(path.join(creatorRoot(), 'CocosCreator.exe'), ['--project', PROJECT, '--build', `configPath=${buildConfig()}`], { env });
    if (code !== 36) throw new Error(`Creator build failed (exit ${code}; 36 means success)`); // Creator's documented success code
}

const settings = path.join(PROJ, 'settings.gradle');
const text = fs.readFileSync(settings, 'utf8');
fs.writeFileSync(settings, text.replace(/rootProject\.name\s*=\s*".*"/, 'rootProject.name = "HexaPuzzle"'));

const gradle = run(path.join(PROJ, 'gradlew.bat'), [':CocosGame:assembleDebug', '--console=plain'], { cwd: PROJ, shell: true, env: { ...process.env, JAVA_HOME: JAVA } });
if (gradle !== 0) throw new Error('gradle assembleDebug failed');
console.log(`[build-apk] ${APK} (${Math.round(fs.statSync(APK).size / 1048576)} MB)`);

if (args.has('--install')) {
    const adb = path.join(SDK, 'platform-tools', 'adb.exe');
    if (run(adb, ['install', '-r', APK]) !== 0) throw new Error('adb install failed');
    run(adb, ['shell', 'am', 'force-stop', PACKAGE]);
    run(adb, ['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1']);
}
