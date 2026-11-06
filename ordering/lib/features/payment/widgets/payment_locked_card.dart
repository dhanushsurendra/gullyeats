import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/utils/format_price.dart';

/// Warning card shown when the cart's platform fee is unpaid, with the
/// primary "PAY & UNLOCK" call to action.
class PaymentLockedCard extends StatelessWidget {
  final num amountDue;
  final int totalOrders;
  final num feePerOrder;
  final bool isLoading;
  final VoidCallback onPayPressed;

  const PaymentLockedCard({
    super.key,
    required this.amountDue,
    required this.totalOrders,
    required this.feePerOrder,
    required this.onPayPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_clock_rounded, color: AppColors.warning, size: 20),
              AppGaps.w8,
              Expanded(
                child: Text(
                  context.l10n.platformFeePending,
                  style: AppTextStyles.heading3.copyWith(color: AppColors.warning),
                ),
              ),
            ],
          ),
          AppGaps.h8,
          Text(
            context.l10n.cartLockedFeePending,
            style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
          ),
          AppGaps.h16,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.amountDue,
                      style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
                    ),
                    Text(
                      "₹${amountDue.toStringAsFixed(0)}",
                      style: AppTextStyles.heading2,
                    ),
                  ],
                ),
                Text(
                  context.l10n.ordersTimesFee(totalOrders, formatPrice(feePerOrder)),
                  style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
                ),
              ],
            ),
          ),
          AppGaps.h16,
          AppButton(
            label: context.l10n.payAndUnlock(amountDue.toStringAsFixed(0)),
            isLoading: isLoading,
            onPressed: isLoading ? null : onPayPressed,
          ),
        ],
      ),
    );
  }
}