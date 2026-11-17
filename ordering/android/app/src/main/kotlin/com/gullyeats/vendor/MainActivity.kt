package com.gullyeats.vendor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            // New-order pushes (backend utils/push.js): heads-up with the
            // in-app "cha-ching", as a notification sound, so the phone's
            // silent / vibrate mode applies like any other app. Android keeps
            // a channel's first settings, hence the new id; the old
            // "new_orders" channel rang as an alarm through silent mode.
            manager.deleteNotificationChannel("new_orders")
            val channel = NotificationChannel(
                "new_orders_v2",
                "New orders",
                NotificationManager.IMPORTANCE_HIGH,
            )
            channel.setSound(
                Uri.parse("android.resource://$packageName/${R.raw.paid}"),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            channel.enableVibration(true)
            channel.vibrationPattern = longArrayOf(0, 400, 200, 400)
            manager.createNotificationChannel(channel)
            // Platform-fee reminders (backend utils/feeReminders.js): the
            // phone's normal notification sound.
            manager.createNotificationChannel(
                NotificationChannel("fees", "Platform fee reminders", NotificationManager.IMPORTANCE_HIGH),
            )
            // Area alerts from nearby carts (backend areaAlertController.js).
            manager.createNotificationChannel(
                NotificationChannel("area_alerts", "Area alerts", NotificationManager.IMPORTANCE_HIGH),
            )
            // Heavy rain or a storm forecast at the cart (backend rainAlerts.js).
            manager.createNotificationChannel(
                NotificationChannel("weather", "Weather alerts", NotificationManager.IMPORTANCE_HIGH),
            )
        }
    }

    // The phone's ring mode for in-app order sounds (OrderAlerts):
    // 0 silent, 1 vibrate, 2 normal.
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "gullyeats/ringer")
            .setMethodCallHandler { call, result ->
                if (call.method == "ringerMode") {
                    val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                    result.success(audio.ringerMode)
                } else {
                    result.notImplemented()
                }
            }
    }

    // Opening the app shows every order and the fee banner, so its pushes in
    // the tray are spent: clear them all, not just the one that was tapped.
    override fun onResume() {
        super.onResume()
        getSystemService(NotificationManager::class.java).cancelAll()
    }
}
