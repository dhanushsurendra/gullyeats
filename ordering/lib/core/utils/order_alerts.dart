import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:vibration/vibration.dart';

/// Sounds and vibration for order events: a "cha-ching" for a new order and
/// when paid, a soft ding when served. They follow the phone's ring mode like
/// any notification: sound and buzz when normal, buzz only on vibrate,
/// nothing on silent.
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

  static const _ringer = MethodChannel('gullyeats/ringer');

  /// What to play for the phone's ring mode (Android AudioManager: 0 silent,
  /// 1 vibrate, 2 normal).
  @visibleForTesting
  static ({bool sound, bool vibrate}) forRingerMode(int mode) =>
      (sound: mode >= 2, vibrate: mode >= 1);

  /// The phone's ring mode; normal when it can't be read (tests, iOS).
  static Future<({bool sound, bool vibrate})> _mode() async {
    try {
      return forRingerMode(await _ringer.invokeMethod<int>('ringerMode') ?? 2);
    } catch (_) {
      return forRingerMode(2);
    }
  }

  /// The same "cha-ching" as paid, with two buzzes, as a notification sound:
  /// heard at the phone's notification volume, never through silent mode.
  static Future<void> newOrder() async {
    final mode = await _mode();
    if (mode.sound) {
      await _guard(() async {
        final player = _ringPlayer ??= _newPlayer();
        await player.setAudioContext(
          AudioContext(
            android: const AudioContextAndroid(
              usageType: AndroidUsageType.notificationEvent,
              contentType: AndroidContentType.sonification,
              audioFocus: AndroidAudioFocus.gainTransientMayDuck,
            ),
          ),
        );
        // Restart, so orders arriving together don't pile up rings.
        await player.stop();
        await player.play(AssetSource('sounds/paid.wav'));
      });
    }
    if (mode.vibrate) {
      await _guard(() => Vibration.vibrate(pattern: [0, 400, 200, 400]));
    }
  }

  /// Order marked paid: "cha-ching" and a short double buzz.
  static Future<void> paid() => _tap('sounds/paid.wav', [0, 40, 80, 60]);

  /// Order served: a soft ding and one short buzz.
  static Future<void> served() => _tap('sounds/served.wav', [0, 50]);

  static Future<void> _tap(String sound, List<int> pattern) async {
    final mode = await _mode();
    if (mode.sound) {
      await _guard(() async {
        final player = _tapPlayer ??= _newPlayer();
        await player.stop();
        await player.play(AssetSource(sound));
      });
    }
    if (mode.vibrate) await _guard(() => Vibration.vibrate(pattern: pattern));
  }

  // No position updates: nothing reads them, and audioplayers' frame-based
  // updater kept scheduling frames after the sound ended, so the app redrew
  // every frame for as long as it stayed open (seen on a vivo I2219).
  static AudioPlayer _newPlayer() => AudioPlayer()..positionUpdater = null;

  static Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      debugPrint('Order alert failed: $e');
    }
  }
}
