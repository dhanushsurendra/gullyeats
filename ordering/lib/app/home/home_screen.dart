import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/app/home/widgets/bottom_nav_bar.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/utils/payment_lock.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/presentation/sales_screen.dart';
import 'package:ordering/features/orders/screens/handover_screen.dart';
import 'package:ordering/features/orders/screens/orders_screen.dart';
import 'package:ordering/features/payment/models/payment_status_model.dart';
import 'package:ordering/features/payment/presentation/payment_lock_screen.dart';
import 'package:ordering/features/profile/presentation/profile_screen.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentIndex = 1;
  PaymentStatusModel? _status;
  Timer? _lockTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // The cart can become due while the app stays open all day, so the lock
    // is checked here too, not only on the welcome screen at start-up.
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkLock());
    _lockTimer = Timer.periodic(
      const Duration(minutes: 10),
      (_) => _checkLock(),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _lockTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkLock();
  }

  Future<void> _checkLock() async {
    if (!mounted) return;
    final status = await checkPaymentLock(context);
    if (mounted && status != null) setState(() => _status = status);
  }

  void _onTabTap(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    // Only between midnight (the day's bill is final) and the 2:00am lock,
    // so vendors aren't interrupted while they serve during the day.
    final showBanner = status != null && status.isFeeComingDue && status.canPay;
    // Staff see today's handover instead of the owner's sales.
    final screens = [
      context.watch<AuthProvider>().isStaff
          ? const HandoverScreen()
          : const SalesScreen(),
      const OrdersScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.white,
      body: Column(
        children: [
          if (showBanner)
            SafeArea(bottom: false, child: _FeeDueBanner(status: status)),
          Expanded(
            // The banner already took the status-bar inset.
            child: MediaQuery.removePadding(
              context: context,
              removeTop: showBanner,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: IndexedStack(
                      index: _currentIndex,
                      children: List.generate(screens.length, (i) {
                        return AnimatedOpacity(
                          opacity: _currentIndex == i ? 1 : 0,
                          duration: const Duration(milliseconds: 250),
                          child: screens[i],
                        );
                      }),
                    ),
                  ),
                  // The + button rides on top of the nav bar, so it clears it
                  // at any bar height (gesture or button navigation, large
                  // system text) instead of sitting at a fixed offset.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (_currentIndex == 1)
                          SafeArea(
                            top: false,
                            bottom: false,
                            child: Padding(
                              padding: const EdgeInsets.only(right: 16),
                              child: FloatingActionButton(
                                onPressed: () => showCreateOrderSheet(context),
                                backgroundColor: AppColors.primary,
                                shape: const CircleBorder(),
                                elevation: 4,
                                child: const Icon(
                                  Icons.add,
                                  color: AppColors.white,
                                ),
                              ),
                            ),
                          ),
                        BottomNavBar(
                          currentIndex: _currentIndex,
                          onTap: _onTabTap,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Your cart locks at 2:00 AM. Pay ₹X now…" with Pay now. Shown from
/// midnight until the lock; staff see the warning without the button.
class _FeeDueBanner extends StatelessWidget {
  final PaymentStatusModel status;

  const _FeeDueBanner({required this.status});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).languageCode;
    final lockTime = DateFormat.jm(locale).format(status.dueAt!.toLocal());
    final canPay = !context.watch<AuthProvider>().isStaff;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      decoration: BoxDecoration(
        color: AppColors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.schedule, color: AppColors.warning, size: 20),
          AppGaps.w12,
          Expanded(
            child: Text(
              l10n.feeDueBanner(lockTime, formatPrice(status.totalPending)),
              style: AppTextStyles.caption.copyWith(
                color: AppColors.grey600,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (canPay)
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PaymentLockScreen(
                    isLocked: false,
                    cartName: status.cartName,
                    cartAddress: status.address,
                    ordersCompleted: status.totalOrders,
                    platformFee: status.totalPending,
                    amountDue: status.totalPending,
                  ),
                ),
              ),
              child: Text(
                l10n.payNowCaps,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
