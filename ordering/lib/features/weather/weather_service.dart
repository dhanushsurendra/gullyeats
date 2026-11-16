import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';

/// One hour of the forecast.
class HourWeather {
  final DateTime at;
  final int tempC;
  /// Forecast rain in that hour, in mm.
  final double rainMm;
  final String condition;

  const HourWeather({
    required this.at,
    required this.tempC,
    required this.rainMm,
    required this.condition,
  });

  factory HourWeather.fromJson(Map<String, dynamic> j) => HourWeather(
    at: DateTime.parse(j['at'] as String).toLocal(),
    tempC: (j['tempC'] as num).round(),
    rainMm: (j['rainMm'] as num? ?? 0).toDouble(),
    condition: j['condition'] as String,
  );
}

/// The forecast at the cart (backend utils/weather.js). [condition] is one of
/// clear, cloudy, fog, drizzle, rain, heavy_rain, storm. Forecast data only,
/// never an official warning.
class WeatherData {
  final int tempC;
  final int feelsC;
  final int humidity;
  final int windKph;
  final String condition;
  /// Forecast rain in that hour, in mm.
  final double rainMm;
  final DateTime sunrise;
  final DateTime sunset;
  final List<HourWeather> hourly;

  /// The first hour within the next 3 with heavy rain or a storm, if any.
  final DateTime? heavyRainAt;
  final DateTime updatedAt;

  const WeatherData({
    required this.tempC,
    required this.feelsC,
    required this.humidity,
    required this.windKph,
    required this.condition,
    required this.rainMm,
    required this.sunrise,
    required this.sunset,
    required this.hourly,
    required this.heavyRainAt,
    required this.updatedAt,
  });

  factory WeatherData.fromJson(Map<String, dynamic> j) => WeatherData(
    tempC: (j['tempC'] as num).round(),
    feelsC: (j['feelsC'] as num).round(),
    humidity: (j['humidity'] as num).round(),
    windKph: (j['windKph'] as num).round(),
    condition: j['condition'] as String,
    rainMm: (j['rainMm'] as num? ?? 0).toDouble(),
    sunrise: DateTime.parse(j['sunrise'] as String).toLocal(),
    sunset: DateTime.parse(j['sunset'] as String).toLocal(),
    hourly: [
      for (final h in j['hourly'] as List)
        HourWeather.fromJson(h as Map<String, dynamic>),
    ],
    heavyRainAt: j['heavyRainAt'] == null
        ? null
        : DateTime.parse(j['heavyRainAt'] as String).toLocal(),
    updatedAt: DateTime.parse(j['updatedAt'] as String).toLocal(),
  );

  /// Older than this is not shown as current weather.
  static const staleAfter = Duration(hours: 2);
  bool get isStale => clock.now().difference(updatedAt) > staleAfter;

  bool get isRainy => condition == 'rain' || condition == 'drizzle';
  bool get isHeavy => condition == 'heavy_rain' || condition == 'storm';
}

/// The selected cart's weather, shared by the Orders strip and its sheet.
/// The server refreshes the city every 30 min, so asking more often is pointless.
class WeatherService {
  WeatherService._();

  static final current = ValueNotifier<WeatherData?>(null);
  static String? _cartId;
  static DateTime? _askedAt;
  static const _every = Duration(minutes: 25);

  /// Loads the cart's weather unless it was loaded for it in the last 25 min.
  /// A failure keeps what was there (the strip hides it once it's stale).
  static Future<void> refresh(String token, String cartId) async {
    final now = clock.now();
    if (cartId == _cartId &&
        _askedAt != null &&
        now.difference(_askedAt!) < _every) {
      return;
    }
    if (cartId != _cartId) current.value = null;
    _cartId = cartId;
    _askedAt = now;
    try {
      final res = await http
          .get(
            Uri.parse('${ApiConstants.carts}/weather/$cartId'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return;
      final data = jsonDecode(res.body)['data'];
      if (cartId != _cartId) return; // another cart was picked meanwhile
      current.value = data == null
          ? null
          : WeatherData.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      _askedAt = null; // try again on the next tick
      debugPrint('Weather failed: $e');
    }
  }

  @visibleForTesting
  static void reset() {
    current.value = null;
    _cartId = null;
    _askedAt = null;
  }
}
