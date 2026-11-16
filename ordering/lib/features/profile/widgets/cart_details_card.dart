import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/presentation/edit_cart_screen.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/profile/presentation/qr_screen.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

/// The selected cart on Profile: its photo (or a brand gradient) with the
/// name and address, the open/closed switch, the cart ID and its QR poster.
class CartDetailsCard extends StatelessWidget {
  final CartModel? cart;

  const CartDetailsCard({super.key, required this.cart});

  @override
  Widget build(BuildContext context) {
    final cart = this.cart;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Header(cart: cart),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _OpenSwitch(cart: cart),
                if (cart != null && cart.cartId.isNotEmpty) ...[
                  AppGaps.h12,
                  _CartId(id: cart.cartId),
                ],
                AppGaps.h16,
                AppButton(
                  label: context.l10n.viewQrCaps,
                  backgroundColor: AppColors.surface,
                  borderColor: AppColors.primary,
                  textColor: AppColors.primary,
                  leading: const Icon(
                    Icons.qr_code_2_rounded,
                    color: AppColors.primary,
                  ),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const QrPosterScreen()),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Photo or gradient, with the status pill, the edit button, the name and
/// the address. It grows with the text, so long names and large system text
/// fit.
class _Header extends StatelessWidget {
  final CartModel? cart;

  const _Header({required this.cart});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cart = this.cart;
    final isOpen = cart?.isOpen ?? false;
    final photo = cart?.cartImageUrl ?? '';
    // Cart details (name, address, photo, parcel charge) are the owner's.
    final canEdit = cart != null && !context.watch<AuthProvider>().isStaff;

    Widget fallback() => DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFFF8A3D), AppColors.primary, Color(0xFFC94200)],
        ),
      ),
      child: Align(
        alignment: const Alignment(1.08, 1.25),
        child: Icon(
          Icons.storefront_rounded,
          size: 120,
          color: AppColors.white.withValues(alpha: 0.1),
        ),
      ),
    );

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
      child: Stack(
        children: [
          Positioned.fill(
            child: photo.isEmpty
                ? fallback()
                : Image.network(
                    photo,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => fallback(),
                  ),
          ),
          // Keeps white text readable on a photo (the gradient needs none).
          if (photo.isNotEmpty)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    // Darker behind the pill and the name, lighter between.
                    stops: const [0, 0.35, 1],
                    colors: [
                      Colors.black.withValues(alpha: 0.3),
                      Colors.black.withValues(alpha: 0.15),
                      Colors.black.withValues(alpha: 0.8),
                    ],
                  ),
                ),
              ),
            ),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 160),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 12, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      _StatusPill(isOpen: isOpen),
                      const Spacer(),
                      if (canEdit)
                        Material(
                          color: Colors.black.withValues(alpha: 0.35),
                          shape: const CircleBorder(),
                          child: IconButton(
                            tooltip: l10n.cartDetails,
                            onPressed: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => EditCartScreen(cart: cart),
                              ),
                            ),
                            icon: const Icon(
                              Icons.edit_outlined,
                              size: 20,
                              color: AppColors.white,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  Text(
                    cart?.cartName ?? l10n.notAvailable,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.heading2.copyWith(
                      color: AppColors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if ((cart?.address ?? '').isNotEmpty) ...[
                    AppGaps.h4,
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 1),
                          child: Icon(
                            Icons.location_on_outlined,
                            size: 16,
                            color: AppColors.white.withValues(alpha: 0.85),
                          ),
                        ),
                        AppGaps.w4,
                        Expanded(
                          child: Text(
                            cart!.address,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final bool isOpen;

  const _StatusPill({required this.isOpen});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: Colors.black.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.circle,
          size: 8,
          color: isOpen ? const Color(0xFF4ADE80) : AppColors.grey400,
        ),
        AppGaps.w4,
        Text(
          (isOpen ? context.l10n.open : context.l10n.closed).toUpperCase(),
          style: AppTextStyles.tag.copyWith(color: AppColors.white),
        ),
      ],
    ),
  );
}

/// The open/closed switch, saying what it does for customers.
class _OpenSwitch extends StatelessWidget {
  final CartModel? cart;

  const _OpenSwitch({required this.cart});

  Future<void> _toggle(BuildContext context, bool value) async {
    final cart = this.cart;
    if (cart == null) return;
    try {
      await context.read<CartProvider>().toggleCartStatus(
        context.read<AuthProvider>().token ?? '',
        cart.id,
        value,
      );
    } catch (e) {
      if (!context.mounted) return;
      AppSnackBar.show(
        context,
        message: AppExceptionHandler.getMessage(e),
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isOpen = cart?.isOpen ?? false;
    final tint = isOpen ? AppColors.success : AppColors.grey500;
    return Material(
      color: isOpen
          ? AppColors.success.withValues(alpha: 0.1)
          : AppColors.grey100,
      borderRadius: BorderRadius.circular(12),
      // Only the switch toggles: closing the cart by a stray tap would stop orders.
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
        child: Row(
          children: [
            Icon(
              isOpen ? Icons.storefront_rounded : Icons.store_outlined,
              color: tint,
            ),
            AppGaps.w12,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isOpen ? l10n.cartOpen : l10n.closed,
                    style: AppTextStyles.body.copyWith(
                      color: isOpen ? AppColors.success : AppColors.black,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    isOpen ? l10n.acceptingOrders : l10n.cartClosedNote,
                    style: AppTextStyles.caption,
                  ),
                ],
              ),
            ),
            Switch(
              value: isOpen,
              onChanged: (v) => _toggle(context, v),
              activeTrackColor: AppColors.success,
              inactiveTrackColor: AppColors.grey300,
              thumbColor: WidgetStateProperty.all(Colors.white),
              trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
            ),
          ],
        ),
      ),
    );
  }
}

/// The cart ID customers and support quote, with a copy button.
class _CartId extends StatelessWidget {
  final String id;

  const _CartId({required this.id});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.tag_rounded, size: 18, color: AppColors.grey500),
          AppGaps.w8,
          Text(l10n.cartIdCaps, style: AppTextStyles.tag),
          AppGaps.w8,
          Expanded(
            child: Text(
              id,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body.copyWith(
                color: AppColors.black,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          IconButton(
            tooltip: l10n.cartIdCopied,
            icon: Icon(Icons.copy_rounded, size: 18, color: AppColors.grey500),
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: id));
              if (context.mounted) {
                AppSnackBar.show(
                  context,
                  message: l10n.cartIdCopied,
                  isInfo: true,
                );
              }
            },
          ),
        ],
      ),
    );
  }
}
