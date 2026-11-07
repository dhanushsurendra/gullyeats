import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:vibration/vibration.dart';

/// Sounds and vibration for order events: a "cha-ching" for a new order and
/// when paid, a soft ding when served.
///
/// Uses the vibration motor directly: Flutter's HapticFeedback follows the
/// phone's touch-feedback setting and is silent on many Android phones.
/// Every call swallows plugin errors, so a missing speaker or vibrator
/// never breaks an order action.
class OrderAlerts {
  OrderAlerts._();

  // Created on first use, so tests (which have no audio plugin) never
  // touch them.
  static AudioPlayer? _ringPlayer;
  static AudioPlayer? _tapPlayer;

  /// The same "cha-ching" as paid, with two buzzes. Plays as an alarm, so it
  /// is heard even with media volume down or the phone on silent.
  static Future<void> newOrder() async {
    await _guard(() async {
      final player = _ringPlayer ??= AudioPlayer();
      await player.setAudioContext(
        AudioContext(
          android: const AudioContextAndroid(
            usageType: AndroidUsageType.alarm,
            contentType: AndroidContentType.sonification,
            audioFocus: AndroidAudioFocus.gainTransientMayDuck,
          ),
        ),
      );
      // Restart, so orders arriving together don't pile up rings.
      await player.stop();
      await player.play(AssetSource('sounds/paid.wav'));
    });
    await _guard(() => Vibration.vibrate(pattern: [0, 400, 200, 400]));
  }

  /// Order marked paid: "cha-ching" and a short double buzz.
  static Future<void> paid() => _tap('sounds/paid.wav', [0, 40, 80, 60]);

  /// Order served: a soft ding and one short buzz.
  static Future<void> served() => _tap('sounds/served.wav', [0, 50]);

  static Future<void> _tap(String sound, List<int> pattern) async {
    await _guard(() async {
      final player = _tapPlayer ??= AudioPlayer();
      await player.stop();
      await player.play(AssetSource(sound));
    });
    await _guard(() => Vibration.vibrate(pattern: pattern));
  }

  static Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      debugPrint('Order alert failed: $e');
    }
  }
}
