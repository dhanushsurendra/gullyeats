import 'package:clock/clock.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/icon_tile.dart';
import 'package:ordering/core/widgets/notice_banner.dart';
import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/alerts/area_alert_service.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

String areaReasonLabel(AppLocalizations l10n, String reason) =>
    switch (reason) {
      'EVICTION' => l10n.areaReasonEviction,
      'ROAD_BLOCKED' => l10n.areaReasonRoadBlocked,
      'RAIN' => l10n.areaReasonRain,
      _ => l10n.areaReasonCrowd,
    };

IconData _reasonIcon(String reason) => switch (reason) {
  'EVICTION' => Icons.local_shipping_outlined,
  'ROAD_BLOCKED' => Icons.block,
  'RAIN' => Icons.water_drop_outlined,
  _ => Icons.groups_outlined,
};

/// "Eviction drive reported about 500 m away · 12 min ago · 3 confirmed",
/// with "I see it too" on other vendors' alerts. On Home it carries the
/// newest alert only: [more] counts the rest, a tap ([onTap]) lists them
/// all, and [onDismiss] hides them on this phone.
class AreaAlertBanner extends StatefulWidget {
  final AreaAlert alert;

  /// Called after a confirmation, so the list reloads.
  final VoidCallback onChanged;
  final int more;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;
  final EdgeInsetsGeometry margin;

  const AreaAlertBanner({
    super.key,
    required this.alert,
    required this.onChanged,
    this.more = 0,
    this.onTap,
    this.onDismiss,
    this.margin = const EdgeInsets.fromLTRB(16, 12, 16, 0),
  });

  @override
  State<AreaAlertBanner> createState() => _AreaAlertBannerState();
}

class _AreaAlertBannerState extends State<AreaAlertBanner> {
  bool _busy = false;

  Future<void> _confirm() async {
    final token = context.read<AuthProvider>().token ?? '';
    final cartId = context.read<CartProvider>().selectedCart?.id ?? '';
    setState(() => _busy = true);
    try {
      await AreaAlertService.confirm(token, cartId, widget.alert.id);
      widget.onChanged();
    } catch (e) {
      if (mounted) {
        AppSnackBar.show(
          context,
          message: AppExceptionHandler.getMessage(e),
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final a = widget.alert;
    final minutes = clock.now().difference(a.createdAt).inMinutes;
    final ago = minutes < 1 ? l10n.justNow : l10n.minutesAgo(minutes);
    final reason = areaReasonLabel(l10n, a.reason);
    final parts = [
      a.mine
          ? l10n.areaAlertMine(reason)
          : l10n.areaAlertNearby(reason, a.distanceM),
      ago,
      if (a.vendors > 1) l10n.areaAlertVendors(a.vendors),
    ];
    final canConfirm = !a.mine && !a.confirmedByMe;
    return NoticeBanner(
      icon: _reasonIcon(a.reason),
      color: AppColors.error,
      text: parts.join(' · '),
      margin: widget.margin,
      onTap: widget.onTap,
      onDismiss: widget.onDismiss,
      dismissTooltip: l10n.areaAlertHide,
      actions: [
        if (canConfirm)
          NoticeAction(
            label: l10n.areaAlertSeeItToo,
            color: AppColors.error,
            onPressed: _busy ? null : _confirm,
          ),
        if (widget.more > 0)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Text(
              l10n.areaAlertMore(widget.more),
              style: AppTextStyles.caption.copyWith(
                color: AppColors.error,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}

/// Alerts closed with the X on Home, kept on the phone so they stay closed
/// after a restart; a newer report has a new id and shows again. Only ids
/// still active are kept.
class AreaAlertsHidden {
  AreaAlertsHidden._();

  static const _key = 'area_alerts_hidden';
  static final ids = ValueNotifier<Set<String>>({});

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    ids.value = {...?prefs.getStringList(_key)};
  }

  static Future<void> hide(
    Iterable<String> hidden,
    List<AreaAlert> active,
  ) async {
    final live = active.map((a) => a.id).toSet();
    ids.value = {...ids.value.where(live.contains), ...hidden};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, ids.value.toList());
  }
}

/// Which other carts' alerts this phone has already seen in the alerts
/// sheet, so the Profile tile counts only new ones (a later report has a new
/// id and counts again). Saved on the phone, so a restart doesn't bring the
/// count back.
class AreaAlertsSeen {
  AreaAlertsSeen._();

  static const _key = 'area_alerts_seen';
  static final ids = ValueNotifier<Set<String>>({});

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    ids.value = {...?prefs.getStringList(_key)};
  }

  /// Marks the active alerts seen. Only active ids are kept, so the list
  /// stays small: alerts end within hours.
  static Future<void> markSeen(List<AreaAlert> alerts) async {
    final next = alerts.where((a) => !a.mine).map((a) => a.id).toSet();
    if (setEquals(next, ids.value)) return;
    ids.value = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, next.toList());
  }

  /// Other carts' alerts not seen yet.
  static int unseen(List<AreaAlert> alerts) =>
      alerts.where((a) => !a.mine && !ids.value.contains(a.id)).length;
}

/// Every active alert near the cart, newest first. Follows [alerts] so a
/// confirmation or a new alert shows while it's open.
void showAreaAlertsSheet(
  BuildContext context,
  ValueListenable<List<AreaAlert>> alerts,
  VoidCallback onChanged,
) {
  AreaAlertsSeen.markSeen(alerts.value);
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (context) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.8,
        ),
        child: ValueListenableBuilder(
          valueListenable: alerts,
          builder: (context, list, _) => ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.only(top: 20, bottom: 16),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  context.l10n.areaAlertsTitle,
                  style: AppTextStyles.heading2,
                ),
              ),
              for (final a in list)
                AreaAlertBanner(
                  key: ValueKey(a.id),
                  alert: a,
                  onChanged: onChanged,
                ),
            ],
          ),
        ),
      ),
    ),
  ).whenComplete(() => AreaAlertsSeen.markSeen(alerts.value));
}

/// The alerts sheet: active alerts near the cart above the send options.
Future<void> openAreaAlertSheet(BuildContext context) async {
  final alerts = context.read<OrderProvider>().areaAlerts;
  AreaAlertsSeen.markSeen(alerts.value);
  final sent = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _ReportSheet(),
  );
  // Alerts that arrived while it was open were seen too.
  AreaAlertsSeen.markSeen(alerts.value);
  if (sent == true && context.mounted) {
    // The server tells only the other carts, so reload our own list here.
    context.read<OrderProvider>().areaAlertTick.value++;
    AppSnackBar.show(
      context,
      message: context.l10n.areaAlertSent,
      isInfo: true,
    );
  }
}

/// The "Alert nearby carts" tile on Profile; opens [openAreaAlertSheet].
/// Orange like the other items while it's quiet; red, with a count, while
/// other carts' alerts haven't been seen in the sheet yet (still there after
/// the Home banner is closed), so red always means something new.
class AreaAlertTile extends StatelessWidget {
  const AreaAlertTile({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final alerts = context.read<OrderProvider>().areaAlerts;
    return ListenableBuilder(
      listenable: Listenable.merge([alerts, AreaAlertsSeen.ids]),
      builder: (context, _) {
        final count = AreaAlertsSeen.unseen(alerts.value);
        final alert = count > 0;
        return IconTile(
          icon: Icons.campaign_outlined,
          title: l10n.areaAlertReport,
          subtitle: l10n.areaAlertTileNote,
          color: alert ? AppColors.error : null,
          background: alert ? AppColors.error.withValues(alpha: 0.1) : null,
          onTap: () => openAreaAlertSheet(context),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (alert)
                Badge(label: Text('$count'), backgroundColor: AppColors.error),
              Icon(Icons.chevron_right, color: AppColors.grey500),
            ],
          ),
        );
      },
    );
  }
}

/// Pick what's happening, then send: two taps, so a pocket tap sends nothing.
class _ReportSheet extends StatefulWidget {
  const _ReportSheet();

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _reason;
  bool _sending = false;
  String? _error;

  Future<void> _send() async {
    final l10n = context.l10n;
    final token = context.read<AuthProvider>().token ?? '';
    final cartId = context.read<CartProvider>().selectedCart?.id ?? '';
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await AreaAlertService.send(token, cartId, _reason!);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      // Shown in the sheet: a snackbar would sit behind it.
      setState(() {
        _sending = false;
        _error = e is ApiException && e.statusCode == 429
            ? l10n.areaAlertCooldown
            : AppExceptionHandler.getMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Alerts and options scroll; the Send button stays in reach below them.
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ValueListenableBuilder(
                    valueListenable: context.read<OrderProvider>().areaAlerts,
                    builder: (context, list, _) => list.isEmpty
                        ? const SizedBox.shrink()
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                l10n.areaAlertsTitle,
                                style: AppTextStyles.heading2,
                              ),
                              for (final a in list)
                                AreaAlertBanner(
                                  key: ValueKey(a.id),
                                  alert: a,
                                  margin: const EdgeInsets.only(top: 12),
                                  onChanged: () => context
                                      .read<OrderProvider>()
                                      .areaAlertTick
                                      .value++,
                                ),
                              AppGaps.h24,
                              Divider(color: AppColors.grey200, height: 1),
                              AppGaps.h24,
                            ],
                          ),
                  ),
                  Text(l10n.areaAlertSheetTitle, style: AppTextStyles.heading2),
                  AppGaps.h8,
                  Text(l10n.areaAlertSheetNote, style: AppTextStyles.caption),
                  AppGaps.h16,
                  for (final r in AreaAlertService.reasons)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      // Its own surface: a ListTile paints its outline on the
                      // nearest Material, which would draw over the pinned button.
                      child: Material(
                        type: MaterialType.transparency,
                        child: ListTile(
                          onTap: _sending
                              ? null
                              : () => setState(() => _reason = r),
                          leading: Icon(
                            _reasonIcon(r),
                            color: _reason == r
                                ? AppColors.error
                                : AppColors.grey500,
                          ),
                          title: Text(
                            areaReasonLabel(l10n, r),
                            style: AppTextStyles.body.copyWith(
                              color: AppColors.black,
                            ),
                          ),
                          trailing: _reason == r
                              ? const Icon(
                                  Icons.check_circle,
                                  color: AppColors.error,
                                )
                              : null,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: _reason == r
                                  ? AppColors.error
                                  : AppColors.grey200,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4, bottom: 4),
                    child: Text(
                      _error!,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.error,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                AppGaps.h8,
                AppButton(
                  label: l10n.areaAlertSend,
                  backgroundColor: AppColors.error,
                  disabled: _reason == null,
                  isLoading: _sending,
                  onPressed: _send,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
