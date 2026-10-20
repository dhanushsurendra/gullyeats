import 'package:flutter/material.dart';

import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';

class CartOption {
  final String id;
  final String cartName;
  final String address;

  const CartOption({
    required this.id,
    required this.cartName,
    required this.address,
  });
}

class SwitchStaffCartSheet extends StatefulWidget {
  final String staffName;
  final String currentCartId;
  final List<CartOption> carts;
  final bool isLoading;
  final void Function(String cartId, String cartName) onConfirm;

  const SwitchStaffCartSheet({
    super.key,
    required this.staffName,
    required this.currentCartId,
    required this.carts,
    required this.onConfirm,
    this.isLoading = false,
  });

  @override
  State<SwitchStaffCartSheet> createState() => _SwitchStaffCartSheetState();
}

class _SwitchStaffCartSheetState extends State<SwitchStaffCartSheet> {
  String? _selectedCartId;

  @override
  void initState() {
    super.initState();

    // Current cart is selected by default.
    _selectedCartId = widget.currentCartId;
  }

  @override
  Widget build(BuildContext context) {
    final isSameCart = _selectedCartId == widget.currentCartId;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),

              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("Switch Cart", style: AppTextStyles.heading2),
                    const SizedBox(height: 4),
                    Text(
                      "Move ${widget.staffName} to a different cart",
                      style: AppTextStyles.caption.copyWith(
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: widget.carts.isEmpty
                    ? Center(
                        child: Text(
                          "No carts available",
                          style: AppTextStyles.body.copyWith(
                            color: Colors.grey.shade500,
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        itemCount: widget.carts.length,
                        itemBuilder: (context, index) {
                          final cart = widget.carts[index];
                          final isSelected = _selectedCartId == cart.id;
                          final isCurrentCart = cart.id == widget.currentCartId;

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: () {
                                setState(() {
                                  _selectedCartId = cart.id;
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: isSelected
                                        ? AppColors.primary
                                        : Colors.grey.shade200,
                                    width: isSelected ? 1.5 : 1,
                                  ),
                                  color: isSelected
                                      ? AppColors.primary.withValues(
                                          alpha: 0.06,
                                        )
                                      : Colors.white,
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  cart.cartName,
                                                  style: AppTextStyles.heading3
                                                      .copyWith(fontSize: 14),
                                                ),
                                              ),

                                              if (isCurrentCart) ...[
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 7,
                                                        vertical: 3,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.primary
                                                        .withValues(alpha: 0.1),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          6,
                                                        ),
                                                  ),
                                                  child: Text(
                                                    "CURRENT",
                                                    style: AppTextStyles.caption
                                                        .copyWith(
                                                          color:
                                                              AppColors.primary,
                                                          fontSize: 9,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                        ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),

                                          const SizedBox(height: 2),

                                          Text(
                                            cart.address,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: AppTextStyles.caption
                                                .copyWith(
                                                  color: Colors.grey.shade600,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),

                                    Icon(
                                      isSelected
                                          ? Icons.radio_button_checked
                                          : Icons.radio_button_off,
                                      color: isSelected
                                          ? AppColors.primary
                                          : Colors.grey.shade400,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),

              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: AppButton(
                      label: "CONFIRM SWITCH",
                      isLoading: widget.isLoading,
                      onPressed: (_selectedCartId == null || isSameCart)
                          ? null
                          : () {
                              final cart = widget.carts.firstWhere(
                                (c) => c.id == _selectedCartId,
                              );

                              widget.onConfirm(cart.id, cart.cartName);
                            },
                      width: double.infinity,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
