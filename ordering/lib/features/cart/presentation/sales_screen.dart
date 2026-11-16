import 'package:ordering/core/widgets/app_logo.dart';
import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/features/cart/models/sales_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/list_message.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:ordering/core/widgets/date_range_filter.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/features/cart/widgets/cart_selector.dart';

class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> {
  bool _init = false;
  double _animationValue = 0;

  // Date range filter state. Only startDate/endDate ever go to the backend —
  // the presets below are purely a UI convenience for filling them in.
  late DateTime _startDate;
  late DateTime _endDate;
  String? _selectedPreset = 'today';

  static const List<Map<String, String>> _presets = [
    {'key': 'today'},
    {'key': 'yesterday'},
    {'key': 'last7'},
    {'key': 'last30'},
  ];


  @override
  void initState() {
    super.initState();
    final today = clock.now();
    _startDate = DateTime(today.year, today.month, today.day);
    _endDate = DateTime(today.year, today.month, today.day);

    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) setState(() => _animationValue = 1);
    });
  }

  String? _cartId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final cartId = context.watch<CartProvider>().selectedCart?.id;
    if (!_init) {
      _init = true;
      _cartId = cartId;
      _loadSales();
    } else if (cartId != null && cartId != _cartId) {
      // Switched here: stay on Sales with the new cart's numbers.
      _cartId = cartId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadSales();
      });
    }
  }

  // Set when loading fails and there is no earlier data to show.
  String? _error;

  /// Days in the chosen range (1 for a single day).
  int get _days => _endDate.difference(_startDate).inDays + 1;

  Future<void> _loadSales() async {
    final authProvider = context.read<AuthProvider>();
    final cartProvider = context.read<CartProvider>();
    setState(() => _error = null);

    try {
      await cartProvider.loadSales(
        authProvider.token,
        _startDate.toString(),
        _endDate.toString(),
      );
    } catch (e) {
      if (!mounted) return;
      final message = AppExceptionHandler.getMessage(e);
      if (cartProvider.sales == null) {
        setState(() => _error = message);
      } else {
        AppSnackBar.show(context, message: message, isError: true);
      }
    }
  }

  void _applyPreset(String presetKey) {
    final today = clock.now();
    final todayStart = DateTime(today.year, today.month, today.day);

    DateTime start;
    DateTime end = todayStart;

    switch (presetKey) {
      case 'yesterday':
        start = todayStart.subtract(const Duration(days: 1));
        end = start;
        break;

      case 'last7':
        start = todayStart.subtract(const Duration(days: 6));
        break;

      case 'last30':
        start = todayStart.subtract(const Duration(days: 29));
        break;

      case 'today':
      default:
        start = todayStart;
    }

    setState(() {
      _selectedPreset = presetKey;
      _startDate = start;
      _endDate = end;
    });

    _loadSales();
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: clock.now(),
    );

    if (picked == null) return;
    if (!mounted) return;

    setState(() {
      _selectedPreset = null;

      if (isStart) {
        _startDate = picked;

        if (_endDate.isBefore(_startDate)) {
          _endDate = _startDate;
        }
      } else {
        _endDate = picked;

        if (_startDate.isAfter(_endDate)) {
          _startDate = _endDate;
        }
      }
    });

    _loadSales();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final provider = context.watch<CartProvider>();
    final data = provider.sales;

    return BaseScreen(
      showBackButton: false,
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const AppLogo(),
              AppGaps.w16,
              // Shrinks on narrow phones so it never pushes past the edge.
              const Flexible(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: CartSelector(),
                ),
              ),
            ],
          ),
          AppGaps.h24,
          Text(l10n.salesDashboard, style: AppTextStyles.heading1),
          AppGaps.h4,
          Text(
            l10n.salesSubtitle,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
        ],
      ),
      expandToFullHeight: true,
      child: RefreshIndicator(
        onRefresh: _loadSales,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          // Room for the floating bottom navigation bar.
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            DateRangeFilter(
              start: _startDate,
              end: _endDate,
              presets: [for (final p in _presets) p['key']!],
              selectedPreset: _selectedPreset,
              onPickDate: (isStart) => _pickDate(isStart: isStart),
              onPreset: _applyPreset,
            ),
            AppGaps.h24,
            if (data == null && _error != null)
              ListMessage.failed(message: l10n.couldntLoadSales, onRetry: _loadSales)
            else if (data == null)
              const Skeleton(heights: [170, 80, 200])
            else
              Stack(
                children: [
                  Column(
                    children: [
                      _revenueHero(data),
                      // A card with nothing to say leaves itself out (null).
                      for (final card in [
                        _compareCard(data),
                        _missedCard(data),
                        if (_days > 1) _dailyCard(data),
                        _busyHoursCard(data),
                        _customersCard(data),
                        _itemsCard(data),
                        _orderTypeCard(data),
                      ])
                        if (card != null) ...[AppGaps.h16, card],
                    ],
                  ),
                  // Changing the dates keeps the old numbers under a veil.
                  if (provider.isLoading)
                    const Positioned.fill(child: ShimmerVeil(radius: 16)),
                ],
              ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Shared building blocks
  // ---------------------------------------------------------------------

  Widget _sectionCard({required Widget child}) {
    return AppCard(padding: const EdgeInsets.all(16), child: child);
  }

  Widget _sectionTitle(String title, {String? trailing, Color? trailingColor}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(title, style: AppTextStyles.heading3)),
        if (trailing != null) ...[
          AppGaps.w8,
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 140),
            child: Text(
              trailing,
              textAlign: TextAlign.end,
              style: AppTextStyles.caption.copyWith(
                color: trailingColor ?? AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }

  /// Boxes two per row, so four of them don't squeeze on a phone.
  Widget _statGrid(List<Widget> boxes) {
    return Column(
      children: [
        for (var i = 0; i < boxes.length; i += 2) ...[
          if (i > 0) AppGaps.h8,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              boxes[i],
              AppGaps.w8,
              if (i + 1 < boxes.length) boxes[i + 1] else const Spacer(),
            ],
          ),
        ],
      ],
    );
  }

  String _money(num value) => "₹${formatPrice(value.round())}";

  Widget _statBox(
    String title,
    String value, {
    Color? valueColor,
    String? note,
    Widget? noteWidget,
  }) {
    return Expanded(
      child: Container(
        padding: AppPadding.smallCard,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Labels wrap; numbers shrink to fit rather than overflow.
            Text(title, textAlign: TextAlign.center, style: AppTextStyles.caption),
            AppGaps.h4,
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: AppTextStyles.heading2.copyWith(
                  color: valueColor ?? AppColors.black,
                ),
              ),
            ),
            if (note != null)
              Text(note, textAlign: TextAlign.center, style: AppTextStyles.caption),
            ?noteWidget,
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Revenue hero
  // ---------------------------------------------------------------------

  Widget _revenueHero(SalesModel data) {
    return Container(
      width: double.infinity,
      padding: AppPadding.card,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        // Night purple with an orange total: a small reward to look at, in both themes.
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.nightDeep, AppColors.night, AppColors.nightSoft],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.totalRevenue,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.lilac,
              fontWeight: FontWeight.w600,
            ),
          ),
          AppGaps.h8,
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: data.revenue),
            duration: const Duration(milliseconds: 800),
            builder: (context, value, _) {
              return Text(
                _money(value),
                style: AppTextStyles.heading1.copyWith(color: AppColors.primary),
              );
            },
          ),
          AppGaps.h16,
          Container(height: 1, color: AppColors.white.withValues(alpha: 0.12)),
          AppGaps.h16,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _heroStat(context.l10n.net, data.netRevenue),
              _heroStat(context.l10n.subtotal, data.subtotalRevenue),
              _heroStat(context.l10n.platformFee, data.platformFeeRevenue),
              _heroStat(context.l10n.parcel, data.parcelRevenue),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String label, num amount) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            // Counts up with the total above.
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: amount.toDouble()),
              duration: const Duration(milliseconds: 800),
              builder: (context, value, _) => Text(
                _money(value),
                style: AppTextStyles.body.copyWith(
                  color: AppColors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          Text(
            label,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.white.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // At a glance: revenue, paid orders, average order, each compared with
  // the same number of days just before (when the backend sends that)
  // ---------------------------------------------------------------------

  Widget _compareCard(SalesModel data) {
    final l10n = context.l10n;
    final compare = data.previousRevenue != null;
    Widget box(String label, String value, num now, num? before) =>
        before == null ? _statBox(label, value) : _compareBox(label, value, now, before);
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(
            !compare
                ? l10n.atAGlance
                : _days == 1
                    ? l10n.comparedDayBefore
                    : l10n.comparedDaysBefore(_days),
          ),
          AppGaps.h12,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              box(l10n.revenueLabel, _money(data.revenue), data.revenue, data.previousRevenue),
              AppGaps.w8,
              box(l10n.paidOrdersLabel, '${data.paidOrders}', data.paidOrders, data.previousOrders),
              AppGaps.w8,
              box(l10n.avgOrder, _money(data.avgOrderValue), data.avgOrderValue, data.previousAvgOrderValue),
            ],
          ),
        ],
      ),
    );
  }

  /// A stat box with the change since the period before under the value.
  Widget _compareBox(String label, String value, num now, num before) {
    final change = before == 0 ? null : (now - before) / before * 100;
    final up = (change ?? 0) >= 0;
    final color = change == null ? AppColors.grey500 : (up ? AppColors.success : AppColors.error);
    return _statBox(
      label,
      value,
      noteWidget: change == null
          ? Text(
              now == 0 ? '-' : context.l10n.noSalesBefore,
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(color: color),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(up ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded, size: 14, color: color),
                Flexible(
                  child: Text(
                    '${change.abs().round()}%',
                    style: AppTextStyles.caption.copyWith(color: color, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
    );
  }

  // ---------------------------------------------------------------------
  // Missed money: unpaid and cancelled orders
  // ---------------------------------------------------------------------

  Widget? _missedCard(SalesModel data) {
    if (data.pendingOrders == 0 && data.cancelledOrders == 0) return null;
    final l10n = context.l10n;
    Widget row(IconData icon, Color color, String text) => Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          AppGaps.w8,
          Expanded(child: Text(text, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600))),
        ],
      ),
    );
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(
            l10n.missedMoney,
            trailing: _money(data.unpaidValue + data.cancelledValue),
            trailingColor: AppColors.error,
          ),
          if (data.pendingOrders > 0)
            row(Icons.hourglass_empty_rounded, AppColors.warning,
                l10n.missedUnpaid(data.pendingOrders, _money(data.unpaidValue))),
          if (data.cancelledOrders > 0)
            row(Icons.cancel_outlined, AppColors.error,
                l10n.missedCancelled(data.cancelledOrders, _money(data.cancelledValue))),
          if (data.pendingOrders > 0) ...[
            AppGaps.h8,
            Text(l10n.missedHint, style: AppTextStyles.caption),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Charts: revenue per day, orders per hour
  // ---------------------------------------------------------------------

  /// Bars with the highlighted one orange, labels thinned out to fit.
  Widget _bars(List<double> values, List<String> labels, int? highlight) {
    final maxVal = values.fold<double>(0, (a, b) => b > a ? b : a);
    final every = (values.length / 7).ceil().clamp(1, 99);
    return SizedBox(
      height: 170,
      child: BarChart(
        BarChartData(
          maxY: maxVal == 0 ? 1 : maxVal * 1.15,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          barTouchData: BarTouchData(enabled: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                getTitlesWidget: (value, _) {
                  final i = value.toInt();
                  if (i >= labels.length || i % every != 0) return const SizedBox();
                  return Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(labels[i], style: AppTextStyles.caption),
                  );
                },
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < values.length; i++)
              BarChartGroupData(
                x: i,
                barRods: [
                  BarChartRodData(
                    toY: values[i] * _animationValue,
                    width: values.length > 16 ? 8 : (values.length > 8 ? 12 : 20),
                    borderRadius: BorderRadius.circular(6),
                    color: i == highlight ? AppColors.primary : AppColors.grey300,
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget? _dailyCard(SalesModel data) {
    if (data.days.length < 2) return null; // older backend
    var best = 0;
    for (var i = 1; i < data.days.length; i++) {
      if (data.days[i].revenue > data.days[best].revenue) best = i;
    }
    String label(DateTime d) => '${d.day}/${d.month}';
    final hasSales = data.days[best].revenue > 0;
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(
            context.l10n.dailySales,
            trailing: hasSales ? context.l10n.bestDay(label(data.days[best].day)) : null,
          ),
          AppGaps.h16,
          _bars(
            [for (final d in data.days) d.revenue],
            [for (final d in data.days) label(d.day)],
            hasSales ? best : null,
          ),
          if (_bestWeekday(data.days) case final day?) ...[
            AppGaps.h8,
            Text(
              context.l10n.bestWeekday(
                DateFormat.EEEE(Localizations.localeOf(context).toString()).format(day),
              ),
              style: AppTextStyles.caption,
            ),
          ],
        ],
      ),
    );
  }

  /// A day with the weekday that earns most on average, once there are at
  /// least two of each weekday to compare; null before that or with no sales.
  DateTime? _bestWeekday(List<DaySales> days) {
    if (days.length < 14) return null;
    final total = <int, double>{}, count = <int, int>{}, sample = <int, DateTime>{};
    for (final d in days) {
      total[d.day.weekday] = (total[d.day.weekday] ?? 0) + d.revenue;
      count[d.day.weekday] = (count[d.day.weekday] ?? 0) + 1;
      sample[d.day.weekday] = d.day;
    }
    final best = total.keys.reduce((a, b) => total[a]! / count[a]! >= total[b]! / count[b]! ? a : b);
    return total[best]! > 0 ? sample[best] : null;
  }

  Widget _busyHoursCard(SalesModel data) {
    final hours = data.hours;
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(
            context.l10n.busyHours,
            trailing: data.peakHour != null
                ? context.l10n.peakHour(HourCount(hour: data.peakHour!, count: 0).label)
                : null,
          ),
          AppGaps.h16,
          if (hours.isEmpty)
            Text(context.l10n.noOrdersInPeriod, style: AppTextStyles.caption)
          else
            _bars(
              [for (final h in hours) h.count.toDouble()],
              [for (final h in hours) h.label],
              hours.indexWhere((h) => h.hour == data.peakHour),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Customers and service
  // ---------------------------------------------------------------------

  Widget _customersCard(SalesModel data) {
    final l10n = context.l10n;
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(l10n.customersAndService),
          AppGaps.h16,
          _statGrid([
            _statBox(
              l10n.customersLabel,
              '${data.customers}',
              note: l10n.returningCount(data.returningCustomers),
            ),
            _statBox(
              l10n.overallRating,
              data.avgRating == null ? '-' : '${data.avgRating!.toStringAsFixed(1)}/5',
              valueColor: data.avgRating == null ? null : AppColors.warning,
              note: data.ratingCount == 0 ? l10n.noRatingsYet : l10n.ratingCount(data.ratingCount),
            ),
            _statBox(l10n.avgWait, data.avgWaitAfterPayment ?? '-'),
          ]),
          AppGaps.h8,
          Text(l10n.customersHint, style: AppTextStyles.caption),
          if (data.recentFeedback.isNotEmpty) ...[
            AppGaps.h16,
            Text(l10n.recentFeedback, style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
            for (final f in data.recentFeedback) _feedbackRow(f),
          ],
        ],
      ),
    );
  }

  Widget _feedbackRow(FeedbackNote f) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: AppColors.grey100, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('"${f.text}"', style: AppTextStyles.body),
          if (f.rating != null || f.at != null) ...[
            AppGaps.h4,
            Text(
              [
                if (f.rating != null) '${f.rating}/5',
                if (f.at != null) '${f.at!.day}/${f.at!.month}',
              ].join(' · '),
              style: AppTextStyles.caption,
            ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Items: top sellers and what didn't sell
  // ---------------------------------------------------------------------

  Widget? _itemsCard(SalesModel data) {
    if (data.totalItemsSold == 0 && data.topItems.isEmpty && data.unsoldItems.isEmpty) return null;
    final l10n = context.l10n;
    final best = data.topItems.isEmpty ? 0.0 : data.topItems.first.revenue;
    const shown = 8;
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (data.totalItemsSold > 0) ...[
            _statGrid([
              _statBox(l10n.itemsSoldLabel, '${data.totalItemsSold}'),
              _statBox(l10n.itemsPerOrder, data.avgItemsPerOrder.toStringAsFixed(1)),
            ]),
            AppGaps.h16,
          ],
          if (data.topItems.isNotEmpty) ...[
            _sectionTitle(l10n.topSellers),
            AppGaps.h8,
            for (var i = 0; i < data.topItems.length; i++)
              _itemRow(i + 1, data.topItems[i], best == 0 ? 0 : data.topItems[i].revenue / best),
          ],
          if (data.unsoldItems.isNotEmpty) ...[
            if (data.topItems.isNotEmpty) AppGaps.h16,
            _sectionTitle(l10n.notSold),
            AppGaps.h4,
            Text(l10n.notSoldHint, style: AppTextStyles.caption),
            AppGaps.h12,
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final name in data.unsoldItems.take(shown))
                  _chip(name, AppColors.grey100, AppColors.black),
                if (data.unsoldItems.length > shown)
                  _chip(l10n.andMore(data.unsoldItems.length - shown), AppColors.lightOrange, AppColors.primary),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip(String text, Color background, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(20)),
    child: Text(text, style: AppTextStyles.caption.copyWith(color: color)),
  );

  /// Rank, name, sold count and revenue, over a bar for its share of the best seller.
  Widget _itemRow(int rank, ItemStat item, double share) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: [
          Row(
            children: [
              SizedBox(
                width: 22,
                child: Text(
                  '$rank',
                  style: AppTextStyles.caption.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700),
                ),
              ),
              Expanded(
                child: Text(item.name, overflow: TextOverflow.ellipsis, style: AppTextStyles.body),
              ),
              AppGaps.w8,
              Text(context.l10n.soldCount(item.qty), style: AppTextStyles.caption),
              AppGaps.w8,
              Text(_money(item.revenue), style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
          AppGaps.h4,
          Padding(
            padding: const EdgeInsets.only(left: 22),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: share.clamp(0, 1).toDouble() * _animationValue,
                minHeight: 4,
                backgroundColor: AppColors.grey200,
                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Order type (QR vs counter) + parcel
  // ---------------------------------------------------------------------

  Widget _orderTypeCard(SalesModel data) {
    final totalTypeOrders = data.qrOrders + data.manualOrders;
    final qrShare = totalTypeOrders == 0 ? 0.0 : data.qrOrders / totalTypeOrders;

    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context.l10n.orderType),
          AppGaps.h12,
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 10,
              child: Row(
                children: [
                  Expanded(
                    flex: (qrShare * 100).round().clamp(1, 99),
                    child: Container(color: AppColors.primary),
                  ),
                  Expanded(
                    flex: (100 - (qrShare * 100).round()).clamp(1, 99),
                    child: Container(color: AppColors.grey300),
                  ),
                ],
              ),
            ),
          ),
          AppGaps.h12,
          Row(
            children: [
              _legendDot(
                AppColors.primary,
                context.l10n.qrOrdersSummary(data.qrOrders, _money(data.qrRevenue)),
              ),
            ],
          ),
          AppGaps.h4,
          Row(
            children: [
              _legendDot(
                AppColors.grey300,
                context.l10n.manualOrdersSummary(data.manualOrders, _money(data.manualRevenue)),
              ),
            ],
          ),
          AppGaps.h16,
          Container(height: 1, color: AppColors.grey200),
          AppGaps.h16,
          _statGrid([
            _statBox(context.l10n.parcelOrders, "${data.parcelOrders}"),
            _statBox(context.l10n.avgParcelCharge, _money(data.avgParcelCharge)),
          ]),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Expanded(
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          AppGaps.w8,
          Expanded(
            child: Text(label, style: AppTextStyles.caption, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}
