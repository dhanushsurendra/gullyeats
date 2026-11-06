import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/utils/format_price.dart';

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
  // Shows a tick in place of SERVE / MARK PAID while the request runs.
  bool _done = false;

  void _confirm(VoidCallback action) {
    HapticFeedback.mediumImpact();
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
              onPressed: () {
                Navigator.pop(context, false);
              },
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                context.l10n.cancel,
                style: AppTextStyles.caption.copyWith(
                  color: Colors.grey[700],
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
                backgroundColor: Colors.red,
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
                style: TextStyle(
                  color: Colors.white,
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
    final l10n = context.l10n;
    final isPaid = widget.order.isPaid;
    // Status codes from the server, never the translated labels.
    final isServed = widget.order.status == "SERVED";
    final isCancelled = widget.order.status == "CANCELLED";

    final isActive =
        widget.order.status == "PENDING" || widget.order.status == "PAID";

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
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: widget.onTap,
              child: AppCard(
                padding: const EdgeInsets.all(16),
                color: Color.lerp(AppColors.white, AppColors.lightOrange, glow),
                border: Border.all(
                  color: Color.lerp(AppColors.grey200, AppColors.primary, glow)!,
                  width: 1 + glow,
                ),
                child: child!,
              ),
            ),
          ),
        ),
      ),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "#${widget.order.orderNumber}",
                        style: AppTextStyles.heading2,
                      ),
                      if (isActive) _waitTime(),
                    ],
                  ),
                ),
                AppGaps.w8,
                // Capped, so a long translation wraps instead of squeezing
                // the order number.
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 150),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 250),
                    transitionBuilder: (child, animation) =>
                        ScaleTransition(scale: animation, child: child),
                    child: isCancelled
                        ? _statusChip(l10n.cancelled.toUpperCase(), false)
                        : isServed
                        ? _statusChip(l10n.served.toUpperCase(), true)
                        : _done
                        ? const Icon(
                            Icons.check_circle,
                            key: ValueKey('done'),
                            color: AppColors.success,
                            size: 36,
                          )
                        : isPaid
                        ? _actionButton(
                            l10n.serve.toUpperCase(),
                            () => _confirm(widget.onServe),
                          )
                        : _outlineButton(
                            l10n.markPaidCaps,
                            () => _confirm(widget.onMarkPaid),
                          ),
                  ),
                ),
              ],
            ),
            AppGaps.h12,
            Text(
              _buildItemsText(widget.order),
              style: AppTextStyles.body.copyWith(
                height: 1.4,
                fontWeight: FontWeight.w500,
              ),
            ),
            AppGaps.h16,
            Row(
              children: [
                Text(
                  "₹${formatPrice(widget.order.totalPrice)}",
                  style: AppTextStyles.heading2,
                ),
                AppGaps.w12,
                // Wrap: the chips drop to a new line instead of overflowing.
                Expanded(
                  child: Wrap(
                    alignment: WrapAlignment.end,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (!isCancelled)
                        _statusChip(
                          isPaid ? l10n.paid.toUpperCase() : l10n.unpaid.toUpperCase(),
                          isPaid,
                        ),
                      _tagChip(widget.order.isQrOrder ? l10n.qrOrder : l10n.manual),
                      if (!isCancelled && !isServed)
                        Material(
                          color: AppColors.grey100,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _showDeleteDialog(context),
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
                    ],
                  ),
                ),
              ],
            ),
            if (widget.order.paymentAdjustment != null &&
                widget.order.paymentAdjustment!.action != 'NONE') ...[
              AppGaps.h12,
              _paymentAdjustmentBanner(widget.order.paymentAdjustment!),
            ],
          ],
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

    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Icon(Icons.schedule, size: 14, color: color),
          AppGaps.w4,
          Flexible(
            child: Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentAdjustmentBanner(PaymentAdjustment adjustment) {
    final isCollect = adjustment.action == 'COLLECT';

    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(
        isCollect
            ? context.l10n.collectFromCustomer(formatPrice(adjustment.amount))
            : context.l10n.returnToCustomer(formatPrice(adjustment.amount)),
        style: AppTextStyles.caption.copyWith(
          color: isCollect ? AppColors.warning : AppColors.success,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  String _buildItemsText(OrderModel order) {
    final items = order.orderItems;

    if (items.isEmpty) return context.l10n.noItems;

    if (items.length <= 2) {
      return items.map((i) => "${i.name} x${i.quantity}").join(" • ");
    }

    return "${items[0].name} x${items[0].quantity} • "
        "${items[1].name} x${items[1].quantity}  "
        "${context.l10n.moreItems(items.length - 2)}";
  }

  Widget _actionButton(String text, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 36),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _outlineButton(String text, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 36),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _statusChip(String text, bool isSuccess) {
    return Container(
      padding: AppPadding.chip,
      decoration: BoxDecoration(
        color: isSuccess
            ? AppColors.success.withValues(alpha: 0.15)
            : AppColors.lightOrange,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: AppTextStyles.caption.copyWith(
          color: isSuccess ? AppColors.success : AppColors.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _tagChip(String text) {
    return Container(
      padding: AppPadding.chip,
      decoration: BoxDecoration(
        color: AppColors.grey200,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
      ),
    );
  }
}
