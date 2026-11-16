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
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => WeatherDetails(mood: mood),
  );
}

/// Current conditions, the next hours and, in the evening, Chill's card with
/// today's business so far.
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
        final dark = moodIsDark(mood);
        final ink = dark ? Colors.white : const Color(0xFF1F2430);
        final night = MoodPicker.isNight(clock.now(), w);
        final ago = clock.now().difference(w.updatedAt).inMinutes;

        return ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          children: [
            // The sky, the character and the headline numbers.
            Container(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: LinearGradient(
                  colors: moodSky(mood),
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Row(
                children: [
                  CharacterView(mood: mood, size: 128),
                  AppGaps.w8,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${w.tempC}°',
                          style: AppTextStyles.display.copyWith(color: ink),
                        ),
                        Text(
                          conditionLabel(l10n, w.condition),
                          style: AppTextStyles.body.copyWith(
                            color: ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${l10n.weatherFeelsLike(w.feelsC)} · ${l10n.weatherSunset(DateFormat.jm(locale).format(w.sunset))}',
                          style: AppTextStyles.caption.copyWith(
                            color: ink.withValues(alpha: 0.8),
                          ),
                        ),
                        AppGaps.h8,
                        Text(
                          moodMessage(context, mood, w),
                          style: AppTextStyles.caption.copyWith(
                            color: ink,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            AppGaps.h16,
            Row(
              children: [
                _Stat(
                  Icons.water_drop_outlined,
                  l10n.weatherRain,
                  rainText(w.rainMm),
                ),
                AppGaps.w8,
                _Stat(Icons.opacity, l10n.weatherHumidity, '${w.humidity}%'),
                AppGaps.w8,
                _Stat(Icons.air, l10n.weatherWind, '${w.windKph} km/h'),
              ],
            ),
            AppGaps.h16,
            Text(l10n.weatherNextHours, style: AppTextStyles.heading3),
            AppGaps.h8,
            // A row that sizes itself to its text, so large system text fits.
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final (i, h) in w.hourly.indexed) ...[
                    if (i > 0) AppGaps.w8,
                    _hour(locale, h, w),
                  ],
                ],
              ),
            ),
            AppGaps.h8,
            Text(
              '${l10n.weatherForecastNote} ${l10n.weatherUpdated(ago < 1 ? l10n.justNow : l10n.minutesAgo(ago))}',
              style: AppTextStyles.caption.copyWith(fontSize: 11),
            ),
            if (night && !context.read<AuthProvider>().isStaff) ...[
              AppGaps.h16,
              const EveningCard(),
            ],
          ],
        );
      },
    );
  }

  Widget _hour(String locale, HourWeather h, WeatherData w) {
    final hourNight = h.at.isBefore(w.sunrise) || !h.at.isBefore(w.sunset);
    return Container(
      constraints: const BoxConstraints(minWidth: 64),
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 4,
        children: [
          Text(
            DateFormat.jm(locale).format(h.at),
            style: AppTextStyles.caption,
            maxLines: 1,
          ),
          Icon(
            conditionIcon(h.condition, night: hourNight),
            size: 20,
            color: h.condition.contains('rain') || h.condition == 'storm'
                ? const Color(0xFF3B82F6)
                : AppColors.warning,
          ),
          Text(
            '${h.tempC}°',
            style: AppTextStyles.body.copyWith(
              color: AppColors.black,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            rainText(h.rainMm),
            style: AppTextStyles.caption.copyWith(fontSize: 11),
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
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.grey200),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: AppColors.grey500),
            AppGaps.h4,
            Text(
              value,
              style: AppTextStyles.body.copyWith(
                color: AppColors.black,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              label,
              maxLines: 2,
              style: AppTextStyles.caption.copyWith(fontSize: 11),
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
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CharacterView(mood: Mood.chillEvening, size: 36),
              AppGaps.w8,
              Text(l10n.eveningTitle, style: AppTextStyles.heading3),
            ],
          ),
          AppGaps.h12,
          Row(
            children: [
              _Figure(l10n.orders, '${paid.length}'),
              _Figure(l10n.sales, '₹${formatPrice(sales)}'),
              _Figure(l10n.platformFee, '₹${formatPrice(fee)}'),
            ],
          ),
          AppGaps.h8,
          Text(l10n.eveningFeeNote, style: AppTextStyles.caption),
          if (status != null) ...[
            AppGaps.h12,
            Row(
              children: [
                Expanded(
                  child: Text(
                    due
                        ? l10n.eveningBillDue(formatPrice(status.totalPending))
                        : l10n.eveningNoBill,
                    style: AppTextStyles.body.copyWith(
                      color: due ? AppColors.warning : AppColors.success,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (due)
                  TextButton(
                    // Over the sheet, so Back returns to it.
                    onPressed: () => openFeePayment(context, status),
                    child: Text(
                      l10n.payNowCaps,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: AppTextStyles.heading3.copyWith(color: AppColors.black),
          ),
          Text(label, style: AppTextStyles.caption, maxLines: 2),
        ],
      ),
    );
  }
}

/// Forecast rain for an hour: "0 mm", "0.4 mm", "12 mm".
String rainText(double mm) {
  final r = (mm * 10).round() / 10;
  return '${r == 0 ? '0' : r < 10 ? r.toStringAsFixed(1) : r.round()} mm';
}
