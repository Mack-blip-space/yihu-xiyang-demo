"""Apply the reproducible Yihu settings to a generated Capacitor Android project."""
from pathlib import Path
import re
import shutil

root = Path(__file__).resolve().parents[1]
android = root / 'android'
if not (android / 'app/build.gradle').exists():
    raise SystemExit('Run npx cap add android first.')
p = android / 'app/build.gradle'
s = p.read_text(encoding='utf-8')
s = re.sub(r'versionCode \d+', 'versionCode 12', s)
s = re.sub(r'versionName "[^"]+"', 'versionName "0.9.1"', s)
if 'firebase-messaging' not in s:
    s = s.replace("    implementation project(':capacitor-android')", "    implementation project(':capacitor-android')\n    implementation platform('com.google.firebase:firebase-bom:35.0.2')\n    implementation 'com.google.firebase:firebase-messaging'")
p.write_text(s, encoding='utf-8')
p = android / 'app/src/main/AndroidManifest.xml'
s = p.read_text(encoding='utf-8').replace('android:allowBackup="true"','android:allowBackup="false"')
s = s.replace('@mipmap/ic_launcher_round','@drawable/yihu_icon').replace('@mipmap/ic_launcher','@drawable/yihu_icon')
if 'android.permission.POST_NOTIFICATIONS' not in s:
    s = s.replace('<manifest xmlns:android="http://schemas.android.com/apk/res/android">', '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />')
if '.YihuMessagingService' not in s:
    s = s.replace('        <activity\n', '        <service android:name=".YihuMessagingService" android:exported="false">\n            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>\n        </service>\n\n        <activity\n', 1)
p.write_text(s, encoding='utf-8')
java = android / 'app/src/main/java/cn/yihu/xiyang/demo'
java.mkdir(parents=True, exist_ok=True)
for name in ('MainActivity.java', 'YihuPushPlugin.java', 'YihuMessagingService.java'):
    shutil.copyfile(root / 'native/android' / name, java / name)
firebase = root / 'native/android/google-services.json'
if not firebase.exists():
    raise SystemExit('Missing native/android/google-services.json; register the Firebase Android app before building.')
shutil.copyfile(firebase, android / 'app/google-services.json')
res = android / 'app/src/main/res'
(res / 'drawable/yihu_icon.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#254e43" android:pathData="M0,0h108v108h-108z"/>
  <path android:strokeColor="#f6d79e" android:strokeWidth="4" android:strokeLineCap="round" android:fillColor="@android:color/transparent" android:pathData="M30,65a24,24 0,0 1,48 0M25,74h58M54,25v9M27,39l7,6M81,39l-7,6"/>
</vector>''', encoding='utf-8')
(res / 'values/styles.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="colorPrimary">#254e43</item><item name="colorAccent">#254e43</item>
    <item name="android:windowLightStatusBar">true</item>
    <item name="android:statusBarColor">#fbfaf4</item>
    <item name="android:navigationBarColor">#fbfaf4</item>
  </style>
  <style name="AppTheme.NoActionBar" parent="AppTheme">
    <item name="windowActionBar">false</item><item name="windowNoTitle">true</item>
    <item name="android:background">@null</item>
  </style>
  <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#fbfaf4</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/yihu_icon</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
  </style>
</resources>''', encoding='utf-8')
print('Configured Yihu Android 0.9.1, local assets, icon and no automatic backup.')
