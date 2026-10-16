package cn.yihu.xiyang.demo;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class YihuMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL = "yihu_messages";
    @Override public void onNewToken(String token) { getSharedPreferences("yihu_push", MODE_PRIVATE).edit().putString("token", token).apply(); }
    @Override public void onMessageReceived(RemoteMessage message) {
        String route = safeRoute(message.getData().get("route")); String body = message.getData().get("body"); if (body == null || body.length() > 40) body = "您有一条新的消息";
        getSharedPreferences("yihu_push", MODE_PRIVATE).edit().putString("route", route).apply();
        NotificationManager manager = (NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) { NotificationChannel channel = new NotificationChannel(CHANNEL, "守护与咨询消息", NotificationManager.IMPORTANCE_HIGH); channel.setDescription("家庭求助和人工咨询的概括提醒"); channel.enableLights(true); channel.setLightColor(Color.rgb(37,78,67)); manager.createNotificationChannel(channel); }
        Intent intent = new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("route", route);
        PendingIntent pending = PendingIntent.getActivity(this, route.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.drawable.yihu_icon).setContentTitle("益护夕阳").setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pending).setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_MESSAGE).setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        manager.notify((int)(System.currentTimeMillis() & 0x7fffffff), notification.build());
    }
    private String safeRoute(String route) { if (route == null) return "home"; if (route.equals("family") || route.equals("consultations") || route.equals("volunteer") || route.matches("ticket/[a-f0-9-]{36}")) return route; return "home"; }
}
