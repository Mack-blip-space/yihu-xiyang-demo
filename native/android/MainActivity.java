package cn.yihu.xiyang.demo;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) { registerPlugin(YihuPushPlugin.class); super.onCreate(savedInstanceState); rememberRoute(getIntent()); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); rememberRoute(intent); }
    private void rememberRoute(Intent intent) { if (intent == null) return; String route = intent.getStringExtra("route"); if (route != null) getSharedPreferences("yihu_push", MODE_PRIVATE).edit().putString("route", route).apply(); }
}
