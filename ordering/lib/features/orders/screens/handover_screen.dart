import 'package:ordering/core/widgets/app_logo.dart';
import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/l10n/l10n.dart';

/// Today's money in short, for staff in place of the owner's Sales tab:
/// what to hand over at the end of a shift. Built from the live list of
/// today's orders the Orders tab already keeps.
class HandoverScreen extends StatelessWidget {
  const HandoverScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final t = Handover.of(context.watch<OrderProvider>().orders, clock.now());

    return BaseScreen(
      showBackButton: false,
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppLogo(),
          AppGaps.h24,
          Text(l10n.handoverTitle, style: AppTextStyles.heading1),
          AppGaps.h4,
          Text(
            l10n.handoverSubtitle,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
        ],
      ),
      expandToFullHeight: true,
      child: ListView(
        // Room for the floating bottom navigation bar.
        padding: const EdgeInsets.only(bottom: 120),
        children: [
          Container(
            width: double.infinity,
            padding: AppPadding.card,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              color: AppColors.primary,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.collected,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.white.withValues(alpha: 0.85),
                  ),
                ),
                AppGaps.h8,
                Text(
                  _money(t.collected),
                  style: AppTextStyles.heading1.copyWith(
                    color: AppColors.white,
                  ),
                ),
                Text(
                  l10n.orderCount(t.collectedOrders),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.white.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
          AppGaps.h16,
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _row(l10n.toCollect, t.toCollect, t.unpaidOrders, l10n),
                Divider(height: 24, color: AppColors.grey200),
                _row(l10n.refunded, t.refunded, t.refundedOrders, l10n),
                Divider(height: 24, color: AppColors.grey200),
                // Still in the drawer but owed back: "Mark refunded" on the order once handed over.
                _row(l10n.toRefund, t.toRefund, t.toRefundOrders, l10n),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, double amount, int orders, AppLocalizations l10n) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
              ),
              Text(
                l10n.orderCount(orders),
                style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
              ),
            ],
          ),
        ),
        AppGaps.w12,
        Text(_money(amount), style: AppTextStyles.heading3),
      ],
    );
  }

  static String _money(num value) => "₹${formatPrice(value)}";
}

/// Today's totals from the order list.
class Handover {
  /// Money in hand: what's been paid on orders that still stand. Cancelled
  /// orders are out, since their money was given back.
  final double collected;
  final int collectedOrders;

  /// Still owed on open orders, including extras added after payment.
  final double toCollect;
  final int unpaidOrders;

  /// Handed back (marked refunded) on cancelled or reduced paid orders.
  final double refunded;
  final int refundedOrders;

  /// Owed back on cancelled or reduced paid orders, not yet marked refunded.
  final double toRefund;
  final int toRefundOrders;

  const Handover({
    this.collected = 0,
    this.collectedOrders = 0,
    this.toCollect = 0,
    this.unpaidOrders = 0,
    this.refunded = 0,
    this.refundedOrders = 0,
    this.toRefund = 0,
    this.toRefundOrders = 0,
  });

  factory Handover.of(List<OrderModel> orders, DateTime now) {
    var collected = 0.0, toCollect = 0.0, refunded = 0.0, toRefund = 0.0;
    var collectedOrders = 0, unpaidOrders = 0, refundedOrders = 0, toRefundOrders = 0;

    for (final o in orders) {
      // The list can still hold yesterday's orders if the app stayed open
      // past midnight.
      final at = (o.createdAt ?? o.orderDate)?.toLocal();
      if (at == null || !DateUtils.isSameDay(at, now)) continue;

      if (o.refundedAmount > 0) {
        refunded += o.refundedAmount;
        refundedOrders++;
      }
      if (o.refundOwed > 0) {
        toRefund += o.refundOwed;
        toRefundOrders++;
      }
      if (o.status == "CANCELLED") continue;
      // Served orders from before the server stored paidAmount read as 0.
      final paid = o.paidAmount > 0
          ? o.paidAmount
          : (o.status == "SERVED" ? o.totalPrice : 0.0);
      if (paid > 0) {
        collected += paid;
        collectedOrders++;
      }
      if (o.status == "PENDING") {
        toCollect += o.totalPrice - paid;
        unpaidOrders++;
      }
    }

    return Handover(
      collected: collected,
      collectedOrders: collectedOrders,
      toCollect: toCollect,
      unpaidOrders: unpaidOrders,
      refunded: refunded,
      refundedOrders: refundedOrders,
      toRefund: toRefund,
      toRefundOrders: toRefundOrders,
    );
  }
}
