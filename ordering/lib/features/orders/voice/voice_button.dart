import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/providers/order_provider.dart';
import 'package:ordering/features/orders/screens/orders_screen.dart';
import 'package:ordering/features/orders/voice/voice_confirm_sheet.dart';
import 'package:ordering/features/orders/voice/voice_parser.dart';
import 'package:ordering/features/orders/voice/voice_session.dart';
import 'package:ordering/features/orders/voice/wave_detector.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:proximity_sensor/proximity_sensor.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Voice orders ship in a later update. To turn them on, set this to true
/// and put back the RECORD_AUDIO permission and the speech/TTS queries
/// commented out in android/app/src/main/AndroidManifest.xml.
const voiceOrdersEnabled = false;

/// Voice orders, on the Orders tab only: tap the mic or wave a hand over the
/// phone, say the order, and confirm by saying "yes" (or tapping). Long-press
/// the mic to turn wave-to-talk off or on.
class VoiceOrderButton extends StatefulWidget {
  const VoiceOrderButton({super.key});

  @override
  State<VoiceOrderButton> createState() => _VoiceOrderButtonState();
}

class _VoiceOrderButtonState extends State<VoiceOrderButton>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  static const _waveKey = 'voice_wave';

  final _session = VoiceSession();
  final _wave = WaveDetector();
  final _sheetKey = GlobalKey<VoiceConfirmSheetState>();
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  StreamSubscription<int>? _proximity;

  bool _waveOn = true;
  bool _listening = false;
  bool _busy = false; // from a start until its sheet closes
  bool _sheetOpen = false;
  String _words = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SharedPreferences.getInstance().then((p) {
      if (!mounted) return;
      setState(() => _waveOn = p.getBool(_waveKey) ?? true);
      _watchWaves();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _proximity?.cancel();
    _pulse.dispose();
    _session.quiet();
    super.dispose();
  }

  // Only while the app is in front: no sensor, no mic in the background.
  // "Inactive" is not the background: a palm over the top of the screen
  // brushes the status bar and makes the app briefly inactive mid-wave.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        if (_proximity == null) _watchWaves();
      case AppLifecycleState.inactive:
        break;
      default:
        _proximity?.cancel();
        _proximity = null;
        _session.quiet();
    }
  }

  void _watchWaves() {
    _proximity?.cancel();
    _proximity = null;
    if (!_waveOn) return;
    _proximity = ProximitySensor.events.listen(
      (v) {
        if (_wave.add(near: v > 0, at: DateTime.now())) _onWave();
      },
      // No proximity sensor: the mic button still works.
      onError: (Object e) => debugPrint('Wave-to-talk unavailable: $e'),
      cancelOnError: true,
    );
  }

  void _onWave() {
    if (!mounted) return;
    if (_sheetOpen) {
      _sheetKey.currentState?.listenForYes();
      return;
    }
    // Not while another screen (the new-order sheet, a dialog) is on top.
    if (ModalRoute.of(context)?.isCurrent != true) return;
    _start();
  }

  Future<void> _toggleWave() async {
    final on = !_waveOn;
    setState(() => _waveOn = on);
    _watchWaves();
    (await SharedPreferences.getInstance()).setBool(_waveKey, on);
    if (!mounted) return;
    AppSnackBar.show(
      context,
      isInfo: true,
      message: on ? context.l10n.voiceWaveOn : context.l10n.voiceWaveOff,
    );
  }

  // ---------------------------------------------------------------------
  // Listening
  // ---------------------------------------------------------------------

  Future<void> _start() async {
    if (_listening) {
      await _session.stop();
      return;
    }
    if (_busy) return;
    _busy = true;
    try {
      if (!await _session.init()) {
        if (mounted) {
          AppSnackBar.show(
            context,
            message: context.l10n.voiceMicNeeded,
            isError: true,
          );
        }
        return;
      }
      if (!mounted) return;
      setState(() {
        _listening = true;
        _words = '';
      });
      _pulse.repeat(reverse: true);
      final heard = await _session.listen(
        onWords: (w) {
          if (mounted) setState(() => _words = w);
        },
      );
      _pulse.stop();
      if (!mounted) return;
      setState(() => _listening = false);
      await _handle(heard);
    } finally {
      _busy = false;
      if (mounted && _listening) setState(() => _listening = false);
    }
  }

  Future<void> _handle(List<String> heard) async {
    final l10n = context.l10n;
    final token = context.read<AuthProvider>().token ?? '';
    final cart = context.read<CartProvider>().selectedCart;
    final orders = context.read<OrderProvider>();
    if (cart == null) return;

    if (heard.isEmpty) return _sorry();
    if (orders.menu.isEmpty || orders.menu.first.cartId != cart.id) {
      try {
        await orders.loadMenu(token, cart.id);
      } catch (_) {}
      if (!mounted) return;
    }

    final command = parseBestVoiceCommand(heard, orders.menu, orders.orders);
    switch (command) {
      case NotUnderstood():
        return _sorry();
      case OrderNotFound(:final number):
        final text = l10n.voiceNotWaiting('$number');
        AppSnackBar.show(context, message: text, isError: true);
        await _session.say(text);
        return;
      default:
        break;
    }

    if (!mounted) return;
    _sheetOpen = true;
    final decision = await showVoiceConfirmSheet(
      context,
      key: _sheetKey,
      command: command,
      heard: heard.first,
      session: _session,
      parcelCharge: cart.parcelCharge.toDouble(),
      platformFee: orders.newOrderFee,
      onEdit: (draft) => showCreateOrderSheet(
        context,
        prefill: draft.lines,
        prefillParcel: draft.parcel ? cart.parcelCharge.toDouble() : 0,
      ),
    );
    _sheetOpen = false;
    if (decision == null || !mounted) return;
    await _act(command, decision, token, cart.id);
  }

  /// Runs what the buttons would: the same calls, snackbars and UNDO.
  Future<void> _act(
    VoiceCommand command,
    VoiceDecision decision,
    String token,
    String cartId,
  ) async {
    switch (command) {
      case MarkPaidCommand(:final order):
        await markOrderPaidWithUndo(context, token, order.id);
      case ServeCommand(:final order):
        await markOrderServedWithUndo(context, token, order.id);
      case NewOrderCommand(:final lines):
        final provider = context.read<OrderProvider>();
        final cart = context.read<CartProvider>().selectedCart;
        try {
          await provider.createOrder(token, {
            "cartId": cartId,
            "orderType": "MANUAL",
            "status": decision.paid ? "PAID" : "PENDING",
            "orderItems": [
              for (final l in lines)
                if ((decision.lines[l.item.id] ?? 0) > 0)
                  {
                    "menuItemId": l.item.id,
                    "name": l.item.name,
                    "price": l.item.price,
                    "quantity": decision.lines[l.item.id],
                  },
            ],
            "parcelCharge": decision.parcel ? (cart?.parcelCharge ?? 0) : 0,
          });
          if (!mounted) return;
          AppSnackBar.show(
            context,
            message: decision.paid
                ? context.l10n.orderCreatedPaid
                : context.l10n.orderCreated,
          );
        } catch (e) {
          if (!mounted) return;
          AppSnackBar.show(
            context,
            message: AppExceptionHandler.getMessage(e),
            isError: true,
          );
        }
      default:
        break;
    }
  }

  Future<void> _sorry() async {
    final l10n = context.l10n;
    AppSnackBar.show(
      context,
      message: '${l10n.voiceNotUnderstood} ${l10n.voiceExample}',
      isError: true,
    );
    await _session.say(l10n.voiceNotUnderstood);
  }

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // The live words while listening.
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          child: _listening
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: Material(
                    color: AppColors.night,
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.graphic_eq_rounded,
                            color: AppColors.lilac,
                          ),
                          AppGaps.w12,
                          Expanded(
                            child: Text(
                              _words.isEmpty
                                  ? '${l10n.voiceListening}\n${l10n.voiceExample}'
                                  : _words,
                              style: AppTextStyles.body.copyWith(
                                color: AppColors.white,
                                fontWeight: _words.isEmpty
                                    ? FontWeight.w400
                                    : FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
        Padding(
          padding: const EdgeInsets.only(right: 20, bottom: 12),
          child: Tooltip(
            message: l10n.voiceTapToSpeak,
            child: GestureDetector(
              onLongPress: _toggleWave,
              child: AnimatedBuilder(
                animation: _pulse,
                builder: (context, child) => Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      if (_listening)
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.45),
                          blurRadius: 10 + 14 * _pulse.value,
                          spreadRadius: 2 + 6 * _pulse.value,
                        ),
                    ],
                  ),
                  child: child,
                ),
                child: Material(
                  color: _listening ? AppColors.primary : AppColors.surface,
                  shape: CircleBorder(
                    side: BorderSide(
                      color: AppColors.primary.withValues(alpha: 0.5),
                    ),
                  ),
                  elevation: AppColors.dark ? 0 : 3,
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _start,
                    child: SizedBox(
                      width: 48,
                      height: 48,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            _listening ? Icons.stop_rounded : Icons.mic_rounded,
                            color: _listening
                                ? AppColors.white
                                : AppColors.primary,
                          ),
                          // Wave-to-talk is on.
                          if (_waveOn && !_listening)
                            const Positioned(
                              right: 6,
                              top: 6,
                              child: Icon(
                                Icons.waving_hand_rounded,
                                size: 11,
                                color: AppColors.warning,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
