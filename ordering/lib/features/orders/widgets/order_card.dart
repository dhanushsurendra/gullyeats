import 'package:flutter/material.dart';
import 'package:ordering/core/utils/order_alerts.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/utils/format_price.dart';

/// The colour of each order stage, shared with the section headers.
Color orderStatusColor(String status) => switch (status) {
  'SERVED' => AppColors.success,
  'CANCELLED' => AppColors.error,
  'PAID' => AppColors.primary,
  _ => AppColors.warning,
};

class OrderCard extends StatefulWidget {
  final OrderModel order;
  final VoidCallback onServe;
  final VoidCallback onMarkPaid;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  /// Marks a paid order as being cooked (true) or not (false). Optional:
  /// the vendor can serve without it.
  final ValueChanged<bool>? onPreparing;

  /// "Mark refunded": the money owed back on this order was handed over.
  final VoidCallback? onMarkRefunded;

  /// Just arrived live: the card slides in and glows briefly.
  final bool isFresh;

  const OrderCard({
    super.key,
    required this.order,
    required this.onServe,
    required this.onTap,
    required this.onDelete,
    required this.onMarkPaid,
    this.onMarkRefunded,
    this.onPreparing,
    this.isFresh = false,
  });

  @override
  State<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<OrderCard>
    with SingleTickerProviderStateMixin {
  // True from the tap until the server answers: SERVE turns green "SERVED",
  // MARK PAID turns green "PAID", so the vendor sees the tap land at once.
  bool _done = false;

  // Item lines shown before "+N more".
  static const _visibleItems = 3;

  // 1 → 0: a soft glow in the stage colour when an order arrives or moves
  // to its next stage, so the jump to another group reads as one motion.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  void _glow() {
    _pulse.value = 1;
    _pulse.animateTo(0, curve: Curves.easeOut);
  }

  @override
  void initState() {
    super.initState();
    if (widget.isFresh) _glow();
  }

  @override
  void didUpdateWidget(OrderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The server answered: the new stage's button starts fresh.
    if (oldWidget.order.status != widget.order.status) {
      _done = false;
      _glow();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  void _confirm(VoidCallback action, Future<void> Function() feedback) {
    feedback();
    setState(() => _done = true);
    action();
    // If the request fails the card stays, so bring the button back.
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _done = false);
    });
  }

  Future<bool?> _showDeleteDialog(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(context.l10n.deleteOrder, style: AppTextStyles.heading2),
          content: Text(
            context.l10n.confirmDeleteOrder,
            style: AppTextStyles.body,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                context.l10n.cancel,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.grey600,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: () {
                widget.onDelete?.call();
                Navigator.pop(context);
              },
              style: TextButton.styleFrom(
                backgroundColor: AppColors.error,
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(26),
                ),
              ),
              child: Text(
                context.l10n.delete,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.order.status;
    final isCancelled = status == "CANCELLED";
    final isActive = status == "PENDING" || status == "PAID";
    final color = orderStatusColor(status);

    final card = AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) {
        final t = _pulse.value;
        // A fresh order glows orange; a stage change in its new colour.
        final glow = widget.isFresh && status == 'PENDING'
            ? AppColors.primary
            : color;
        Color tint(Color c) => Color.lerp(
          c,
          Color.alphaBlend(glow.withValues(alpha: 0.10), c),
          t,
        )!;
        // Depth without clutter: a soft shadow on the light theme, and on
        // both a faint top-to-bottom sheen so the card isn't a flat slab.
        final top = AppColors.dark
            ? Color.lerp(AppColors.surface, Colors.white, 0.04)!
            : AppColors.surface;
        final bottom = AppColors.dark
            ? AppColors.surface
            : const Color(0xFFFBFAF9);
        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              if (!AppColors.dark)
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              if (t > 0)
                BoxShadow(
                  color: glow.withValues(alpha: 0.25 * t),
                  blurRadius: 16,
                ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(
                color: Color.lerp(AppColors.grey200, glow, t)!,
                width: 1 + t,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Ink(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [tint(top), tint(bottom)],
                ),
              ),
              child: InkWell(onTap: widget.onTap, child: child),
            ),
          ),
        );
      },
      // Cancelled orders stay readable but step back.
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 300),
        opacity: isCancelled ? 0.6 : 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _topRow(isActive),
                  if (status == "PAID" && widget.onPreparing != null) ...[
                    AppGaps.h8,
                    _preparingChip(),
                  ],
                  AppGaps.h12,
                  ..._itemLines(),
                ],
              ),
            ),
            const _TicketTear(),
            // The footer: total and the next step, on a faint tint.
            ColoredBox(
              color: AppColors.grey100.withValues(alpha: 0.5),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _bottomRow(),
                    if (widget.order.paymentAdjustment?.action ==
                        'COLLECT') ...[
                      AppGaps.h8,
                      _paymentAdjustmentBanner(widget.order.paymentAdjustment!),
                    ],
                    if (widget.order.refundOwed > 0 ||
                        widget.order.refunds.isNotEmpty) ...[
                      AppGaps.h8,
                      _refundBanner(),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );

    // A new live order slides in from above.
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: widget.isFresh ? 1 : 0, end: 0),
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
      builder: (context, slide, child) => Opacity(
        opacity: 1 - slide,
        child: Transform.translate(
          offset: Offset(0, -24 * slide),
          child: child,
        ),
      ),
      child: card,
    );
  }

  // ---------------------------------------------------------------------
  // Top row: number, source and wait time, delete
  // ---------------------------------------------------------------------

  Widget _topRow(bool isActive) {
    final l10n = context.l10n;
    final isQr = widget.order.isQrOrder;

    return Row(
      children: [
        Text(
          "#${widget.order.orderNumber}",
          style: AppTextStyles.heading2.copyWith(
            color: AppColors.black,
            fontWeight: FontWeight.w700,
          ),
        ),
        AppGaps.w12,
        // Wrap: the wait time drops below the source on narrow screens.
        Expanded(
          child: Wrap(
            spacing: 10,
            runSpacing: 2,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _iconLabel(
                isQr ? Icons.qr_code_2_rounded : Icons.storefront_rounded,
                isQr ? l10n.qrOrder : l10n.manual,
                AppColors.grey500,
              ),
              if (isActive) _waitTime(),
            ],
          ),
        ),
        if (isActive)
          IconButton(
            onPressed: () => _showDeleteDialog(context),
            tooltip: l10n.deleteOrder,
            visualDensity: VisualDensity.compact,
            icon: Icon(
              Icons.delete_outline_rounded,
              size: 20,
              color: AppColors.grey400,
            ),
          ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Items: one line each, quantity first, like a kitchen ticket
  // ---------------------------------------------------------------------

  List<Widget> _itemLines() {
    final items = widget.order.orderItems;
    if (items.isEmpty) {
      return [
        Text(
          context.l10n.noItems,
          style: AppTextStyles.body.copyWith(color: AppColors.grey400),
        ),
      ];
    }

    final cancelled = widget.order.status == "CANCELLED";
    return [
      for (final item in items.take(_visibleItems))
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 32,
                child: Text(
                  "${item.quantity}×",
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  item.displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.black,
                    fontWeight: FontWeight.w500,
                    decoration: cancelled ? TextDecoration.lineThrough : null,
                  ),
                ),
              ),
            ],
          ),
        ),
      if (items.length > _visibleItems)
        Padding(
          padding: const EdgeInsets.only(left: 32),
          child: Text(
            context.l10n.moreItems(items.length - _visibleItems),
            style: AppTextStyles.caption.copyWith(
              color: AppColors.grey400,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
    ];
  }

  // ---------------------------------------------------------------------
  // Bottom row: total and the next step
  // ---------------------------------------------------------------------

  Widget _bottomRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.total,
                style: AppTextStyles.caption.copyWith(color: AppColors.grey400),
              ),
              Text(
                "₹${formatPrice(widget.order.totalPrice)}",
                style: AppTextStyles.heading2.copyWith(
                  color: AppColors.black,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        AppGaps.w12,
        // Capped, so a long translation wraps instead of squeezing the total.
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 170),
          child: _action(),
        ),
      ],
    );
  }

  /// One button that morphs through the order's life instead of being
  /// swapped: MARK PAID (outlined) → PAID ✓ (green, right on tap) → SERVE
  /// (filled) → SERVED ✓ (green) → the Served chip. Colour, size, icon and
  /// label all animate, so each step flows into the next.
  Widget _action() {
    final l10n = context.l10n;
    final status = widget.order.status;

    final (
      IconData icon,
      String label,
      Color bg,
      Color fg,
      Color edge,
      VoidCallback? onTap,
    ) = switch (status) {
      "CANCELLED" => (
        Icons.block_rounded,
        l10n.cancelled.toUpperCase(),
        AppColors.error.withValues(alpha: 0.12),
        AppColors.error,
        Colors.transparent,
        null,
      ),
      "SERVED" => (
        Icons.check_circle_rounded,
        l10n.served.toUpperCase(),
        AppColors.success.withValues(alpha: 0.12),
        AppColors.success,
        Colors.transparent,
        null,
      ),
      "PAID" when _done => (
        Icons.check_rounded,
        l10n.served.toUpperCase(),
        AppColors.success,
        AppColors.white,
        AppColors.success,
        null,
      ),
      "PAID" => (
        Icons.room_service_rounded,
        l10n.serve.toUpperCase(),
        AppColors.primary,
        AppColors.white,
        AppColors.primary,
        () => _confirm(widget.onServe, OrderAlerts.served),
      ),
      _ when _done => (
        Icons.check_rounded,
        l10n.paid.toUpperCase(),
        AppColors.success,
        AppColors.white,
        AppColors.success,
        null,
      ),
      _ => (
        Icons.currency_rupee_rounded,
        l10n.markPaidCaps,
        AppColors.lightOrange,
        AppColors.primary,
        AppColors.primary,
        () => _confirm(widget.onMarkPaid, OrderAlerts.paid),
      ),
    };

    const motion = Duration(milliseconds: 350);
    return Semantics(
      button: onTap != null,
      label: label,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: motion,
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: edge),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: BorderRadius.circular(26),
            onTap: onTap,
            child: AnimatedSize(
              duration: motion,
              curve: Curves.easeOutCubic,
              child: ConstrainedBox(
                // A min height (not fixed), so large system text still fits.
                constraints: const BoxConstraints(minHeight: 44),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  child: AnimatedSwitcher(
                    duration: motion,
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (child, a) => FadeTransition(
                      opacity: a,
                      child: SlideTransition(
                        position: Tween(
                          begin: const Offset(0, 0.4),
                          end: Offset.zero,
                        ).animate(a),
                        child: child,
                      ),
                    ),
                    child: Row(
                      key: ValueKey(label),
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 18, color: fg),
                        AppGaps.w8,
                        Flexible(
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: AppTextStyles.caption.copyWith(
                              color: fg,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _iconLabel(
    IconData icon,
    String text,
    Color color, {
    bool bold = false,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        AppGaps.w4,
        Flexible(
          child: Text(
            text,
            style: AppTextStyles.caption.copyWith(
              color: color,
              fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }

  /// "Start preparing" on a paid order; once tapped, a filled "Preparing"
  /// that can be tapped again to take it back. Customers see it in the queue.
  Widget _preparingChip() {
    final on = widget.order.isPreparing;
    final label = on ? context.l10n.preparing : context.l10n.startPreparing;
    return Semantics(
      button: true,
      toggled: on,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => widget.onPreparing!(!on),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          constraints: const BoxConstraints(minHeight: 32),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: on ? AppColors.warning : AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.warning),
          ),
          child: _iconLabel(
            on
                ? Icons.local_fire_department_rounded
                : Icons.local_fire_department_outlined,
            label,
            on ? AppColors.white : AppColors.warning,
            bold: true,
          ),
        ),
      ),
    );
  }

  /// How long the customer has waited: grey, then amber after 5 minutes and
  /// red after 10. Older than an hour shows the clock time instead.
  Widget _waitTime() {
    final placed = widget.order.createdAt ?? widget.order.orderDate;
    if (placed == null) return const SizedBox.shrink();

    final minutes = DateTime.now().difference(placed).inMinutes;
    final color = minutes >= 10
        ? AppColors.error
        : minutes >= 5
        ? AppColors.warning
        : AppColors.grey400;
    final locale = Localizations.localeOf(context).languageCode;
    final label = minutes < 1
        ? context.l10n.justNow
        : minutes < 60
        ? context.l10n.minutesAgo(minutes)
        : DateFormat.jm(locale).format(placed.toLocal());

    return _iconLabel(Icons.schedule_rounded, label, color, bold: true);
  }

  /// Money owed back on a cancelled or reduced paid order: what's still to
  /// hand back (with "Mark refunded"), what was, and a customer's complaint.
  Widget _refundBanner() {
    final o = widget.order;
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (o.refundOwed > 0)
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.returnToCustomer(formatPrice(o.refundOwed)),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (widget.onMarkRefunded != null)
                TextButton(
                  onPressed: widget.onMarkRefunded,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    visualDensity: VisualDensity.compact,
                    minimumSize: const Size(48, 40),
                  ),
                  child: Text(l10n.markRefunded),
                ),
            ],
          )
        else if (o.refundedAmount > 0)
          Text(
            '✓ ${l10n.refundedAmount(formatPrice(o.refundedAmount))}',
            style: AppTextStyles.caption.copyWith(
              color: AppColors.success,
              fontWeight: FontWeight.w600,
            ),
          ),
        if (o.refundFlagged)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              l10n.customerSaysNotRefunded,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _paymentAdjustmentBanner(PaymentAdjustment adjustment) {
    final isCollect = adjustment.action == 'COLLECT';

    return Text(
      isCollect
          ? context.l10n.collectFromCustomer(formatPrice(adjustment.amount))
          : context.l10n.returnToCustomer(formatPrice(adjustment.amount)),
      style: AppTextStyles.caption.copyWith(
        color: isCollect ? AppColors.warning : AppColors.success,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

/// A kitchen ticket's tear line: a dashed rule with a half-circle notch cut
/// into each side (circles in the page colour, clipped by the card).
class _TicketTear extends StatelessWidget {
  const _TicketTear();

  static const double _notch = 22;

  @override
  Widget build(BuildContext context) {
    Widget notch(double? left, double? right) => Positioned(
      left: left,
      right: right,
      top: 0,
      child: Container(
        width: _notch,
        height: _notch,
        decoration: BoxDecoration(
          color: AppColors.background,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.grey200),
        ),
      ),
    );

    return SizedBox(
      height: _notch,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            left: _notch,
            right: _notch,
            child: CustomPaint(painter: _DashPainter(AppColors.grey300)),
          ),
          notch(-_notch / 2, null),
          notch(null, -_notch / 2),
        ],
      ),
    );
  }
}

class _DashPainter extends CustomPainter {
  final Color color;

  const _DashPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    final y = size.height / 2;
    for (var x = 2.0; x < size.width - 2; x += 9) {
      canvas.drawLine(Offset(x, y), Offset(x + 4, y), paint);
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}
