import 'package:flutter/material.dart';
import 'package:ordering/core/utils/order_alerts.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
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

  /// Just arrived live: the card slides in and glows briefly.
  final bool isFresh;

  const OrderCard({
    super.key,
    required this.order,
    required this.onServe,
    required this.onTap,
    required this.onDelete,
    required this.onMarkPaid,
    this.isFresh = false,
  });

  @override
  State<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<OrderCard> {
  // True from the tap until the server answers: SERVE shows "SERVED",
  // MARK PAID shows a spinner.
  bool _done = false;

  // Item lines shown before "+N more".
  static const _visibleItems = 3;

  @override
  void didUpdateWidget(OrderCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The server answered: the new stage's button starts fresh.
    if (oldWidget.order.status != widget.order.status) _done = false;
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

    return TweenAnimationBuilder<double>(
      // 1 → 0: the fresh-order glow fades out.
      tween: Tween(begin: widget.isFresh ? 1 : 0, end: 0),
      duration: const Duration(seconds: 4),
      curve: Curves.easeIn,
      builder: (context, glow, child) => TweenAnimationBuilder<double>(
        tween: Tween(begin: widget.isFresh ? 1 : 0, end: 0),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
        builder: (context, slide, _) => Opacity(
          opacity: 1 - slide,
          child: Transform.translate(
            offset: Offset(0, -24 * slide),
            child: Material(
              color: Color.lerp(AppColors.white, AppColors.lightOrange, glow),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                  color: Color.lerp(AppColors.grey200, AppColors.primary, glow)!,
                  width: 1 + glow,
                ),
              ),
              clipBehavior: Clip.antiAlias,
              child: InkWell(onTap: widget.onTap, child: child),
            ),
          ),
        ),
      ),
      // A Stack, not IntrinsicHeight: the stage-coloured edge stretches to
      // whatever height the content takes.
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            child: ColoredBox(color: color),
          ),
          Padding(
            padding: AppPadding.card.add(const EdgeInsets.only(left: 5, top: 4, bottom: 4)),
            // Cancelled orders stay readable but step back.
            child: Opacity(
              opacity: isCancelled ? 0.6 : 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _topRow(color, isActive),
                  AppGaps.h12,
                  ..._itemLines(),
                  AppGaps.h12,
                  const Divider(height: 1, color: AppColors.grey200),
                  AppGaps.h12,
                  _bottomRow(),
                  if (widget.order.paymentAdjustment != null &&
                      widget.order.paymentAdjustment!.action != 'NONE') ...[
                    AppGaps.h8,
                    _paymentAdjustmentBanner(widget.order.paymentAdjustment!),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------
  // Top row: number badge, source, wait time, delete
  // ---------------------------------------------------------------------

  Widget _topRow(Color color, bool isActive) {
    final l10n = context.l10n;
    final isQr = widget.order.isQrOrder;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            "#${widget.order.orderNumber}",
            style: AppTextStyles.heading3.copyWith(color: color),
          ),
        ),
        AppGaps.w12,
        // Wrap: the wait time drops below the source on narrow screens.
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
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
        ),
        if (isActive)
          Material(
            color: AppColors.grey100,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _showDeleteDialog(context),
              child: Semantics(
                label: l10n.deleteOrder,
                button: true,
                child: const SizedBox(
                  width: 36,
                  height: 36,
                  child: Icon(
                    Icons.delete_outline,
                    color: AppColors.error,
                    size: 20,
                  ),
                ),
              ),
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

    return [
      for (final item in items.take(_visibleItems))
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                constraints: const BoxConstraints(minWidth: 34),
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.grey100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "${item.quantity}×",
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.black,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              AppGaps.w8,
              Expanded(
                child: Text(
                  item.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.black,
                    fontWeight: FontWeight.w500,
                    decoration: widget.order.status == "CANCELLED"
                        ? TextDecoration.lineThrough
                        : null,
                  ),
                ),
              ),
            ],
          ),
        ),
      if (items.length > _visibleItems)
        Padding(
          padding: const EdgeInsets.only(left: 42),
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
    final l10n = context.l10n;
    final status = widget.order.status;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.total,
                style: AppTextStyles.caption.copyWith(color: AppColors.grey400),
              ),
              Text(
                "₹${formatPrice(widget.order.totalPrice)}",
                style: AppTextStyles.heading2,
              ),
            ],
          ),
        ),
        AppGaps.w12,
        // Capped, so a long translation wraps instead of squeezing the total.
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 170),
          // Stage changes cross-fade; while saving, the button itself changes.
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: switch (status) {
              "CANCELLED" => _statusChip(
                Icons.block_rounded,
                l10n.cancelled.toUpperCase(),
                AppColors.error,
              ),
              "SERVED" => _statusChip(
                Icons.check_circle_rounded,
                l10n.served.toUpperCase(),
                AppColors.success,
              ),
              // Turns green and says SERVED straight away; the card then
              // moves to the Served group when the server confirms.
              "PAID" => _actionButton(
                key: const ValueKey('serve'),
                icon: _done ? Icons.check_rounded : Icons.room_service_rounded,
                label: _done
                    ? l10n.served.toUpperCase()
                    : l10n.serve.toUpperCase(),
                color: _done ? AppColors.success : AppColors.primary,
                filled: true,
                onTap: _done ? null : () => _confirm(widget.onServe, OrderAlerts.served),
              ),
              _ => _actionButton(
                key: const ValueKey('paid'),
                icon: Icons.currency_rupee_rounded,
                label: l10n.markPaidCaps,
                color: AppColors.primary,
                filled: false,
                busy: _done,
                onTap: _done ? null : () => _confirm(widget.onMarkPaid, OrderAlerts.paid),
              ),
            },
          ),
        ),
      ],
    );
  }

  /// A pill button. Colour changes animate, and [busy] swaps the icon for a
  /// small spinner while the request runs.
  Widget _actionButton({
    required Key key,
    required IconData icon,
    required String label,
    required Color color,
    required bool filled,
    required VoidCallback? onTap,
    bool busy = false,
  }) {
    final fg = filled ? AppColors.white : color;

    return InkWell(
      key: key,
      borderRadius: BorderRadius.circular(26),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
        // A min height (not fixed), so large system text still fits.
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: filled ? color : AppColors.lightOrange,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: color),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: busy
                    ? CircularProgressIndicator(
                        key: const ValueKey('busy'),
                        strokeWidth: 2,
                        color: fg,
                      )
                    : Icon(icon, key: ValueKey(icon), size: 18, color: fg),
              ),
            ),
            AppGaps.w8,
            Flexible(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Text(
                  label,
                  key: ValueKey(label),
                  textAlign: TextAlign.center,
                  style: AppTextStyles.caption.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(IconData icon, String text, Color color) {
    return Container(
      key: ValueKey(text),
      padding: AppPadding.chip,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: _iconLabel(icon, text, color, bold: true),
    );
  }

  Widget _iconLabel(IconData icon, String text, Color color, {bool bold = false}) {
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
