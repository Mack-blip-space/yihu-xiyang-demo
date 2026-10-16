package cn.yihu.xiyang.demo;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "YihuPush", permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})})
public class YihuPushPlugin extends Plugin {
    private static final String STORE = "yihu_push";
    @PluginMethod public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) { JSObject result = new JSObject(); result.put("granted", true); call.resolve(result); return; }
        requestPermissionForAlias("notifications", call, "permissionResult");
    }
    @PermissionCallback private void permissionResult(PluginCall call) { JSObject result = new JSObject(); result.put("granted", getPermissionState("notifications") == PermissionState.GRANTED); call.resolve(result); }
    @PluginMethod public void register(PluginCall call) {
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) { call.reject("未能连接 Firebase 通知服务"); return; }
            getContext().getSharedPreferences(STORE, Context.MODE_PRIVATE).edit().putString("token", task.getResult()).apply();
            JSObject result = new JSObject(); result.put("token", task.getResult()); call.resolve(result);
        });
    }
    @PluginMethod public void consumeRoute(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(STORE, Context.MODE_PRIVATE); String route = prefs.getString("route", ""); prefs.edit().remove("route").apply();
        JSObject result = new JSObject(); result.put("route", route); call.resolve(result);
    }
}
