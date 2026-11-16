import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ordering/app/home/widgets/bottom_nav_bar.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/routes/app_routes.dart';
import 'package:ordering/core/utils/payment_lock.dart';
import 'package:ordering/core/utils/push.dart';
import 'package:ordering/core/widgets/notice_banner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/alerts/area_alert_service.dart';
import 'package:ordering/features/alerts/area_alerts.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/weather/weather_service.dart';
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
  // Every active alert near the cart, newest first (the sheet follows it too).
  late final ValueNotifier<List<AreaAlert>> _alerts;
  late final ValueNotifier<int> _alertTick;
  // The cart switcher can change the cart while Home stays open.
  late final CartProvider _carts;
  String? _cartId;
  // The fee warning closed with its X: for that cart and that night's lock
  // only, so the next bill (or another cart's) shows again.
  String? _feeHidden;
  static const _feeHiddenKey = 'fee_banner_hidden';

  String _feeKey(PaymentStatusModel s) =>
      '${_carts.selectedCart?.id}|${s.dueAt?.toIso8601String()}';

  Future<void> _hideFeeBanner(PaymentStatusModel status) async {
    setState(() => _feeHidden = _feeKey(status));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_feeHiddenKey, _feeHidden!);
  }

  Future<void> _loadClosedBanners() async {
    final prefs = await SharedPreferences.getInstance();
    await AreaAlertsHidden.load();
    if (mounted) setState(() => _feeHidden = prefs.getString(_feeHiddenKey));
  }

  @override
  void initState() {
    super.initState();
    _carts = context.read<CartProvider>()..addListener(_onCartChanged);
    _cartId = _carts.selectedCart?.id;
    WidgetsBinding.instance.addObserver(this);
    Push.feeTap.addListener(_checkLock);
    // The cart can become due while the app stays open all day, so the lock
    // is checked here too, not only on the welcome screen at start-up.
    AreaAlertsSeen.load();
    _loadClosedBanners();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkLock();
      _loadAlerts();
      _loadWeather();
    });
    _alerts = context.read<OrderProvider>().areaAlerts;
    _alertTick = context.read<OrderProvider>().areaAlertTick
      ..addListener(_loadAlerts);
    _lockTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      _checkLock();
      _loadAlerts(); // also drops alerts that have ended
      _loadWeather(); // asks the server at most every 25 min
    });
  }

  /// Another cart was picked from a screen that stays open: re-check its
  /// fee lock (a locked cart goes to the lock screen), alerts and weather.
  void _onCartChanged() {
    final id = _carts.selectedCart?.id;
    if (id == null || id == _cartId || !mounted) return;
    _cartId = id;
    _alerts.value = [];
    setState(() => _status = null);
    _checkLock();
    _loadAlerts();
    _loadWeather();
  }

  @override
  void dispose() {
    _carts.removeListener(_onCartChanged);
    WidgetsBinding.instance.removeObserver(this);
    Push.feeTap.removeListener(_checkLock);
    _alertTick.removeListener(_loadAlerts);
    _lockTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkLock();
      _refreshCart();
      _loadAlerts();
      _loadWeather();
    }
  }

  void _loadWeather() {
    if (!mounted) return;
    final token = context.read<AuthProvider>().token;
    final cartId = context.read<CartProvider>().selectedCart?.id;
    if (token != null && cartId != null) WeatherService.refresh(token, cartId);
  }

  /// Area alerts from carts within 1 km. A failed load keeps the last list.
  Future<void> _loadAlerts() async {
    if (!mounted) return;
    final token = context.read<AuthProvider>().token;
    final cartId = context.read<CartProvider>().selectedCart?.id;
    if (token == null || cartId == null) return;
    try {
      final alerts = await AreaAlertService.list(token, cartId);
      if (mounted) setState(() => _alerts.value = groupAreaAlerts(alerts));
    } catch (e) {
      debugPrint('Area alerts failed: $e');
    }
  }

  Future<void> _checkLock() async {
    if (!mounted) return;
    final carts = context.read<CartProvider>();
    final tapped = Push.feeTap.value;
    if (tapped != null && tapped != carts.selectedCart?.id) {
      // A fee reminder for another cart: switch to it the usual way (the
      // welcome screen shows a locked cart's lock screen), then come back.
      final cart = carts.carts.where((c) => c.id == tapped).firstOrNull;
      if (cart == null) {
        Push.feeTap.value = null;
      } else {
        await carts.selectCart(cart);
        navigatorKey.currentState?.pushNamedAndRemoveUntil(
          AppRoutes.welcome,
          (_) => false,
        );
        return;
      }
    }

    final status = await checkPaymentLock(context);
    if (!mounted || status == null) return;
    setState(() => _status = status);

    if (tapped != null && tapped == carts.selectedCart?.id) {
      Push.feeTap.value = null;
      // A locked cart is already on the lock screen; staff can't pay.
      if (!status.isLocked &&
          status.canPay &&
          status.totalPending > 0 &&
          !context.read<AuthProvider>().isStaff) {
        openFeePayment(context, status);
      }
    }
  }

  void _onTabTap(int index) {
    setState(() => _currentIndex = index);
    if (index == 2) _refreshCart(); // Profile shows the cart's open state
  }

  void _refreshCart() {
    final auth = context.read<AuthProvider>();
    context.read<CartProvider>().refreshSelectedCart(
      auth.token ?? '',
      auth.user?['id']?.toString() ?? '',
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
    // Only between midnight (the day's bill is final) and the 2:00am lock,
    // so vendors aren't interrupted while they serve during the day.
    final showFeeBanner =
        status != null &&
        status.isFeeComingDue &&
        status.canPay &&
        _feeKey(status) != _feeHidden;
    final hidden = AreaAlertsHidden.ids.value;
    final shown = _alerts.value.where((a) => !hidden.contains(a.id)).toList();
    final showBanner = showFeeBanner || shown.isNotEmpty;
    // Staff see today's handover instead of the owner's sales.
    final screens = [
      context.watch<AuthProvider>().isStaff
          ? const HandoverScreen()
          : const SalesScreen(),
      const OrdersScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          if (showBanner)
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  if (shown.isNotEmpty)
                    AreaAlertBanner(
                      alert: shown.first,
                      more: shown.length - 1,
                      onChanged: _loadAlerts,
                      onTap: () =>
                          showAreaAlertsSheet(context, _alerts, _loadAlerts),
                      // Closed for good on this phone; a new report shows again.
                      onDismiss: () async {
                        await AreaAlertsHidden.hide(
                          shown.map((a) => a.id),
                          _alerts.value,
                        );
                        if (mounted) setState(() {});
                      },
                    ),
                  if (showFeeBanner)
                    _FeeDueBanner(
                      status: status,
                      onDismiss: () => _hideFeeBanner(status),
                    ),
                ],
              ),
            ),
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
                        // Hidden tabs keep their state but stop animating
                        // (the weather characters, shimmers).
                        return TickerMode(
                          enabled: _currentIndex == i,
                          child: AnimatedOpacity(
                            opacity: _currentIndex == i ? 1 : 0,
                            duration: const Duration(milliseconds: 250),
                            child: screens[i],
                          ),
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
                                // A black shadow reads as a ring on the dark theme.
                                elevation: AppColors.dark ? 0 : 4,
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

/// Pays a fee that is due before the cart locks (the screen can be closed).
/// Completes when the payment screen closes, so callers can refresh.
Future<void> openFeePayment(BuildContext context, PaymentStatusModel status) {
  return Navigator.push(
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
  );
}

/// "Your cart locks at 2:00 AM. Pay ₹X now…" with Pay now. Shown from
/// midnight until the lock; staff see the warning without the button. The
/// X hides it for this bill only (the lock and the fee reminders still come).
class _FeeDueBanner extends StatelessWidget {
  final PaymentStatusModel status;
  final VoidCallback onDismiss;

  const _FeeDueBanner({required this.status, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final locale = Localizations.localeOf(context).languageCode;
    final lockTime = DateFormat.jm(locale).format(status.dueAt!.toLocal());
    final canPay = !context.watch<AuthProvider>().isStaff;

    return NoticeBanner(
      icon: Icons.schedule,
      color: AppColors.warning,
      text: l10n.feeDueBanner(lockTime, formatPrice(status.totalPending)),
      onDismiss: onDismiss,
      dismissTooltip: l10n.areaAlertHide,
      actions: [
        if (canPay)
          NoticeAction(
            label: l10n.payNowCaps,
            color: AppColors.primary,
            onPressed: () => openFeePayment(context, status),
          ),
      ],
    );
  }
}
