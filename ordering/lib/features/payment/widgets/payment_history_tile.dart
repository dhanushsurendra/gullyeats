import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/features/payment/models/payment_model.dart';

/// A payment history transaction tile.
///
/// Collapsed:
/// - Cart name
/// - Number of orders
/// - Payment status
/// - Amount
///
/// Expanded:
/// - Billing date
/// - Payment date/time
/// - Transaction reference
/// - Verification date/time
class PaymentHistoryTile extends StatefulWidget {
  final PaymentModel payment;

  const PaymentHistoryTile({super.key, required this.payment});

  @override
  State<PaymentHistoryTile> createState() => _PaymentHistoryTileState();
}

class _PaymentHistoryTileState extends State<PaymentHistoryTile> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final payment = widget.payment;
    final statusColor = _statusColor(payment.status);

    return Container(
      width: double.infinity,
      padding: AppPadding.card,
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ================================================================
          // PAYMENT SUMMARY
          // ================================================================
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Status spine
              Container(
                width: 4,
                height: 52,
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),

              AppGaps.w12,

              // ============================================================
              // CART + ORDERS + STATUS
              // ============================================================
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Cart name
                    Text(
                      payment.cartName.isNotEmpty
                          ? payment.cartName
                          : 'Payment',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),

                    AppGaps.h4,

                    // Number of orders
                    Row(
                      children: [
                        Icon(
                          Icons.shopping_bag_outlined,
                          size: 15,
                          color: AppColors.grey500,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _orderCountLabel(payment.totalOrders),
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.grey500,
                          ),
                        ),
                      ],
                    ),

                    AppGaps.h8,

                    // Payment status
                    Row(
                      children: [
                        Icon(
                          _statusIcon(payment.status),
                          size: 15,
                          color: statusColor,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _statusLabel(payment.status),
                          style: AppTextStyles.caption.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              AppGaps.w8,

              // ============================================================
              // AMOUNT
              // ============================================================
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '₹${payment.amount.toStringAsFixed(0)}',
                    style: AppTextStyles.heading3.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Platform fee',
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.grey500,
                    ),
                  ),
                ],
              ),

              AppGaps.w8,

              // ============================================================
              // EXPAND / COLLAPSE
              // ============================================================
              IconButton(
                onPressed: () {
                  setState(() {
                    _isExpanded = !_isExpanded;
                  });
                },
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                visualDensity: const VisualDensity(
                  horizontal: -4,
                  vertical: -4,
                ),
                splashRadius: 18,
                icon: AnimatedRotation(
                  turns: _isExpanded ? 0.5 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 25,
                    color: AppColors.grey500,
                  ),
                ),
              ),
            ],
          ),

          // ================================================================
          // EXPANDED DETAILS
          // ================================================================
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 200),
            sizeCurve: Curves.easeInOut,
            firstCurve: Curves.easeOut,
            secondCurve: Curves.easeIn,
            crossFadeState: _isExpanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            firstChild: const SizedBox.shrink(),
            secondChild: _buildExpandedDetails(payment),
          ),
        ],
      ),
    );
  }

  // ==========================================================================
  // EXPANDED DETAILS
  // ==========================================================================

  Widget _buildExpandedDetails(PaymentModel payment) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppGaps.h12,

        Divider(height: 1, color: AppColors.grey200),

        AppGaps.h12,

        // ================================================================
        // BILLING + PAID DATE
        // ================================================================
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _InfoItem(
                icon: Icons.calendar_today_outlined,
                label: 'Billing date',
                value: _formatDate(payment.billingDate),
              ),
            ),

            const SizedBox(width: 12),

            Expanded(
              child: _InfoItem(
                icon: Icons.access_time,
                label: 'Paid on',
                value: _formatDateTime(payment.createdAt),
              ),
            ),
          ],
        ),

        AppGaps.h12,

        // ================================================================
        // TRANSACTION REFERENCE
        // ================================================================
        _TransactionReference(paymentReference: payment.paymentReference),

        // ================================================================
        // VERIFIED DATE
        // ================================================================
        if (payment.isVerified && payment.verifiedAt != null) ...[
          AppGaps.h8,

          _InfoItem(
            icon: Icons.verified_outlined,
            label: 'Verified on',
            value: _formatDateTime(payment.verifiedAt),
          ),
        ],
      ],
    );
  }

  // ==========================================================================
  // ORDER COUNT
  // ==========================================================================

  String _orderCountLabel(int totalOrders) {
    if (totalOrders == 0) {
      return 'No orders';
    }

    if (totalOrders == 1) {
      return '1 order';
    }

    return '$totalOrders orders';
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  Color _statusColor(String status) {
    switch (status) {
      case 'VERIFIED':
        return AppColors.success;

      case 'REJECTED':
      case 'EXPIRED':
        return AppColors.error;

      case 'PENDING':
      default:
        return AppColors.warning;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'VERIFIED':
        return Icons.check_circle_outline;

      case 'REJECTED':
        return Icons.cancel_outlined;

      case 'EXPIRED':
        return Icons.timer_off_outlined;

      case 'PENDING':
      default:
        return Icons.hourglass_empty_rounded;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'VERIFIED':
        return 'Payment Verified';

      case 'REJECTED':
        return 'Payment Rejected';

      case 'EXPIRED':
        return 'Payment Expired';

      case 'PENDING':
      default:
        return 'Verification Pending';
    }
  }

  // ==========================================================================
  // DATE FORMATTING
  // ==========================================================================

  /// Converts a UTC timestamp into the device's local timezone.
  ///
  /// Example:
  /// Backend:
  /// 2026-09-17T06:02:30.863Z
  ///
  /// IST device:
  /// 17 Sep 2026, 11:32 AM
  String _formatDateTime(DateTime? date) {
    if (date == null) {
      return '--';
    }

    final localDate = date.toLocal();

    final hour = localDate.hour == 0
        ? 12
        : localDate.hour > 12
        ? localDate.hour - 12
        : localDate.hour;

    final minute = localDate.minute.toString().padLeft(2, '0');

    final period = localDate.hour >= 12 ? 'PM' : 'AM';

    return '${localDate.day.toString().padLeft(2, '0')} '
        '${_month(localDate.month)} '
        '${localDate.year}, '
        '$hour:$minute $period';
  }

  /// Formats billing date in the device's local timezone.
  String _formatDate(DateTime? date) {
    if (date == null) {
      return '--';
    }

    final localDate = date.toLocal();

    return '${localDate.day.toString().padLeft(2, '0')} '
        '${_month(localDate.month)} '
        '${localDate.year}';
  }

  String _month(int month) {
    const months = [
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

    return months[month - 1];
  }
}

// =============================================================================
// INFO ITEM
// =============================================================================

class _InfoItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.grey500),

        const SizedBox(width: 7),

        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
              ),

              const SizedBox(height: 2),

              Text(
                value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// =============================================================================
// TRANSACTION REFERENCE
// =============================================================================

class _TransactionReference extends StatelessWidget {
  final String paymentReference;

  const _TransactionReference({required this.paymentReference});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.receipt_long_outlined, size: 16, color: AppColors.grey500),

        const SizedBox(width: 7),

        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Transaction reference',
                style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
              ),

              const SizedBox(height: 2),

              Text(
                paymentReference.isNotEmpty ? paymentReference : '--',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
