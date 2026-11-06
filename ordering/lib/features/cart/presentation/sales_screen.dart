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
    final today = DateTime.now();
    _startDate = DateTime(today.year, today.month, today.day);
    _endDate = DateTime(today.year, today.month, today.day);

    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) setState(() => _animationValue = 1);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_init) {
      _init = true;
      _loadSales();
    }
  }

  // Set when loading fails and there is no earlier data to show.
  String? _error;

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
    final today = DateTime.now();
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
      lastDate: DateTime.now(),
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
              Image.asset("assets/images/logo_text.png", height: 24),
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
                      AppGaps.h16,
                      _quickStatsRow(data),
                      AppGaps.h16,
                      _orderFunnelCard(data),
                      AppGaps.h16,
                      _itemsCard(data),
                      AppGaps.h16,
                      _orderTypeCard(data),
                      AppGaps.h16,
                      _busyHoursCard(data),
                      AppGaps.h16,
                      _timingCard(data),
                      AppGaps.h16,
                      _leaderboardCard(data),
                    ],
                  ),
                  // Changing the dates keeps the old numbers under a veil.
                  if (provider.isLoading)
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.white.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                    ),
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

  String _pct(num value) => "${value.toStringAsFixed(1)}%";

  Widget _statBox(String title, String value, {Color? valueColor}) {
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
          ],
        ),
      ),
    );
  }

  Widget _progressRow(String label, double percent, Color color) {
    final clamped = percent.isNaN ? 0.0 : percent.clamp(0, 100).toDouble();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: AppTextStyles.caption)),
              AppGaps.w8,
              Text(
                _pct(clamped),
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          AppGaps.h4,
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: clamped / 100),
              duration: const Duration(milliseconds: 800),
              builder: (context, value, _) {
                return LinearProgressIndicator(
                  value: value,
                  minHeight: 8,
                  backgroundColor: AppColors.grey200,
                  valueColor: AlwaysStoppedAnimation(color),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _timingRow(IconData icon, String label, String? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 16, color: AppColors.primary),
          ),
          AppGaps.w8,
          Expanded(child: Text(label, style: AppTextStyles.caption)),
          Text(
            value ?? "-",
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
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
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.75),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.totalRevenue,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.white.withValues(alpha: 0.85),
            ),
          ),
          AppGaps.h8,
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: data.revenue),
            duration: const Duration(milliseconds: 800),
            builder: (context, value, _) {
              return Text(
                _money(value),
                style: AppTextStyles.heading1.copyWith(color: AppColors.white),
              );
            },
          ),
          AppGaps.h16,
          Container(height: 1, color: AppColors.white.withValues(alpha: 0.2)),
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
              color: AppColors.white.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Quick stats: avg order value, revenue/order, highest, lowest
  // ---------------------------------------------------------------------

  Widget _quickStatsRow(SalesModel data) {
    return Row(
      children: [
        _statBox(context.l10n.avgOrder, _money(data.avgOrderValue)),
        AppGaps.w8,
        _statBox(context.l10n.highest, _money(data.highestOrder)),
        AppGaps.w8,
        _statBox(context.l10n.lowest, _money(data.lowestOrder)),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Order funnel: counts + rates
  // ---------------------------------------------------------------------

  Widget _orderFunnelCard(SalesModel data) {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context.l10n.orders, trailing: context.l10n.totalCount(data.totalOrders)),
          AppGaps.h16,
          _statGrid([
            _statBox(
              context.l10n.unpaid,
              "${data.pendingOrders}",
              valueColor: AppColors.grey500,
            ),
            _statBox(context.l10n.paid, "${data.paidOrders}"),
            _statBox(
              context.l10n.served,
              "${data.servedOrders}",
              valueColor: AppColors.success,
            ),
            _statBox(
              context.l10n.cancelled,
              "${data.cancelledOrders}",
              valueColor: AppColors.error,
            ),
          ]),
          AppGaps.h16,
          _progressRow(
            context.l10n.completionRate,
            data.completionRate,
            AppColors.success,
          ),
          _progressRow(context.l10n.paymentRate, data.paymentRate, AppColors.primary),
          _progressRow(
            context.l10n.cancellationRate,
            data.cancellationRate,
            AppColors.error,
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------

  Widget _itemsCard(SalesModel data) {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context.l10n.itemsSold),
          AppGaps.h16,
          _statGrid([
            _statBox(context.l10n.totalSold, "${data.totalItemsSold}"),
            _statBox(context.l10n.unique, "${data.uniqueItemsSold}"),
            _statBox(context.l10n.avgPerOrder, data.avgItemsPerOrder.toStringAsFixed(1)),
            _statBox(context.l10n.maxInOneOrder, "${data.highestItemsInOrder}"),
          ]),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Order type (QR vs Manual) + parcel
  // ---------------------------------------------------------------------

  Widget _orderTypeCard(SalesModel data) {
    final totalTypeOrders = data.qrOrders + data.manualOrders;
    final qrShare = totalTypeOrders == 0
        ? 0.0
        : data.qrOrders / totalTypeOrders;

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
            child: Text(
              label,
              style: AppTextStyles.caption,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Busy hours
  // ---------------------------------------------------------------------

  Widget _busyHoursCard(SalesModel data) {
    final entries = data.busyHours.where((e) => e.count > 0).toList();

    if (entries.isEmpty) {
      return _sectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle(context.l10n.busyHours),
            AppGaps.h8,
            Text(context.l10n.noOrdersInPeriod, style: AppTextStyles.caption),
          ],
        ),
      );
    }

    final maxVal = entries.map((e) => e.count).reduce((a, b) => a > b ? a : b);

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
          SizedBox(
            height: 180,
            child: BarChart(
              BarChartData(
                maxY: maxVal.toDouble() + (maxVal * 0.2),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      getTitlesWidget: (value, _) {
                        final index = value.toInt();
                        if (index >= entries.length) return const SizedBox();

                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            entries[index].label,
                            style: AppTextStyles.caption,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: List.generate(entries.length, (i) {
                  final entry = entries[i];
                  final isPeak = entry.hour == data.peakHour;

                  return BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: entry.count.toDouble() * _animationValue,
                        width: entries.length > 10 ? 14 : 24,
                        borderRadius: BorderRadius.circular(8),
                        color: isPeak ? AppColors.primary : AppColors.grey300,
                      ),
                    ],
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
  // ---------------------------------------------------------------------
  // Timing
  // ---------------------------------------------------------------------

  Widget _timingCard(SalesModel data) {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context.l10n.timing),
          _timingRow(Icons.timer_outlined, context.l10n.avgPrepTime, data.avgPrepTime),
          _timingRow(Icons.bolt_outlined, context.l10n.fastestOrder, data.fastestOrder),
          _timingRow(
            Icons.hourglass_bottom_outlined,
            context.l10n.slowestOrder,
            data.slowestOrder,
          ),
          _timingRow(
            Icons.payments_outlined,
            context.l10n.avgPaymentTime,
            data.avgPaymentTime,
          ),
          _timingRow(
            Icons.check_circle_outline,
            context.l10n.avgServeAfterPayment,
            data.avgServeAfterPaymentTime,
          ),
          _timingRow(
            Icons.swap_horiz,
            context.l10n.avgTimeBetweenOrders,
            data.averageTimeBetweenOrders,
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Top / bottom items
  // ---------------------------------------------------------------------

  Widget _leaderboardCard(SalesModel data) {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context.l10n.itemLeaderboard),
          AppGaps.h12,
          if (data.topRevenueItem != null || data.topVolumeItem != null)
            Row(
              children: [
                if (data.topRevenueItem != null)
                  _badge(
                    Icons.star_rounded,
                    context.l10n.topRevenue,
                    data.topRevenueItem!,
                    AppColors.primary,
                  ),
                if (data.topRevenueItem != null && data.topVolumeItem != null)
                  AppGaps.w8,
                if (data.topVolumeItem != null)
                  _badge(
                    Icons.local_fire_department_rounded,
                    context.l10n.topVolume,
                    data.topVolumeItem!,
                    AppColors.success,
                  ),
              ],
            ),
          AppGaps.h16,
          if (data.topItems.isNotEmpty) ...[
            Text(
              context.l10n.topSellers,
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            AppGaps.h8,
            ...List.generate(
              data.topItems.length,
              (i) => _itemRow(i + 1, data.topItems[i], AppColors.success),
            ),
          ],
          if (data.bottomItems.isNotEmpty) ...[
            AppGaps.h16,
            Text(
              context.l10n.needsAPush,
              style: AppTextStyles.caption.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            AppGaps.h8,
            ...List.generate(
              data.bottomItems.length,
              (i) => _itemRow(i + 1, data.bottomItems[i], AppColors.error),
            ),
          ],
        ],
      ),
    );
  }

  Widget _badge(IconData icon, String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: color),
                AppGaps.w4,
                Flexible(
                  child: Text(
                    label,
                    style: AppTextStyles.caption.copyWith(color: color),
                  ),
                ),
              ],
            ),
            AppGaps.h4,
            Text(
              value,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _itemRow(int rank, ItemStat item, Color rankColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: rankColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Text(
              "$rank",
              style: AppTextStyles.caption.copyWith(
                color: rankColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          AppGaps.w8,
          Expanded(
            child: Text(
              item.name,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body,
            ),
          ),
          // Two narrow lines: count above revenue, so the name keeps room.
          Text(context.l10n.soldCount(item.qty), style: AppTextStyles.caption),
          AppGaps.w8,
          Text(
            _money(item.revenue),
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
