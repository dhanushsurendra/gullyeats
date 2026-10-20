import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/features/cart/models/sales_model.dart';
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';

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
    {'key': 'today', 'label': 'Today'},
    {'key': 'yesterday', 'label': 'Yesterday'},
    {'key': 'last7', 'label': 'Last 7 Days'},
    {'key': 'last30', 'label': 'Last 30 Days'},
  ];

  static const List<String> _monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
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

  Future<void> _loadSales() async {
    final authProvider = context.read<AuthProvider>();
    await context.read<CartProvider>().loadSales(
      authProvider.token!,
      _startDate.toString(),
      _endDate.toString(),
    );
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

  String _formatDisplayDate(DateTime date) {
    final month = _monthNames[date.month - 1];
    return '${date.day.toString().padLeft(2, '0')} $month ${date.year}';
  }

  void openSwitchOutletSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SwitchCartScreen(isDraggable: true),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CartProvider>();
    final data = provider.sales;

    // Initial loading: no data exists yet.
    if (data == null) {
      return const Scaffold(
        body: SafeArea(
          child: Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadSales,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: AppPadding.screen,
            children: [
              // ================================================================
              // HEADER
              // ================================================================
              _header(),

              AppGaps.h16,

              Text("Sales Dashboard", style: AppTextStyles.heading2),

              Text(
                "Track your earnings and progress",
                style: AppTextStyles.caption,
              ),

              AppGaps.h16,

              // ================================================================
              // FILTERS
              // ================================================================
              _dateFilter(),

              AppGaps.h16,

              // ================================================================
              // SALES CONTENT
              //
              // Only this section gets the loading overlay when the filter
              // changes. The header + filters remain visible.
              // ================================================================
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

                      const SizedBox(height: 100),
                    ],
                  ),

                  // ============================================================
                  // FILTER LOADING OVERLAY
                  // ============================================================
                  if (provider.isLoading)
                    Positioned.fill(
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.white.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Center(
                          child: CircularProgressIndicator(
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------

  Widget _header() {
    return Row(
      children: [
        Image.asset(
          "assets/images/logo_text.png",
          height: 24,
          fit: BoxFit.contain,
        ),
        const Spacer(),
        _buildOutletSelector(context),
      ],
    );
  }

  Widget _buildOutletSelector(BuildContext context) {
    return GestureDetector(
      onTap: () => openSwitchOutletSheet(context),
      child: Container(
        padding: AppPadding.smallCard,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.grey300),
          borderRadius: BorderRadius.circular(12),
          color: AppColors.white,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    "Raju Momos",
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.heading3.copyWith(fontSize: 14),
                  ),
                  Text(
                    "BTM 2nd Stage",
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption,
                  ),
                ],
              ),
            ),
            AppGaps.w8,
            const Icon(
              Icons.keyboard_arrow_down,
              size: 18,
              color: AppColors.grey500,
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateFilter() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Date Range", style: AppTextStyles.heading3),
        AppGaps.h8,
        Row(
          children: [
            Expanded(
              child: _dateBox(
                _startDate,
                onTap: () => _pickDate(isStart: true),
              ),
            ),
            AppGaps.w8,
            Expanded(
              child: _dateBox(_endDate, onTap: () => _pickDate(isStart: false)),
            ),
          ],
        ),
        AppGaps.h12,
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _presets.map((preset) {
              final isLast = preset == _presets.last;
              return Padding(
                padding: EdgeInsets.only(right: isLast ? 0 : 8),
                child: _presetChip(preset['label']!, preset['key']!),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _dateBox(DateTime date, {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.grey200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.calendar_today_outlined,
              size: 16,
              color: AppColors.grey500,
            ),
            AppGaps.w8,
            Flexible(
              child: Text(
                _formatDisplayDate(date),
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _presetChip(String label, String presetKey) {
    final isSelected = _selectedPreset == presetKey;

    return GestureDetector(
      onTap: () => _applyPreset(presetKey),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.grey200,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? AppColors.primary.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.05),
              blurRadius: isSelected ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Text(
          label,
          style: AppTextStyles.body.copyWith(
            color: isSelected ? AppColors.white : AppColors.black,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Shared building blocks
  // ---------------------------------------------------------------------

  BoxDecoration _card() => BoxDecoration(
    color: AppColors.white,
    borderRadius: BorderRadius.circular(16),
    border: Border.all(color: AppColors.grey200, width: 1),
    boxShadow: [
      BoxShadow(
        color: AppColors.black.withValues(alpha: 0.05),
        blurRadius: 10,
        offset: const Offset(0, 4),
      ),
    ],
  );

  Widget _sectionCard({required Widget child}) {
    return Container(
      padding: AppPadding.card,
      decoration: _card(),
      child: child,
    );
  }

  Widget _sectionTitle(String title, {String? trailing, Color? trailingColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: AppTextStyles.heading3),
        if (trailing != null)
          Text(
            trailing,
            style: AppTextStyles.caption.copyWith(
              color: trailingColor ?? AppColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
      ],
    );
  }

  String _money(num value) => "₹${value.toStringAsFixed(0)}";

  String _pct(num value) => "${value.toStringAsFixed(1)}%";

  Widget _statBox(String title, String value, {Color? valueColor}) {
    return Expanded(
      child: Container(
        padding: AppPadding.smallCard,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(title, style: AppTextStyles.caption),
            ),
            AppGaps.h4,
            Text(
              value,
              style: AppTextStyles.heading2.copyWith(
                fontSize: 18,
                color: valueColor ?? AppColors.black,
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: AppTextStyles.caption),
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
              borderRadius: BorderRadius.circular(10),
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
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.75),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Total Revenue",
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
                "₹${value.toInt()}",
                style: AppTextStyles.heading1.copyWith(color: AppColors.white),
              );
            },
          ),
          AppGaps.h16,
          Container(height: 1, color: AppColors.white.withValues(alpha: 0.2)),
          AppGaps.h16,
          Row(
            children: [
              _heroStat("Net", _money(data.netRevenue)),
              _heroStat("Subtotal", _money(data.subtotalRevenue)),
              _heroStat("Platform Fee", _money(data.platformFeeRevenue)),
              _heroStat("Parcel", _money(data.parcelRevenue)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            value,
            style: AppTextStyles.body.copyWith(
              color: AppColors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
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
        _statBox("Avg Order", _money(data.avgOrderValue)),
        AppGaps.w8,
        _statBox("Highest", _money(data.highestOrder)),
        AppGaps.w8,
        _statBox("Lowest", _money(data.lowestOrder)),
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
          _sectionTitle("Orders", trailing: "${data.totalOrders} total"),
          AppGaps.h16,
          Row(
            children: [
              _statBox(
                "Unpaid",
                "${data.pendingOrders}",
                valueColor: AppColors.grey500,
              ),
              AppGaps.w8,
              _statBox("Paid", "${data.paidOrders}"),
              AppGaps.w8,
              _statBox(
                "Served",
                "${data.servedOrders}",
                valueColor: AppColors.success,
              ),
              AppGaps.w8,
              _statBox(
                "Cancelled",
                "${data.cancelledOrders}",
                valueColor: AppColors.error,
              ),
            ],
          ),
          AppGaps.h16,
          _progressRow(
            "Completion Rate",
            data.completionRate,
            AppColors.success,
          ),
          _progressRow("Payment Rate", data.paymentRate, AppColors.primary),
          _progressRow(
            "Cancellation Rate",
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
          _sectionTitle("Items Sold"),
          AppGaps.h16,
          Row(
            children: [
              _statBox("Total Sold", "${data.totalItemsSold}"),
              AppGaps.w8,
              _statBox("Unique", "${data.uniqueItemsSold}"),
            ],
          ),
          AppGaps.h8,
          Row(
            children: [
              _statBox("Avg / Order", data.avgItemsPerOrder.toStringAsFixed(1)),
              AppGaps.w8,
              _statBox("Max in 1 Order", "${data.highestItemsInOrder}"),
            ],
          ),
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
          _sectionTitle("Order Type"),
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
                "QR · ${data.qrOrders} orders · ${_money(data.qrRevenue)}",
              ),
            ],
          ),
          AppGaps.h4,
          Row(
            children: [
              _legendDot(
                AppColors.grey300,
                "Manual · ${data.manualOrders} orders · ${_money(data.manualRevenue)}",
              ),
            ],
          ),
          AppGaps.h16,
          Container(height: 1, color: AppColors.grey200),
          AppGaps.h16,
          Row(
            children: [
              _statBox("Parcel Orders", "${data.parcelOrders}"),
              AppGaps.w8,
              _statBox("Avg Parcel Charge", _money(data.avgParcelCharge)),
            ],
          ),
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
            _sectionTitle("Busy Hours"),
            AppGaps.h8,
            Text("No orders in this period yet", style: AppTextStyles.caption),
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
            "Busy Hours",
            trailing: data.peakHour != null
                ? "Peak: ${HourCount(hour: data.peakHour!, count: 0).label}"
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
          _sectionTitle("Timing"),
          _timingRow(Icons.timer_outlined, "Avg Prep Time", data.avgPrepTime),
          _timingRow(Icons.bolt_outlined, "Fastest Order", data.fastestOrder),
          _timingRow(
            Icons.hourglass_bottom_outlined,
            "Slowest Order",
            data.slowestOrder,
          ),
          _timingRow(
            Icons.payments_outlined,
            "Avg Payment Time",
            data.avgPaymentTime,
          ),
          _timingRow(
            Icons.check_circle_outline,
            "Avg Serve After Payment",
            data.avgServeAfterPaymentTime,
          ),
          _timingRow(
            Icons.swap_horiz,
            "Avg Time Between Orders",
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
          _sectionTitle("Item Leaderboard"),
          AppGaps.h12,
          if (data.topRevenueItem != null || data.topVolumeItem != null)
            Row(
              children: [
                if (data.topRevenueItem != null)
                  _badge(
                    Icons.star_rounded,
                    "Top Revenue",
                    data.topRevenueItem!,
                    AppColors.primary,
                  ),
                if (data.topRevenueItem != null && data.topVolumeItem != null)
                  AppGaps.w8,
                if (data.topVolumeItem != null)
                  _badge(
                    Icons.local_fire_department_rounded,
                    "Top Volume",
                    data.topVolumeItem!,
                    AppColors.success,
                  ),
              ],
            ),
          AppGaps.h16,
          if (data.topItems.isNotEmpty) ...[
            Text(
              "Top Sellers",
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
              "Needs a Push",
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
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: color),
                AppGaps.w4,
                Text(
                  label,
                  style: AppTextStyles.caption.copyWith(color: color),
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
          Text("${item.qty} sold", style: AppTextStyles.caption),
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
