// import 'package:flutter/material.dart';
// import 'package:ordering/core/theme/app_colors.dart';
// import 'package:ordering/core/theme/app_gaps.dart';
// import 'package:ordering/core/theme/app_padding.dart';
// import 'package:ordering/core/theme/app_text_styles.dart';
// import 'package:ordering/core/widgets/app_button.dart';
// import 'package:ordering/features/payment/models/payment_model.dart';
// import 'package:ordering/features/payment/models/payment_overview_model.dart';

// /// Only ever pushed after the backend has returned status VERIFIED for
// /// [payment] — never reachable from a UPI-app return alone.
// class PaymentSuccessScreen extends StatelessWidget {
//   final PaymentModel payment;
//   final PaymentOverviewModel? overview;

//   const PaymentSuccessScreen({super.key, required this.payment, this.overview});

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       backgroundColor: AppColors.grey100,
//       body: SafeArea(
//         child: Column(
//           children: [
//             _topBar(context),
//             Expanded(
//               child: SingleChildScrollView(
//                 padding: AppPadding.screen,
//                 child: Column(
//                   children: [
//                     AppGaps.h16,
//                     _checkBadge(),
//                     AppGaps.h16,
//                     Text("Payment Received", style: AppTextStyles.heading2),
//                     AppGaps.h4,
//                     Text(
//                       "Your store has been unlocked.",
//                       style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
//                     ),
//                     AppGaps.h24,
//                     _summaryCard(),
//                     AppGaps.h16,
//                     _achievementCard(),
//                     AppGaps.h32,
//                     AppButton(
//                       label: "GO TO ORDERS",
//                       onPressed: () => Navigator.popUntil(context, (route) => route.isFirst),
//                     ),
//                     AppGaps.h12,
//                     SizedBox(
//                       width: double.infinity,
//                       height: 52,
//                       child: OutlinedButton(
//                         onPressed: () => Navigator.pop(context),
//                         style: OutlinedButton.styleFrom(
//                           shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
//                           side: const BorderSide(color: AppColors.primary),
//                         ),
//                         child: Text(
//                           "VIEW PAYMENT DETAILS",
//                           style: AppTextStyles.body.copyWith(
//                             color: AppColors.primary,
//                             fontWeight: FontWeight.w700,
//                           ),
//                         ),
//                       ),
//                     ),
//                     AppGaps.h24,
//                   ],
//                 ),
//               ),
//             ),
//           ],
//         ),
//       ),
//     );
//   }

//   Widget _topBar(BuildContext context) {
//     return Padding(
//       padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
//       child: Row(
//         children: [
//           GestureDetector(
//             onTap: () => Navigator.pop(context),
//             child: Container(
//               width: 36,
//               height: 36,
//               decoration: const BoxDecoration(color: AppColors.white, shape: BoxShape.circle),
//               child: const Icon(Icons.arrow_back, size: 18),
//             ),
//           ),
//           Expanded(
//             child: Center(child: Text("Payment Successful", style: AppTextStyles.heading3)),
//           ),
//           const SizedBox(width: 36),
//         ],
//       ),
//     );
//   }

//   Widget _checkBadge() {
//     return Container(
//       width: 84,
//       height: 84,
//       decoration: BoxDecoration(
//         color: AppColors.success.withValues(alpha: 0.12),
//         shape: BoxShape.circle,
//       ),
//       child: Center(
//         child: Container(
//           width: 56,
//           height: 56,
//           decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
//           child: const Icon(Icons.check_rounded, color: Colors.white, size: 32),
//         ),
//       ),
//     );
//   }

//   Widget _summaryCard() {
//     return Container(
//       width: double.infinity,
//       padding: AppPadding.card,
//       decoration: BoxDecoration(
//         color: AppColors.white,
//         borderRadius: BorderRadius.circular(16),
//         border: Border.all(color: AppColors.grey200),
//       ),
//       child: Column(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           Text("Payment Summary", style: AppTextStyles.heading3),
//           AppGaps.h16,
//           _row("Outlet", payment.cartName),
//           AppGaps.h12,
//           _row("Orders Completed", "${payment.totalOrders}"),
//           AppGaps.h12,
//           _row("Amount Paid", "₹${payment.amount.toStringAsFixed(0)}", valueColor: AppColors.success),
//           AppGaps.h12,
//           _row("Transaction ID", payment.upiTransactionReference ?? payment.paymentReference),
//           AppGaps.h12,
//           _row("Paid via", "UPI"),
//         ],
//       ),
//     );
//   }

//   Widget _row(String label, String value, {Color? valueColor}) {
//     return Row(
//       mainAxisAlignment: MainAxisAlignment.spaceBetween,
//       children: [
//         Text(label, style: AppTextStyles.caption.copyWith(color: AppColors.grey500)),
//         AppGaps.w16,
//         Flexible(
//           child: Text(
//             value,
//             textAlign: TextAlign.right,
//             overflow: TextOverflow.ellipsis,
//             style: AppTextStyles.body.copyWith(
//               fontWeight: FontWeight.w700,
//               color: valueColor ?? AppColors.black,
//             ),
//           ),
//         ),
//       ],
//     );
//   }

//   Widget _achievementCard() {
//     return Container(
//       width: double.infinity,
//       padding: AppPadding.card,
//       decoration: BoxDecoration(
//         color: AppColors.warning.withValues(alpha: 0.08),
//         borderRadius: BorderRadius.circular(16),
//         border: Border.all(color: AppColors.warning.withValues(alpha: 0.2)),
//       ),
//       child: Column(
//         crossAxisAlignment: CrossAxisAlignment.start,
//         children: [
//           Row(
//             children: [
//               const Text("🎉", style: TextStyle(fontSize: 18)),
//               AppGaps.w8,
//               Text("Today's Achievement", style: AppTextStyles.heading3),
//             ],
//           ),
//           AppGaps.h8,
//           Text(
//             "You completed ${payment.totalOrders} orders and earned "
//             "₹${payment.amount.toStringAsFixed(0)} — nice work keeping the cart running!",
//             style: AppTextStyles.caption.copyWith(color: AppColors.grey600),
//           ),
//         ],
//       ),
//     );
//   }
// }