import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/utils/format_price.dart';

class OrdersOverviewCard extends StatefulWidget {
  final OrderModel order;

  const OrdersOverviewCard({super.key, required this.order});

  @override
  State<OrdersOverviewCard> createState() => OrdersOverviewCardState();
}

class OrdersOverviewCardState extends State<OrdersOverviewCard> {
  bool expanded = false;

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final time = order.createdAt ?? order.orderDate;
    final statusColor = _statusColor(order.status);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      // A Stack instead of IntrinsicHeight+Row: the spine just stretches to
      // whatever height the content ends up being, with no intrinsic-size
      // computation involved — that computation is what fights with
      // AnimatedSize mid-animation and throws overflow errors.
      child: Stack(
        children: [
          Positioned.fill(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Status-colored spine — quick visual read without hunting
                // for the badge, like a boarding-pass stub.
                Container(width: 5, color: statusColor),
              ],
            ),
          ),
          Padding(
            padding: AppPadding.card.add(const EdgeInsets.only(left: 5)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _topRow(order, time, statusColor),
                AppGaps.h8,
                AnimatedSize(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeInOut,
                  alignment: Alignment.topCenter,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      expanded ? _itemsBill(order) : _itemsCollapsed(order),
                      if (expanded) ...[
                        AppGaps.h12,
                        const _DashedDivider(),
                        AppGaps.h8,
                        _billBreakdown(order),
                        AppGaps.h12,
                        _metaChips(order),
                        AppGaps.h4,
                      ],
                    ],
                  ),
                ),
                AppGaps.h8,
                _bottomRow(order),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Top row — order chip, time, status
  // ---------------------------------------------------------------------

  // Wrap: on narrow screens or long translations the status drops to a new
  // line instead of overflowing.
  Widget _topRow(OrderModel order, DateTime? time, Color statusColor) {
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.grey100,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.receipt_long_rounded,
                size: 12,
                color: AppColors.grey600,
              ),
              AppGaps.w4,
              Text(
                "#${shortOrderId(order.id)}",
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        if (time != null)
          Text(
            formatDateTimeIST(time),
            style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
          ),
        statusBadge(order.status),
      ],
    );
  }

  String shortOrderId(String id) {
    if (id.length <= 6) return id;
    return id.substring(id.length - 6);
  }

  // ---------------------------------------------------------------------
  // Collapsed items — up to 2, inline, "…" if more
  // ---------------------------------------------------------------------

  Widget _itemsCollapsed(OrderModel order) {
    return Text(_collapsedSummary(order), style: AppTextStyles.caption);
  }

  String _collapsedSummary(OrderModel order) {
    if (order.orderItems.isEmpty) return context.l10n.noItems;

    final visible = order.orderItems.take(2);
    final summary = visible
        .map((item) => "${item.name} x${item.quantity}")
        .join(" • ");

    return order.orderItems.length > 2 ? "$summary • …" : summary;
  }

  // ---------------------------------------------------------------------
  // Expanded items — one line per item, receipt style
  // ---------------------------------------------------------------------

  Widget _itemsBill(OrderModel order) {
    if (order.orderItems.isEmpty) {
      return Text(context.l10n.noItems, style: AppTextStyles.caption);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < order.orderItems.length; i++) ...[
          if (i != 0) const SizedBox(height: 6),
          _itemLine(order.orderItems[i]),
        ],
      ],
    );
  }

  Widget _itemLine(dynamic item) {
    final lineTotal = _itemLineTotal(item);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 28,
          child: Text(
            "${item.quantity}×",
            style: AppTextStyles.caption.copyWith(
              color: AppColors.grey600,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Expanded(
          child: Text(
            item.name,
            style: AppTextStyles.body,
          ),
        ),
        if (lineTotal != null)
          Text(
            money(lineTotal),
            style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w600),
          ),
      ],
    );
  }

  num? _itemLineTotal(dynamic item) {
    try {
      final num? unitPrice = item.price as num?;
      final num qty = item.quantity as num;
      if (unitPrice == null) return null;
      return unitPrice * qty;
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Bill breakdown — subtotal / charges / grand total
  // ---------------------------------------------------------------------

  Widget _billBreakdown(OrderModel order) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        detailRow(context.l10n.subtotal, money(order.subtotal)),
        if (order.parcelCharge > 0) ...[
          const SizedBox(height: 6),
          detailRow(context.l10n.parcelCharge, money(order.parcelCharge)),
        ],
        if (order.platformFee > 0) ...[
          const SizedBox(height: 6),
          detailRow(context.l10n.platformFee, money(order.platformFee)),
        ],
        AppGaps.h8,
        Container(height: 1, color: AppColors.grey200),
        AppGaps.h8,
        detailRow(context.l10n.total, money(order.totalPrice), isBold: true),
      ],
    );
  }

  Widget detailRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: (isBold ? AppTextStyles.body : AppTextStyles.caption).copyWith(
            color: isBold ? AppColors.black : AppColors.grey600,
          ),
        ),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: (isBold ? AppTextStyles.body : AppTextStyles.caption)
                .copyWith(
                  fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
                  color: isBold ? AppColors.primary : AppColors.black,
                ),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Meta chips — payment / type / timestamps
  // ---------------------------------------------------------------------

  Widget _metaChips(OrderModel order) {
    final chips = <Widget>[
      _metaChip(order.isQrOrder ? context.l10n.qrOrder : context.l10n.manual),
      if (order.orderDate != null) _metaChip(formatDateTime(order.orderDate!)),
      if (order.paidAt != null)
        _metaChip(context.l10n.paidAt(formatDateTimeIST(order.paidAt!))),
      if (order.servedAt != null)
        _metaChip(context.l10n.servedAt(formatDateTime(order.servedAt!))),
    ];

    return Wrap(spacing: 8, runSpacing: 8, children: chips);
  }

  Widget _metaChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Bottom row — grand total + expand toggle
  // ---------------------------------------------------------------------

  Widget _bottomRow(OrderModel order) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          money(order.totalPrice),
          style: AppTextStyles.heading3.copyWith(fontWeight: FontWeight.w800),
        ),
        InkWell(
          onTap: () => setState(() => expanded = !expanded),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.grey600.
              withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
              size: 18,
              color: AppColors.grey600,
            ),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Status helpers
  // ---------------------------------------------------------------------

  Color _statusColor(String status) {
    switch (status) {
      case 'SERVED':
        return AppColors.success;
      case 'CANCELLED':
        return AppColors.error;
      case 'PAID':
        return AppColors.primary;
      case 'PENDING':
      default:
        return AppColors.warning;
    }
  }

  Widget statusBadge(String status) {
    final color = _statusColor(status);

    return Container(
      padding: AppPadding.chip,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        formatStatus(status),
        style: AppTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  String formatStatus(String status) {
    switch (status) {
      case 'SERVED':
        return context.l10n.served;
      case 'CANCELLED':
        return context.l10n.cancelled;
      case 'PAID':
        return context.l10n.paid;
      case 'PENDING':
      default:
        return context.l10n.pending;
    }
  }

  // ---------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------

  String formatDateTime(DateTime date) {
    return formatDateTimeIST(date);
  }

  String formatDateTimeIST(DateTime date) {
    final istDate = date.toUtc().add(const Duration(hours: 5, minutes: 30));

    final day = istDate.day.toString().padLeft(2, '0');
    final month = istDate.month.toString().padLeft(2, '0');
    final year = istDate.year;

    final hour = istDate.hour % 12 == 0 ? 12 : istDate.hour % 12;
    final minute = istDate.minute.toString().padLeft(2, '0');
    final period = istDate.hour >= 12 ? 'PM' : 'AM';

    return "$day/$month/$year • $hour:$minute $period";
  }

  String money(num value) {
    return "₹${formatPrice(value)}";
  }
}

// ---------------------------------------------------------------------
// Dashed "tear line" divider — the receipt touch
// ---------------------------------------------------------------------

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(double.infinity, 1),
      painter: _DashedLinePainter(),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.grey300
      ..strokeWidth = 1;

    const dashWidth = 5.0;
    const dashSpace = 4.0;
    double startX = 0;

    while (startX < size.width) {
      canvas.drawLine(Offset(startX, 0), Offset(startX + dashWidth, 0), paint);
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
