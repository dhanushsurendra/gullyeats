import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

/// Stat grid for the payments overview — same white-card / border / shadow
/// treatment as the Orders Overview screen's summary card.
class PaymentSummaryCard extends StatelessWidget {
  final int totalOrders;
  final num totalPlatformFee;
  final num totalPaid;
  final num totalPending;

  const PaymentSummaryCard({
    super.key,
    required this.totalOrders,
    required this.totalPlatformFee,
    required this.totalPaid,
    required this.totalPending,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: AppPadding.card,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
        boxShadow: [
          BoxShadow(
            color: AppColors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: _stat("Total Orders", "$totalOrders")),
              Expanded(child: _stat("Platform Fee", _money(totalPlatformFee))),
            ],
          ),
          AppGaps.h16,
          Row(
            children: [
              Expanded(
                child: _stat("Paid", _money(totalPaid), color: AppColors.success),
              ),
              Expanded(
                child: _stat(
                  "Pending",
                  _money(totalPending),
                  color: totalPending > 0 ? AppColors.warning : AppColors.grey500,
                ),
              ),
            ],
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
          style: AppTextStyles.heading3.copyWith(color: color ?? AppColors.black),
        ),
      ],
    );
  }

  String _money(num value) => "₹${value.toStringAsFixed(0)}";
}