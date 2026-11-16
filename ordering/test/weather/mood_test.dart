import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ordering/features/weather/mood.dart';
import 'package:ordering/features/weather/weather_service.dart';

final day = DateTime(2026, 11, 16);
DateTime at(int h, [int m = 0]) => day.add(Duration(hours: h, minutes: m));

WeatherData weather({
  String condition = 'cloudy',
  int temp = 26,
  int sunsetH = 17,
  int sunsetM = 52,
  DateTime? updated,
}) => WeatherData(
  tempC: temp,
  feelsC: temp,
  humidity: 60,
  windKph: 10,
  condition: condition,
  rainChance: 0,
  sunrise: at(6, 16),
  sunset: at(sunsetH, sunsetM),
  hourly: const [],
  heavyRainAt: null,
  updatedAt: updated ?? at(12),
);

Mood raw(DateTime now, WeatherData? w, {bool open = true}) =>
    MoodPicker.raw(now, w, cartOpen: open);

void main() {
  group('who is on', () {
    test('Sunny from sunrise to sunset, Chill after: not a fixed 6 pm', () {
      final w = weather(sunsetH: 17, sunsetM: 52);
      expect(raw(at(17, 51), w).character, Character.sunny);
      expect(raw(at(17, 52), w).character, Character.chill);
      expect(raw(at(6, 15), w).character, Character.chill);
      expect(raw(at(6, 16), w).character, Character.sunny);
      // A summer sunset later in the evening.
      expect(raw(at(18, 30), weather(sunsetH: 18, sunsetM: 45)).character, Character.sunny);
    });

    test('without weather it falls back to 6 am and 6 pm', () {
      expect(raw(at(17, 59), null).character, Character.sunny);
      expect(raw(at(18), null).character, Character.chill);
      expect(raw(at(5, 59), null).character, Character.chill);
    });

    test('heavy rain or a storm brings Chill out by day', () {
      expect(raw(at(11), weather(condition: 'heavy_rain')), Mood.chillHeavyRain);
      expect(raw(at(11), weather(condition: 'storm')), Mood.chillHeavyRain);
      expect(raw(at(11), weather(condition: 'rain')), Mood.sunnyRain);
    });

    test('weather picks the outfit', () {
      expect(raw(at(11), weather(condition: 'clear')), Mood.sunnyClear);
      expect(raw(at(11), weather(condition: 'clear', temp: 33)), Mood.sunnyHot);
      expect(raw(at(11), weather(condition: 'fog')), Mood.sunnyCloudy);
      expect(raw(at(20), weather(condition: 'drizzle')), Mood.chillRain);
      expect(raw(at(20), weather(temp: 19)), Mood.chillCool);
      expect(raw(at(20), weather(temp: 24)), Mood.chillEvening);
    });

    test('both sleep once the cart is closed for the night, not by day', () {
      expect(raw(at(21), weather(), open: false), Mood.sleeping);
      expect(raw(at(14), weather(), open: false), Mood.sunnyCloudy);
    });
  });

  group('smoothing', () {
    test('a weather swap waits for a second update; sunset does not', () {
      final p = MoodPicker();
      expect(p.pick(at(11), weather(updated: at(11)), cartOpen: true), Mood.sunnyCloudy);
      // Heavy rain in one update: Sunny stays for now.
      expect(p.pick(at(11, 5), weather(condition: 'heavy_rain', updated: at(11)), cartOpen: true), Mood.sunnyCloudy);
      // The next update agrees: Chill comes out.
      expect(p.pick(at(11, 30), weather(condition: 'heavy_rain', updated: at(11, 30)), cartOpen: true), Mood.chillHeavyRain);
      // The rain stops for one update only: Chill stays.
      expect(p.pick(at(12), weather(updated: at(12)), cartOpen: true), Mood.chillHeavyRain);
      expect(p.pick(at(12, 30), weather(condition: 'heavy_rain', updated: at(12, 30)), cartOpen: true), Mood.chillHeavyRain);

      final q = MoodPicker();
      q.pick(at(17, 50), weather(updated: at(17, 30)), cartOpen: true);
      expect(q.pick(at(17, 53), weather(updated: at(17, 30)), cartOpen: true), Mood.chillEvening);
    });

    test('an outfit change within the same character is immediate', () {
      final p = MoodPicker();
      p.pick(at(11), weather(updated: at(11)), cartOpen: true);
      expect(p.pick(at(11, 30), weather(condition: 'rain', updated: at(11, 30)), cartOpen: true), Mood.sunnyRain);
    });

    test('stale weather is ignored, never shown as current', () {
      final p = MoodPicker();
      final old = weather(condition: 'heavy_rain', updated: at(8));
      withClock(Clock.fixed(at(11)), () {
        expect(old.isStale, isTrue);
        expect(p.pick(at(11), old, cartOpen: true), Mood.sunnyCloudy);
      });
    });
  });

  group('WeatherService', () {
    setUp(WeatherService.reset);

    Map<String, dynamic> json() => {
      'tempC': 26.4,
      'feelsC': 27,
      'humidity': 62,
      'windKph': 11,
      'condition': 'rain',
      'rainChance': 40,
      'sunrise': '2026-11-16T00:46:00.000Z',
      'sunset': '2026-11-16T12:22:00.000Z',
      'hourly': [
        {'at': '2026-11-16T06:30:00.000Z', 'tempC': 26, 'rainChance': 40, 'condition': 'rain'},
      ],
      'heavyRainAt': null,
      'updatedAt': '2026-11-16T06:20:00.000Z',
    };

    test('loads once per cart within 25 min, and again for another cart', () async {
      var calls = 0;
      final client = MockClient((r) async {
        calls++;
        expect(r.headers['Authorization'], 'Bearer t');
        return http.Response(jsonEncode({'data': json()}), 200);
      });
      final now = DateTime.utc(2026, 11, 16, 6, 30);
      await withClock(Clock.fixed(now), () => http.runWithClient(() async {
        await WeatherService.refresh('t', 'c1');
        await WeatherService.refresh('t', 'c1');
        expect(calls, 1);
        expect(WeatherService.current.value!.tempC, 26);
        expect(WeatherService.current.value!.isRainy, isTrue);
        await WeatherService.refresh('t', 'c2');
        expect(calls, 2);
      }, () => client));
    });

    test('no data from the server, or a failure, shows nothing new', () async {
      await http.runWithClient(() async {
        await WeatherService.refresh('t', 'c1');
        expect(WeatherService.current.value, isNull);
      }, () => MockClient((_) async => http.Response(jsonEncode({'data': null}), 200)));

      WeatherService.reset();
      await http.runWithClient(() async {
        await WeatherService.refresh('t', 'c1');
        expect(WeatherService.current.value, isNull);
      }, () => MockClient((_) async => throw http.ClientException('offline')));
    });
  });
}
