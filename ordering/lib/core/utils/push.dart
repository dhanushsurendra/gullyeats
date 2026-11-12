import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';

/// New-order pushes, for when the app is in the background or closed (the
/// socket only reaches an open app). Android shows them itself on the
/// "new_orders" channel (MainActivity.kt); in the foreground they are not
/// shown, since the socket already rings. Every call swallows errors, so a
/// phone without Google services (or a test) just gets no pushes.
class Push {
  Push._();

  static StreamSubscription<String>? _registered;

  /// Asks for notification permission (Android 13+), registers with Firebase
  /// and sends this phone's installation ID to the server for the logged-in
  /// user (again whenever Firebase issues a new one). Safe on every start.
  static Future<void> register(String authToken) async {
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      await _registered?.cancel();
      _registered = messaging.onRegistered.listen((id) => _send(authToken, id));
      await messaging.register();
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }

  /// On logout: the ID stops working, so this phone gets no more pushes
  /// (the server drops it on its next send). The next login registers again.
  static Future<void> unregister() async {
    try {
      await _registered?.cancel();
      _registered = null;
      if (Firebase.apps.isNotEmpty) await FirebaseMessaging.instance.unregister();
    } catch (e) {
      debugPrint('Push logout failed: $e');
    }
  }

  static Future<void> _send(String authToken, String id) async {
    try {
      await http
          .post(
            Uri.parse('${ApiConstants.vendors}/push-id'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $authToken',
            },
            body: json.encode({'id': id}),
          )
          .timeout(const Duration(seconds: 10));
    } catch (e) {
      debugPrint('Push ID upload failed: $e');
    }
  }
}
