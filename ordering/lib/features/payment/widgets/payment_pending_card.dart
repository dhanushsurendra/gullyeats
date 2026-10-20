import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';

/// Shown after the vendor returns from the UPI app. The backend has not
/// verified the payment yet — this card never claims success, only that
/// verification is in progress, and the cart stays locked underneath it.
class PaymentPendingCard extends StatelessWidget {
  final num amount;
  final int totalOrders;
  final bool isChecking;
  final VoidCallback onCheckStatus;

  const PaymentPendingCard({
    super.key,
    required this.amount,
    required this.totalOrders,
    required this.onCheckStatus,
    this.isChecking = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              AppGaps.w12,
              Expanded(child: Text("Payment Submitted", style: AppTextStyles.heading3)),
            ],
          ),
          AppGaps.h8,
          Text(
            "Your payment has been submitted and is waiting for verification.",
            style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
          ),
          AppGaps.h16,
          Row(
            children: [
              Expanded(child: _stat("Amount", "₹${amount.toStringAsFixed(0)}")),
              Expanded(child: _stat("Orders", "$totalOrders")),
              Expanded(
                child: _stat("Status", "Verification Pending", color: AppColors.warning),
              ),
            ],
          ),
          AppGaps.h16,
          AppButton(
            label: "CHECK PAYMENT STATUS",
            isLoading: isChecking,
            onPressed: isChecking ? null : onCheckStatus,
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTextStyles.caption.copyWith(color: AppColors.grey500)),
        AppGaps.h4,
        Text(
          value,
          style: AppTextStyles.body.copyWith(
            fontWeight: FontWeight.w700,
            color: color ?? AppColors.black,
          ),
        ),
      ],
    );
  }
}