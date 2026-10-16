"""Apply the reproducible Yihu settings to a generated Capacitor Android project."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
android = root / 'android'
if not (android / 'app/build.gradle').exists():
    raise SystemExit('Run npx cap add android first.')
p = android / 'app/build.gradle'
s = p.read_text(encoding='utf-8')
s = re.sub(r'versionCode \d+', 'versionCode 8', s)
s = re.sub(r'versionName "[^"]+"', 'versionName "0.6.0"', s)
p.write_text(s, encoding='utf-8')
p = android / 'app/src/main/AndroidManifest.xml'
s = p.read_text(encoding='utf-8').replace('android:allowBackup="true"','android:allowBackup="false"')
s = s.replace('@mipmap/ic_launcher_round','@drawable/yihu_icon').replace('@mipmap/ic_launcher','@drawable/yihu_icon')
p.write_text(s, encoding='utf-8')
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
print('Configured Yihu Android 0.6.0, local assets, icon and no automatic backup.')
