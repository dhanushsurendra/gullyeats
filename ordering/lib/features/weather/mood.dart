import 'package:flutter/foundation.dart';
import 'package:ordering/features/weather/weather_service.dart';

/// Who is on the weather strip and in which outfit.
enum Mood {
  sunnyClear,
  sunnyCloudy,
  sunnyHot,
  sunnyRain,
  chillEvening,
  chillCool,
  chillRain,
  chillHeavyRain,
  sleeping,
}

enum Character { sunny, chill, both }

extension MoodCharacter on Mood {
  Character get character => switch (this) {
    Mood.sunnyClear ||
    Mood.sunnyCloudy ||
    Mood.sunnyHot ||
    Mood.sunnyRain => Character.sunny,
    Mood.sleeping => Character.both,
    _ => Character.chill,
  };
}

/// Debug builds only: `--dart-define=WEATHER_PREVIEW=chillHeavyRain` shows
/// that mood whatever the time or weather, to look at every state.
const _preview = String.fromEnvironment('WEATHER_PREVIEW');

/// Sunny from sunrise to sunset, Chill after (6 am / 6 pm without data).
/// Heavy rain brings Chill out by day too; weather sets the outfit; both
/// sleep once the cart is closed for the night.
///
/// A swap of character caused by weather (not by sunset or sunrise) waits
/// until a second weather update agrees, so a passing shower doesn't flip it.
class MoodPicker {
  Mood? _shown;
  Mood? _pending;
  DateTime? _pendingFrom;

  static const hotFrom = 32; // °C, day
  static const coolUpTo = 20; // °C, night

  static bool isNight(DateTime now, WeatherData? w) {
    if (w == null) return now.hour < 6 || now.hour >= 18;
    final sameDay =
        w.sunset.year == now.year &&
        w.sunset.month == now.month &&
        w.sunset.day == now.day;
    // Data from yesterday's forecast day: fall back to the clock.
    if (!sameDay) return now.hour < 6 || now.hour >= 18;
    return now.isBefore(w.sunrise) || !now.isBefore(w.sunset);
  }

  /// What the weather alone asks for, with no smoothing.
  static Mood raw(DateTime now, WeatherData? w, {required bool cartOpen}) {
    final night = isNight(now, w);
    if (night && !cartOpen) return Mood.sleeping;
    if (w != null && w.isHeavy) return Mood.chillHeavyRain;
    if (night) {
      if (w != null && w.isRainy) return Mood.chillRain;
      if (w != null && w.tempC <= coolUpTo) return Mood.chillCool;
      return Mood.chillEvening;
    }
    if (w == null) return Mood.sunnyCloudy;
    if (w.isRainy) return Mood.sunnyRain;
    if (w.tempC >= hotFrom) return Mood.sunnyHot;
    if (w.condition == 'clear') return Mood.sunnyClear;
    return Mood.sunnyCloudy;
  }

  Mood pick(DateTime now, WeatherData? weather, {required bool cartOpen}) {
    if (kDebugMode && _preview.isNotEmpty) {
      final forced = Mood.values.where((m) => m.name == _preview);
      if (forced.isNotEmpty) return forced.first;
    }
    final w =
        weather == null ||
            now.difference(weather.updatedAt) > WeatherData.staleAfter
        ? null
        : weather;
    final night = isNight(now, w);
    final next = raw(now, w, cartOpen: cartOpen);
    final shown = _shown;
    // A first pick, the same character, sunrise/sunset or sleep: right away.
    final weatherSwap =
        shown != null &&
        next.character != shown.character &&
        night == _shownAtNight &&
        next != Mood.sleeping &&
        shown != Mood.sleeping;
    if (weatherSwap) {
      final confirmed =
          _pending == next && w != null && w.updatedAt != _pendingFrom;
      if (!confirmed) {
        if (_pending != next) {
          _pending = next;
          _pendingFrom = w?.updatedAt;
        }
        return shown;
      }
    }
    _pending = null;
    _shownAtNight = night;
    return _shown = next;
  }

  bool _shownAtNight = false;
}
