package com.gullyeats.vendor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // New-order pushes (backend utils/push.js) use this channel: heads-up,
        // the in-app "cha-ching", played as an alarm like OrderAlerts.newOrder
        // so it rings with the phone on silent. Android keeps a channel's
        // first settings, so changing these needs a new channel id.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("new_orders", "New orders", NotificationManager.IMPORTANCE_HIGH)
            channel.setSound(
                Uri.parse("android.resource://$packageName/${R.raw.paid}"),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build(),
            )
            channel.enableVibration(true)
            channel.vibrationPattern = longArrayOf(0, 400, 200, 400)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
            // Platform-fee reminders (backend utils/feeReminders.js): the
            // phone's normal notification sound, not the alarm.
            manager.createNotificationChannel(
                NotificationChannel("fees", "Platform fee reminders", NotificationManager.IMPORTANCE_HIGH),
            )
            // Area alerts from nearby carts (backend areaAlertController.js).
            manager.createNotificationChannel(
                NotificationChannel("area_alerts", "Area alerts", NotificationManager.IMPORTANCE_HIGH),
            )
        }
    }

    // Opening the app shows every order and the fee banner, so its pushes in
    // the tray are spent: clear them all, not just the one that was tapped.
    override fun onResume() {
        super.onResume()
        getSystemService(NotificationManager::class.java).cancelAll()
    }
}
