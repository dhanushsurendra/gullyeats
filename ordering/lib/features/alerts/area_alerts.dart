import 'package:clock/clock.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/app_card.dart';
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
    final action = AppTextStyles.caption.copyWith(
      color: AppColors.error,
      fontWeight: FontWeight.w700,
    );

    return Container(
      width: double.infinity,
      margin: widget.margin,
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: widget.onTap,
          child: Padding(
            // The close button brings its own height: less padding with it.
            padding: widget.onDismiss == null
                ? const EdgeInsets.symmetric(horizontal: 16, vertical: 12)
                : const EdgeInsets.fromLTRB(16, 6, 4, 6),
            child: Row(
              // Icon, text and close button on one centre line.
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(_reasonIcon(a.reason), color: AppColors.error, size: 20),
                AppGaps.w12,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        parts.join(' · '),
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.grey600,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      // Under the text, so a long translation never squeezes it.
                      if (canConfirm || widget.more > 0)
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 16,
                          children: [
                            if (canConfirm)
                              TextButton(
                                onPressed: _busy ? null : _confirm,
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                ),
                                child: Text(
                                  l10n.areaAlertSeeItToo,
                                  style: action,
                                ),
                              ),
                            if (widget.more > 0)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                child: Text(
                                  l10n.areaAlertMore(widget.more),
                                  style: action,
                                ),
                              ),
                          ],
                        ),
                    ],
                  ),
                ),
                if (widget.onDismiss != null)
                  IconButton(
                    onPressed: widget.onDismiss,
                    tooltip: l10n.areaAlertHide,
                    visualDensity: VisualDensity.compact,
                    icon: Icon(Icons.close, size: 18, color: AppColors.grey500),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Every active alert near the cart, newest first. Follows [alerts] so a
/// confirmation or a new alert shows while it's open.
void showAreaAlertsSheet(
  BuildContext context,
  ValueListenable<List<AreaAlert>> alerts,
  VoidCallback onChanged,
) {
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
  );
}

/// The alerts sheet: active alerts near the cart above the send options.
Future<void> openAreaAlertSheet(BuildContext context) async {
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
/// A red count shows other carts' active alerts, still there after the Home
/// banner is closed.
class AreaAlertTile extends StatelessWidget {
  const AreaAlertTile({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ValueListenableBuilder(
      valueListenable: context.read<OrderProvider>().areaAlerts,
      builder: (context, list, _) {
        final count = list.where((a) => !a.mine).length;
        return AppCard(
          padding: EdgeInsets.zero,
          child: ListTile(
            onTap: () => openAreaAlertSheet(context),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.campaign_outlined, color: AppColors.error),
            ),
            title: Text(l10n.areaAlertReport, style: AppTextStyles.heading3),
            subtitle: Text(l10n.areaAlertTileNote, style: AppTextStyles.caption),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (count > 0)
                  Badge(
                    label: Text('$count'),
                    backgroundColor: AppColors.error,
                  ),
                Icon(Icons.chevron_right, color: AppColors.grey500),
              ],
            ),
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
