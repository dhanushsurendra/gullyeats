import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/app/home/home_screen.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/providers/payment_provider.dart';
import 'package:ordering/features/weather/characters.dart';
import 'package:ordering/features/weather/mood.dart';
import 'package:ordering/features/weather/weather_service.dart';
import 'package:ordering/features/weather/weather_strip.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

/// The weather sheet the Orders strip opens. New orders keep ringing under
/// it: the Orders screen and its socket stay where they are.
void showWeatherSheet(BuildContext context, Mood mood) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => WeatherDetails(mood: mood),
  );
}

/// Cards inside the sheet: a soft grey on the sheet in both themes, like
/// the app's other sheets (never the page colour, which reads as a hole).
BoxDecoration _card({Color? color, Color? border}) => BoxDecoration(
  color: color ?? AppColors.grey100,
  borderRadius: BorderRadius.circular(16),
  border: border == null ? null : Border.all(color: border, width: 1.5),
);

const _rainBlue = Color(0xFF3B82F6);

/// Current conditions, the day's light, the next hours and, in the evening,
/// Chill's card with today's business so far.
class WeatherDetails extends StatelessWidget {
  final Mood mood;

  const WeatherDetails({super.key, required this.mood});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).languageCode;
    return ValueListenableBuilder<WeatherData?>(
      valueListenable: WeatherService.current,
      builder: (context, w, _) {
        if (w == null || w.isStale) return const SizedBox.shrink();
        final now = clock.now();
        final night = MoodPicker.isNight(now, w);
        final ago = now.difference(w.updatedAt).inMinutes;

        return ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            _Hero(mood: mood, weather: w, night: night),
            AppGaps.h12,
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Stat(
                    Icons.water_drop_rounded,
                    l10n.weatherRain,
                    rainWord(l10n, w.rainMm),
                  ),
                  AppGaps.w8,
                  _Stat(
                    Icons.opacity_rounded,
                    l10n.weatherHumidity,
                    '${w.humidity}%',
                  ),
                  AppGaps.w8,
                  _Stat(
                    Icons.air_rounded,
                    l10n.weatherWind,
                    '${w.windKph} km/h',
                  ),
                ],
              ),
            ),
            AppGaps.h12,
            _DayLight(weather: w, now: now, locale: locale),
            AppGaps.h24,
            Text(l10n.weatherNextHours, style: AppTextStyles.heading3),
            AppGaps.h8,
            // A row that sizes itself to its text, so large system text fits.
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, h) in w.hourly.indexed) ...[
                    if (i > 0) AppGaps.w8,
                    _Hour(hour: h, weather: w, now: i == 0, locale: locale),
                  ],
                ],
              ),
            ),
            AppGaps.h12,
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(
                    Icons.info_outline_rounded,
                    size: 14,
                    color: AppColors.grey400,
                  ),
                ),
                AppGaps.w8,
                Expanded(
                  child: Text(
                    '${l10n.weatherForecastNote} ${l10n.weatherUpdated(ago < 1 ? l10n.justNow : l10n.minutesAgo(ago))}',
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.grey400,
                    ),
                  ),
                ),
              ],
            ),
            if (night && !context.read<AuthProvider>().isStaff) ...[
              AppGaps.h24,
              const EveningCard(),
            ],
          ],
        );
      },
    );
  }
}

/// The sky with the character, the temperature and what they say.
class _Hero extends StatelessWidget {
  final Mood mood;
  final WeatherData weather;
  final bool night;

  const _Hero({required this.mood, required this.weather, required this.night});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final w = weather;
    final dark = moodIsDark(mood);
    final ink = dark ? AppColors.white : const Color(0xFF1F2430);
    final warn = w.heavyRainAt != null && !w.isHeavy && mood != Mood.sleeping;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: moodSky(mood),
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: CustomPaint(
        painter: moodHasStars(mood) ? const NightStars() : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CharacterView(mood: mood, size: 112),
                AppGaps.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${w.tempC}°',
                        style: AppTextStyles.display.copyWith(
                          color: ink,
                          height: 1.1,
                        ),
                      ),
                      AppGaps.h4,
                      Row(
                        children: [
                          Icon(
                            conditionIcon(w.condition, night: night),
                            size: 18,
                            color: ink,
                          ),
                          AppGaps.w4,
                          Flexible(
                            child: Text(
                              conditionLabel(l10n, w.condition),
                              style: AppTextStyles.body.copyWith(
                                color: ink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        l10n.weatherFeelsLike(w.feelsC),
                        style: AppTextStyles.caption.copyWith(
                          color: dark
                              ? AppColors.lilac
                              : ink.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            AppGaps.h12,
            // What the character says, as a speech bubble.
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: dark
                    ? AppColors.white.withValues(alpha: 0.12)
                    : AppColors.white.withValues(alpha: 0.65),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(4),
                  topRight: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                  bottomRight: Radius.circular(12),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (warn) ...[
                    Icon(
                      Icons.warning_amber_rounded,
                      size: 18,
                      color: dark ? const Color(0xFFFCA5A5) : AppColors.error,
                    ),
                    AppGaps.w8,
                  ],
                  Expanded(
                    child: Text(
                      moodMessage(context, mood, w),
                      style: AppTextStyles.body.copyWith(
                        color: ink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sunrise to sunset as a bar, with the sun's place in the day.
class _DayLight extends StatelessWidget {
  final WeatherData weather;
  final DateTime now;
  final String locale;

  const _DayLight({
    required this.weather,
    required this.now,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final rise = weather.sunrise, set = weather.sunset;
    final day = set.difference(rise).inSeconds;
    final done = day <= 0
        ? 0.0
        : (now.difference(rise).inSeconds / day).clamp(0.0, 1.0);
    final fmt = DateFormat.jm(locale);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: _card(),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(
                Icons.wb_twilight_rounded,
                size: 18,
                color: AppColors.warning,
              ),
              AppGaps.w8,
              Expanded(
                child: Text(
                  l10n.weatherSunrise(fmt.format(rise)),
                  style: AppTextStyles.caption,
                ),
              ),
              AppGaps.w8,
              Expanded(
                child: Text(
                  l10n.weatherSunset(fmt.format(set)),
                  textAlign: TextAlign.end,
                  style: AppTextStyles.caption,
                ),
              ),
              AppGaps.w8,
              const Icon(
                Icons.nights_stay_rounded,
                size: 18,
                color: AppColors.lilac,
              ),
            ],
          ),
          AppGaps.h12,
          SizedBox(
            height: 14,
            child: LayoutBuilder(
              builder: (context, c) => Stack(
                alignment: Alignment.centerLeft,
                children: [
                  Container(
                    height: 6,
                    decoration: BoxDecoration(
                      color: AppColors.grey200,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  Container(
                    height: 6,
                    width: c.maxWidth * done,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(3),
                      gradient: const LinearGradient(
                        colors: [AppColors.warning, AppColors.primary],
                      ),
                    ),
                  ),
                  Positioned(
                    left: (c.maxWidth - 14) * done,
                    child: Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done >= 1 ? AppColors.lilac : AppColors.warning,
                        border: Border.all(color: AppColors.grey100, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One hour of the forecast; the hour under way is marked "Now".
class _Hour extends StatelessWidget {
  final HourWeather hour;
  final WeatherData weather;
  final bool now;
  final String locale;

  const _Hour({
    required this.hour,
    required this.weather,
    required this.now,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    final h = hour;
    final hourNight =
        h.at.isBefore(weather.sunrise) || !h.at.isBefore(weather.sunset);
    final wet =
        h.condition.contains('rain') ||
        h.condition == 'drizzle' ||
        h.condition == 'storm';
    return Container(
      constraints: const BoxConstraints(minWidth: 68),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: now
          ? _card(color: AppColors.lightOrange, border: AppColors.primary)
          : _card(),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 6,
        children: [
          Text(
            now ? context.l10n.weatherNow : DateFormat.jm(locale).format(h.at),
            style: AppTextStyles.caption.copyWith(
              color: now ? AppColors.primary : null,
              fontWeight: now ? FontWeight.w700 : null,
            ),
            maxLines: 1,
          ),
          Icon(
            conditionIcon(h.condition, night: hourNight),
            size: 22,
            color: wet
                ? _rainBlue
                : hourNight && h.condition == 'clear'
                ? AppColors.lilac
                : AppColors.warning,
          ),
          Text(
            '${h.tempC}°',
            style: AppTextStyles.heading3.copyWith(color: AppColors.black),
          ),
          Text(
            rainText(h.rainMm),
            style: AppTextStyles.caption.copyWith(
              color: h.rainMm > 0 ? _rainBlue : AppColors.grey400,
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _Stat(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: _card(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.lightOrange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: AppColors.primary),
            ),
            AppGaps.h8,
            // Value and label shrink rather than break a word at large text.
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                value,
                style: AppTextStyles.heading3.copyWith(color: AppColors.black),
              ),
            ),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(label, style: AppTextStyles.caption),
            ),
          ],
        ),
      ),
    );
  }
}

/// Chill's "Today so far": the orders the app already holds for today
/// (paid or served, the same rule as Sales and the fee bill) and the
/// existing fee status. Changes no billing: today's fee is billed after
/// midnight as always, and Pay now appears only when a bill is due.
class EveningCard extends StatefulWidget {
  const EveningCard({super.key});

  @override
  State<EveningCard> createState() => _EveningCardState();
}

class _EveningCardState extends State<EveningCard> {
  PaymentStatusModel? _status;

  @override
  void initState() {
    super.initState();
    // The same read-only status check Home runs; it changes nothing.
    final token = context.read<AuthProvider>().token;
    final cartId = context.read<CartProvider>().selectedCart?.id;
    if (token != null && cartId != null) {
      context.read<PaymentProvider>().refreshStatus(token, cartId).then((s) {
        if (mounted) setState(() => _status = s);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    context.select<OrderProvider, int>((p) => p.ordersVersion);
    final paid = context
        .read<OrderProvider>()
        .orders
        .where((o) => o.status == 'PAID' || o.status == 'SERVED')
        .toList();
    final sales = paid.fold<double>(0, (n, o) => n + o.totalPrice);
    final fee = paid.fold<double>(0, (n, o) => n + o.platformFee);
    final status = _status;
    final due = status != null && status.canPay && status.totalPending > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CharacterView(mood: Mood.chillEvening, size: 44),
              AppGaps.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.eveningTitle, style: AppTextStyles.heading3),
                    Text(l10n.eveningFeeNote, style: AppTextStyles.caption),
                  ],
                ),
              ),
            ],
          ),
          AppGaps.h16,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Figure(l10n.orders, '${paid.length}'),
                AppGaps.w8,
                _Figure(l10n.sales, '₹${formatPrice(sales)}'),
                AppGaps.w8,
                _Figure(l10n.platformFee, '₹${formatPrice(fee)}'),
              ],
            ),
          ),
          if (status != null) ...[
            AppGaps.h12,
            Container(
              padding: EdgeInsets.fromLTRB(12, due ? 6 : 10, 6, due ? 6 : 10),
              decoration: BoxDecoration(
                color: due
                    ? AppColors.lightOrange
                    : AppColors.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    due
                        ? Icons.receipt_long_rounded
                        : Icons.check_circle_rounded,
                    size: 18,
                    color: due ? AppColors.primary : AppColors.success,
                  ),
                  AppGaps.w8,
                  Expanded(
                    child: Text(
                      due
                          ? l10n.eveningBillDue(
                              formatPrice(status.totalPending),
                            )
                          : l10n.eveningNoBill,
                      style: AppTextStyles.body.copyWith(
                        color: due ? AppColors.black : AppColors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (due)
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      // Over the sheet, so Back returns to it.
                      onPressed: () => openFeePayment(context, status),
                      child: Text(
                        l10n.payNowCaps,
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  final String label;
  final String value;

  const _Figure(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.center,
              child: Text(
                value,
                style: AppTextStyles.heading3.copyWith(color: AppColors.black),
              ),
            ),
            Text(
              label,
              style: AppTextStyles.caption,
              maxLines: 2,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Forecast rain for an hour: "0 mm", "0.4 mm", "12 mm".
String rainText(double mm) {
  final r = (mm * 10).round() / 10;
  return '${r == 0
      ? '0'
      : r < 10
      ? r.toStringAsFixed(1)
      : r.round()} mm';
}

/// Forecast rain for an hour in words, by the usual hourly rates: under
/// 2.5 mm light, under 7.6 mm moderate, then heavy.
String rainWord(AppLocalizations l10n, double mm) {
  final r = (mm * 10).round() / 10;
  if (r == 0) return l10n.weatherNoRain;
  if (r < 2.5) return l10n.weatherCondDrizzle;
  if (r < 7.6) return l10n.weatherCondRain;
  return l10n.weatherCondHeavyRain;
}
