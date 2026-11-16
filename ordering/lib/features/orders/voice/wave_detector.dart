/// Turns the proximity sensor's near/far events into "a hand waved over the
/// phone": near, then clear again within [maxCover]. A phone laid face-down
/// or slipped into a pocket stays near for longer and never counts, and
/// waves closer together than [cooldown] count once.
class WaveDetector {
  final Duration maxCover;
  final Duration cooldown;

  WaveDetector({
    this.maxCover = const Duration(milliseconds: 1500),
    this.cooldown = const Duration(seconds: 2),
  });

  DateTime? _nearAt;
  DateTime? _lastWave;

  /// Feeds one sensor reading; true when it completes a wave.
  bool add({required bool near, required DateTime at}) {
    if (near) {
      _nearAt ??= at;
      return false;
    }
    final since = _nearAt;
    _nearAt = null;
    if (since == null || at.difference(since) > maxCover) return false;
    if (_lastWave != null && at.difference(_lastWave!) < cooldown) return false;
    _lastWave = at;
    return true;
  }
}
