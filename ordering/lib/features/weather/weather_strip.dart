import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/weather/characters.dart';
import 'package:ordering/features/weather/mood.dart';
import 'package:ordering/features/weather/weather_service.dart';
import 'package:ordering/features/weather/weather_sheet.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

/// The sky behind a mood: an illustration, the same in light and dark theme.
List<Color> moodSky(Mood m) => switch (m) {
  Mood.sunnyClear => const [Color(0xFF8FD3FF), Color(0xFFDDF3FF)],
  Mood.sunnyHot => const [Color(0xFFFFC46B), Color(0xFFFFE9C2)],
  Mood.sunnyCloudy => const [Color(0xFFA9C7E3), Color(0xFFE3EEF8)],
  Mood.sunnyRain => const [Color(0xFF8DA4BF), Color(0xFFD3DEEA)],
  Mood.chillHeavyRain => const [Color(0xFF34435E), Color(0xFF55657F)],
  Mood.sleeping => const [Color(0xFF0B1230), Color(0xFF1E2350)],
  _ => const [Color(0xFF1A0F45), Color(0xFF2E3A7A)],
};

bool moodIsDark(Mood m) => m.character != Character.sunny;

String conditionLabel(AppLocalizations l10n, String c) => switch (c) {
  'clear' => l10n.weatherCondClear,
  'fog' => l10n.weatherCondFog,
  'drizzle' => l10n.weatherCondDrizzle,
  'rain' => l10n.weatherCondRain,
  'heavy_rain' => l10n.weatherCondHeavyRain,
  'storm' => l10n.weatherCondStorm,
  _ => l10n.weatherCondCloudy,
};

IconData conditionIcon(String c, {bool night = false}) => switch (c) {
  'clear' => night ? Icons.nightlight_round : Icons.wb_sunny_rounded,
  'fog' => Icons.blur_on_rounded,
  'drizzle' || 'rain' => Icons.water_drop_rounded,
  'heavy_rain' => Icons.umbrella_rounded,
  'storm' => Icons.thunderstorm_rounded,
  _ => Icons.cloud_rounded,
};

/// What the character says: a heavy-rain heads-up first (a forecast), else a
/// line for the mood.
String moodMessage(BuildContext context, Mood m, WeatherData w) {
  final l10n = context.l10n;
  final heavy = w.heavyRainAt;
  if (heavy != null && m != Mood.sleeping && !w.isHeavy) {
    final locale = Localizations.localeOf(context).languageCode;
    return l10n.weatherHeavySoon(DateFormat.jm(locale).format(heavy));
  }
  return switch (m) {
    Mood.sunnyClear => l10n.weatherMsgClear,
    Mood.sunnyCloudy => l10n.weatherMsgCloudy,
    Mood.sunnyHot => l10n.weatherMsgHot,
    Mood.sunnyRain => l10n.weatherMsgRainDay,
    Mood.chillEvening => l10n.weatherMsgEvening,
    Mood.chillCool => l10n.weatherMsgCool,
    Mood.chillRain => l10n.weatherMsgRainNight,
    Mood.chillHeavyRain => l10n.weatherMsgHeavy,
    Mood.sleeping => l10n.weatherMsgSleeping,
  };
}

/// Sunny or Chill on a slim card on Orders: temperature, sky and one line.
/// Tapping opens the weather sheet. Hidden while there's no fresh weather.
class WeatherStrip extends StatefulWidget {
  const WeatherStrip({super.key});

  @override
  State<WeatherStrip> createState() => _WeatherStripState();
}

class _WeatherStripState extends State<WeatherStrip> {
  final _picker = MoodPicker();
  Timer? _minute;

  @override
  void initState() {
    super.initState();
    // Sunset and sunrise come with the clock, not with a weather update.
    _minute = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _minute?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cartOpen = context.select<CartProvider, bool>(
      (p) => p.selectedCart?.isOpen ?? true,
    );
    return ValueListenableBuilder<WeatherData?>(
      valueListenable: WeatherService.current,
      builder: (context, w, _) {
        if (w == null || w.isStale) return const SizedBox.shrink();
        final mood = _picker.pick(clock.now(), w, cartOpen: cartOpen);
        final dark = moodIsDark(mood);
        final ink = dark ? Colors.white : const Color(0xFF1F2430);
        final warn = w.heavyRainAt != null || w.isHeavy;

        return Semantics(
          button: true,
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            clipBehavior: Clip.antiAlias,
            child: Ink(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: moodSky(mood),
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: InkWell(
                onTap: () => showWeatherSheet(context, mood),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 6, 12, 6),
                  child: Row(
                    children: [
                      // The handover: a new character slides in.
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 1200),
                        transitionBuilder: (child, a) => FadeTransition(
                          opacity: a,
                          child: SlideTransition(
                            position:
                                Tween(
                                  begin: const Offset(0, 0.6),
                                  end: Offset.zero,
                                ).animate(
                                  CurvedAnimation(
                                    parent: a,
                                    curve: Curves.easeOutBack,
                                  ),
                                ),
                            child: child,
                          ),
                        ),
                        child: CharacterView(
                          key: ValueKey(mood.character),
                          mood: mood,
                          size: 60,
                        ),
                      ),
                      AppGaps.w8,
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${w.tempC}° · ${conditionLabel(context.l10n, w.condition)}',
                              style: AppTextStyles.body.copyWith(
                                color: ink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              moodMessage(context, mood, w),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.caption.copyWith(
                                color: ink.withValues(alpha: 0.85),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (warn)
                        const Padding(
                          padding: EdgeInsets.only(left: 6),
                          child: Icon(
                            Icons.warning_amber_rounded,
                            color: Color(0xFFDC2626),
                            size: 20,
                          ),
                        ),
                      Icon(
                        Icons.chevron_right,
                        color: ink.withValues(alpha: 0.6),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
