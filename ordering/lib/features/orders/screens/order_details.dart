import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/features/orders/models/order_model.dart';

class OrderDetailsSheet extends StatefulWidget {
  final OrderModel order;

  const OrderDetailsSheet({super.key, required this.order});

  @override
  State<OrderDetailsSheet> createState() => _OrderDetailsSheetState();
}

class _OrderDetailsSheetState extends State<OrderDetailsSheet> {
  late List items;

  @override
  void initState() {
    super.initState();
    items = widget.order.orderItems.map((e) {
      return {"name": e.name, "price": e.price, "qty": e.quantity};
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.grey300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),

                Padding(
                  padding: AppPadding.horizontalScreen,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Order Details", style: AppTextStyles.heading2),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close, color: AppColors.grey600),
                      ),
                    ],
                  ),
                ),
                Divider(color: AppColors.grey300),
                AppGaps.h8,
                Expanded(
                  child: ListView(
                    controller: controller,
                    padding: AppPadding.horizontalScreen,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "#${widget.order.orderNumber}",
                            style: AppTextStyles.heading1,
                          ),
                          Container(
                            padding: AppPadding.chip,
                            decoration: BoxDecoration(
                              color: AppColors.lightOrange,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              widget.order.isQrOrder ? "QR Order" : "Manual",
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),

                      AppGaps.h16,
                      ...items.map((item) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _itemRow(item),
                        );
                      }),
                      AppGaps.h16,
                      AppButton(
                        label: "+ ADD ITEM",
                        onPressed: () {
                          Navigator.pushNamed(context, '/add-item');
                        },
                      ),
                      AppGaps.h16,
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            "Parcel Packaging (+₹10)",
                            style: AppTextStyles.body,
                          ),
                        ],
                      ),
                      AppGaps.h16,
                      Container(
                        padding: AppPadding.card,
                        decoration: BoxDecoration(
                          color: AppColors.grey100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            _billRow("Subtotal", widget.order.subtotal),
                            _billRow("Platform Fee", widget.order.platformFee),
                            // _billRow(
                            //   "Parcel",
                            //   _isParcel ? widget.order.parcelCharge : 0,
                            // ),
                            AppGaps.h8,
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text("TOTAL", style: AppTextStyles.heading3),
                                Text(
                                  "₹${(widget.order.totalPrice).toInt()}",
                                  style: AppTextStyles.heading3.copyWith(
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      SizedBox(height: screenHeight * 0.1),
                    ],
                  ),
                ),
                Padding(
                  padding: AppPadding.screen,
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {},
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: AppColors.error),
                            padding: AppPadding.button,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.delete_outline,
                                color: AppColors.error,
                              ),
                              AppGaps.w8,
                              Text(
                                "DELETE",
                                style: TextStyle(
                                  color: AppColors.error,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      AppGaps.w12,
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {},
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: AppPadding.button,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30),
                            ),
                          ),
                          child: Text(
                            "SAVE CHANGES",
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _itemRow(Map item) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item["name"],
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
              ),
              Text("₹${item["price"]}", style: AppTextStyles.caption),
            ],
          ),
        ),
        Row(
          children: [
            _circleBtn(Icons.remove, () {
              setState(() => item["qty"]--);
            }),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text("${item["qty"]}", style: AppTextStyles.body),
            ),
            _circleBtn(Icons.add, () {
              setState(() => item["qty"]++);
            }),
          ],
        ),
      ],
    );
  }

  Widget _circleBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.grey300),
        ),
        child: Icon(icon, size: 16),
      ),
    );
  }

  Widget _billRow(String title, double value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: AppTextStyles.caption),
          Text("₹${value.toInt()}", style: AppTextStyles.caption),
        ],
      ),
    );
  }
}


//                          Switch(
//                             value: _isParcel,
//                             onChanged: (val) {
//                               setState(() {
//                                 _isParcel = val;
//                               });
//                             },

//                             thumbColor: WidgetStateProperty.resolveWith((
//                               states,
//                             ) {
//                               if (states.contains(WidgetState.selected)) {
//                                 return AppColors.white;
//                               }
//                               return AppColors.white;
//                             }),

//                             trackColor: WidgetStateProperty.resolveWith((
//                               states,
//                             ) {
//                               if (states.contains(WidgetState.selected)) {
//                                 return AppColors.primary;
//                               }
//                               return AppColors.grey300;
//                             }),

//                             trackOutlineColor: WidgetStateProperty.all(
//                               Colors.transparent,
//                             ),
//                           ),