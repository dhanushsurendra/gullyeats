import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/l10n/l10n.dart';

/// The open platform-fee bill on Payments history, so a vendor who closed
/// the Home warning can still pay: what the bill covers and Pay now. Shown
/// only while a bill can be paid.
class FeeDueCard extends StatelessWidget {
  final PaymentStatusModel status;
  final VoidCallback onPay;

  const FeeDueCard({super.key, required this.status, required this.onPay});

  static bool shows(PaymentStatusModel? s) =>
      s != null && s.canPay && s.totalPending > 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).languageCode;
    final due = status.dueAt;
    final billed = status.billingDate;
    final note = status.isLocked
        ? l10n.cartLockedFeePending
        : due != null
        ? l10n.feeLocksAt(DateFormat.jm(locale).format(due.toLocal()))
        : null;

    return AppCard(
      padding: const EdgeInsets.all(16),
      border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.lightOrange,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 22,
                  color: AppColors.primary,
                ),
              ),
              AppGaps.w12,
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.platformFeePending,
                      style: AppTextStyles.heading3,
                    ),
                    if (note != null) Text(note, style: AppTextStyles.caption),
                  ],
                ),
              ),
            ],
          ),
          AppGaps.h16,
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Figure(l10n.orders, '${status.totalOrders}'),
                if (billed != null) ...[
                  AppGaps.w8,
                  _Figure(
                    l10n.billingDate,
                    DateFormat.MMMd(locale).format(billed.toLocal()),
                  ),
                ],
                AppGaps.w8,
                _Figure(
                  l10n.amountDue,
                  '₹${formatPrice(status.totalPending)}',
                  strong: true,
                ),
              ],
            ),
          ),
          AppGaps.h16,
          AppButton(label: l10n.payNowCaps, onPressed: onPay),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  final String label;
  final String value;
  final bool strong;

  const _Figure(this.label, this.value, {this.strong = false});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: strong ? AppColors.lightOrange : AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Shrinks rather than breaking at large system text.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.center,
            child: Text(
              value,
              style: AppTextStyles.heading3.copyWith(
                color: strong ? AppColors.primary : AppColors.black,
              ),
            ),
          ),
          Text(
            label,
            style: AppTextStyles.caption,
            maxLines: 2,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}
