import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/features/orders/models/order_model.dart';

class OrderCard extends StatefulWidget {
  final OrderModel order;
  final VoidCallback onServe;
  final VoidCallback onMarkPaid;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const OrderCard({
    super.key,
    required this.order,
    required this.onServe,
    required this.onTap,
    required this.onDelete,
    required this.onMarkPaid,
  });

  @override
  State<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<OrderCard> {
  @override
  void initState() {
    super.initState();
  }

  Future<bool?> _showDeleteDialog(BuildContext context) {
    return showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete Order', style: AppTextStyles.heading2),
          content: const Text(
            'Are you sure you want to delete this order?',
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
                'Cancel',
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
              child: const Text(
                'Delete',
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
    final isPaid = widget.order.isPaid;
    final isServed = widget.order.status == "SERVED";
    final isCancelled = widget.order.status == "CANCELLED";

    return GestureDetector(
      onTap: widget.onTap,
      child: AppCard(
        padding: AppPadding.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "#${widget.order.orderNumber}",
                  style: AppTextStyles.heading2,
                ),
                if (isCancelled)
                  _statusChip("CANCELED", false)
                else if (isServed)
                  _statusChip("SERVED", true)
                else if (isPaid)
                  _actionButton("SERVE", widget.onServe)
                else
                  _outlineButton("MARK PAID", widget.onMarkPaid),
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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "₹${widget.order.totalPrice.toStringAsFixed(0)}",
                  style: AppTextStyles.heading2,
                ),
                Row(
                  children: [
                    if (!isCancelled)
                      _statusChip(isPaid ? "PAID" : "UNPAID", isPaid),
                    AppGaps.w8,
                    _tagChip(widget.order.isQrOrder ? "QR Order" : "Manual"),
                    AppGaps.w8,
                    ((widget.order.status == "CANCELLED") |
                            (widget.order.status == "SERVED"))
                        ? SizedBox.shrink()
                        : InkWell(
                            onTap: () => _showDeleteDialog(context),
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(30),
                                color: AppColors.grey100,
                              ),
                              child: Icon(
                                Icons.delete_outline,
                                color: Colors.red,
                                size: 20,
                              ),
                            ),
                          ),
                  ],
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
      ),
    );
  }

  Widget _paymentAdjustmentBanner(PaymentAdjustment adjustment) {
    final isCollect = adjustment.action == 'COLLECT';

    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(
        isCollect
            ? "Collect ₹${adjustment.amount.toStringAsFixed(0)} from customer"
            : "Return ₹${adjustment.amount.toStringAsFixed(0)} to customer",
        style: AppTextStyles.caption.copyWith(
          color: isCollect ? Colors.orange[800] : AppColors.success,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  String _buildItemsText(OrderModel order) {
    final items = order.orderItems;

    if (items.isEmpty) return "No items";

    if (items.length <= 2) {
      return items.map((i) => "${i.name} x${i.quantity}").join(" • ");
    }

    return "${items[0].name} x${items[0].quantity} • "
        "${items[1].name} x${items[1].quantity}  "
        "+${items.length - 2} more";
  }

  Widget _actionButton(String text, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: AppPadding.chip,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          text,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _outlineButton(String text, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: AppPadding.chip,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary),
        ),
        child: Text(
          text,
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
