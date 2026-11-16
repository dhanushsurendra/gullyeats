import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/format_price.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/features/orders/voice/voice_parser.dart';
import 'package:ordering/features/orders/voice/voice_session.dart';
import 'package:ordering/l10n/l10n.dart';

/// What the confirmation sheet hands back when the vendor confirms.
class VoiceDecision {
  /// For a new order: item id -> quantity (zero lines dropped).
  final Map<String, int> lines;
  final bool parcel;
  final bool paid;

  const VoiceDecision({
    this.lines = const {},
    this.parcel = false,
    this.paid = false,
  });
}

/// Shows what was understood, reads it aloud, then listens a few seconds for
/// "yes" or "no". Returns the decision on CONFIRM / "yes", null otherwise.
/// [onEdit] (new orders only) opens the full new-order sheet instead.
Future<VoiceDecision?> showVoiceConfirmSheet(
  BuildContext context, {
  required VoiceCommand command,
  required String heard,
  required VoiceSession session,
  required double parcelCharge,
  required double platformFee,
  required GlobalKey<VoiceConfirmSheetState> key,
  void Function(VoiceDecision draft)? onEdit,
}) {
  return showModalBottomSheet<VoiceDecision>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => VoiceConfirmSheet(
      key: key,
      command: command,
      heard: heard,
      session: session,
      parcelCharge: parcelCharge,
      platformFee: platformFee,
      onEdit: onEdit,
    ),
  );
}

class VoiceConfirmSheet extends StatefulWidget {
  final VoiceCommand command;
  final String heard;
  final VoiceSession session;
  final double parcelCharge;
  final double platformFee;
  final void Function(VoiceDecision draft)? onEdit;

  const VoiceConfirmSheet({
    super.key,
    required this.command,
    required this.heard,
    required this.session,
    required this.parcelCharge,
    required this.platformFee,
    this.onEdit,
  });

  @override
  State<VoiceConfirmSheet> createState() => VoiceConfirmSheetState();
}

class VoiceConfirmSheetState extends State<VoiceConfirmSheet> {
  late final Map<String, int> _qty;
  late bool _parcel;
  late bool _paid;
  bool _listening = false;
  bool _closed = false;

  NewOrderCommand? get _order => switch (widget.command) {
    NewOrderCommand c => c,
    _ => null,
  };

  @override
  void initState() {
    super.initState();
    final order = _order;
    // Out-of-stock dishes start at 0, so they're seen but not ordered.
    _qty = {
      for (final l in order?.lines ?? const <VoiceLine>[])
        l.item.id: l.item.isInStock ? l.quantity : 0,
    };
    _parcel = order?.parcel ?? false;
    _paid = order?.paid ?? false;
    WidgetsBinding.instance.addPostFrameCallback((_) => _readBack());
  }

  @override
  void dispose() {
    _closed = true;
    widget.session.quiet();
    super.dispose();
  }

  double get _total {
    final order = _order;
    if (order == null) return 0;
    final items = order.lines.fold<double>(
      0,
      (t, l) => t + l.item.price * (_qty[l.item.id] ?? 0),
    );
    if (items == 0) return 0;
    return items + (_parcel ? widget.parcelCharge : 0) + widget.platformFee;
  }

  /// The words read aloud: the dishes, parcel/paid and the total, or the
  /// question for an existing order.
  String _speech() {
    final l10n = context.l10n;
    return switch (widget.command) {
      NewOrderCommand c => [
        c.lines
            .where((l) => (_qty[l.item.id] ?? 0) > 0)
            .map((l) => '${_qty[l.item.id]} ${l.item.displayName}')
            .join(', '),
        if (_parcel) l10n.parcel,
        if (_paid) l10n.paid,
        l10n.voiceReadTotal(formatPrice(_total)),
      ].join('. '),
      MarkPaidCommand c => l10n.voiceMarkPaidQuestion(c.order.orderNumber),
      ServeCommand c => l10n.voiceServeQuestion(c.order.orderNumber),
      _ => '',
    };
  }

  Future<void> _readBack() async {
    await widget.session.say(_speech());
    if (mounted && !_closed) await listenForYes();
  }

  /// A few seconds for "yes" / "no" (also after a wave over the phone).
  Future<void> listenForYes() async {
    if (_listening || _closed) return;
    setState(() => _listening = true);
    final heard = await widget.session.listen(
      pauseFor: const Duration(milliseconds: 1500),
      listenFor: const Duration(seconds: 4),
    );
    if (!mounted || _closed) return;
    setState(() => _listening = false);
    switch (parseYesNo(heard)) {
      case true:
        _confirm();
      case false:
        Navigator.pop(context);
      case null:
        break;
    }
  }

  bool get _canConfirm => _order == null || _qty.values.any((q) => q > 0);

  VoiceDecision get _decision => VoiceDecision(
    lines: {
      for (final MapEntry(key: id, value: q) in _qty.entries)
        if (q > 0) id: q,
    },
    parcel: _parcel,
    paid: _paid,
  );

  void _confirm() {
    if (!_canConfirm || _closed) return;
    _closed = true;
    Navigator.pop(context, _decision);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final order = _order;
    final title = switch (widget.command) {
      NewOrderCommand _ => l10n.voiceNewOrder,
      MarkPaidCommand c => l10n.voiceMarkPaidQuestion(c.order.orderNumber),
      ServeCommand c => l10n.voiceServeQuestion(c.order.orderNumber),
      _ => '',
    };

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: AppTextStyles.heading2),
          AppGaps.h4,
          // What the phone heard, so a mishearing is easy to spot.
          Text(
            '"${widget.heard}"',
            style: AppTextStyles.caption.copyWith(fontStyle: FontStyle.italic),
          ),
          AppGaps.h16,
          if (order != null) ...[
            for (final line in order.lines) _line(line),
            if (order.unknown.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  l10n.voiceDidntCatch(order.unknown.join(' ')),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.warning,
                  ),
                ),
              ),
            AppGaps.h8,
            Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: Text(l10n.parcel),
                  selected: _parcel,
                  onSelected: (v) => setState(() => _parcel = v),
                ),
                FilterChip(
                  label: Text(l10n.paid),
                  selected: _paid,
                  onSelected: (v) => setState(() => _paid = v),
                ),
              ],
            ),
            AppGaps.h12,
            Row(
              children: [
                Text(l10n.total, style: AppTextStyles.body),
                const Spacer(),
                Text(
                  '₹${formatPrice(_total)}',
                  style: AppTextStyles.heading2.copyWith(
                    color: AppColors.black,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ] else
            _existingOrder(),
          AppGaps.h16,
          _listeningHint(),
          AppGaps.h12,
          AppButton(
            label: l10n.voiceConfirmCaps,
            disabled: !_canConfirm,
            onPressed: _confirm,
          ),
          AppGaps.h8,
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(l10n.cancel.toUpperCase()),
                ),
              ),
              if (order != null && widget.onEdit != null)
                Expanded(
                  child: TextButton(
                    onPressed: () {
                      final draft = _decision;
                      _closed = true;
                      Navigator.pop(context);
                      widget.onEdit!(draft);
                    },
                    child: Text(l10n.voiceEditCaps),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _line(VoiceLine line) {
    final q = _qty[line.item.id] ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.item.displayName,
                  style: AppTextStyles.heading3.copyWith(
                    color: AppColors.black,
                  ),
                ),
                Text(
                  line.item.isInStock
                      ? '₹${formatPrice(line.item.price)}'
                      : context.l10n.outOfStock,
                  style: AppTextStyles.caption.copyWith(
                    color: line.item.isInStock ? null : AppColors.error,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: q > 0
                ? () => setState(() => _qty[line.item.id] = q - 1)
                : null,
            icon: const Icon(Icons.remove_circle_outline),
            color: AppColors.primary,
          ),
          SizedBox(
            width: 28,
            child: Text(
              '$q',
              textAlign: TextAlign.center,
              style: AppTextStyles.heading3.copyWith(color: AppColors.primary),
            ),
          ),
          IconButton(
            onPressed: () => setState(() => _qty[line.item.id] = q + 1),
            icon: const Icon(Icons.add_circle_outline),
            color: AppColors.primary,
          ),
        ],
      ),
    );
  }

  /// "#6 · ₹122" for mark paid / serve.
  Widget _existingOrder() {
    final o = switch (widget.command) {
      MarkPaidCommand c => c.order,
      ServeCommand c => c.order,
      _ => null,
    };
    if (o == null) return const SizedBox.shrink();
    return Text(
      '${o.orderItems.map((i) => '${i.quantity}× ${i.displayName}').join(', ')} · ₹${formatPrice(o.totalPrice)}',
      style: AppTextStyles.body.copyWith(color: AppColors.black),
    );
  }

  Widget _listeningHint() => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: Icon(
          _listening ? Icons.mic_rounded : Icons.mic_none_rounded,
          key: ValueKey(_listening),
          size: 18,
          color: _listening ? AppColors.primary : AppColors.grey400,
        ),
      ),
      AppGaps.w8,
      Flexible(
        child: Text(
          context.l10n.voiceSayYes,
          style: AppTextStyles.caption,
          textAlign: TextAlign.center,
        ),
      ),
    ],
  );
}
