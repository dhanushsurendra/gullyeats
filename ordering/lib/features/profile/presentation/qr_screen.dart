import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/info_box.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/profile/providers/profile_provider.dart';
import 'package:ordering/features/profile/services/qr_service.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

class QrPosterScreen extends StatefulWidget {
  const QrPosterScreen({super.key});

  @override
  State<QrPosterScreen> createState() => _QrPosterScreenState();
}

class _QrPosterScreenState extends State<QrPosterScreen> {
  bool _isBtnLoading = false;
  bool _isLoading = true;
  final GlobalKey _qrKey = GlobalKey();

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadQrDetails();
    });
  }

  Future<void> _loadQrDetails() async {
    final provider = context.read<ProfileProvider>();
    final token = context.read<AuthProvider>().token;
    final cartId = context.read<CartProvider>().selectedCart?.id;

    if (cartId == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      await provider.loadQrDetails(token, cartId);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (!mounted) return;
      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _shareQr() async {
    setState(() => _isBtnLoading = true);
    final profileProvider = Provider.of<ProfileProvider>(
      context,
      listen: false,
    );

    try {
      await QrService.saveAndSharePdf(
        qrKey: _qrKey,
        cartName: profileProvider.cartName ?? "Cart",
        cartId: profileProvider.cartId ?? "",
      );
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);
      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isBtnLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final profile = context.watch<ProfileProvider>();

    return BaseScreen(
      title: l10n.qrCodePoster,
      subtitle: l10n.qrPosterSubtitle,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: AppFooter(
        children: [
          AppButton(
            label: l10n.shareQrCaps,
            isLoading: _isBtnLoading,
            onPressed: _shareQr,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          RepaintBoundary(
            key: _qrKey,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                // The poster is a printable graphic sized from its width, so
                // it ignores the phone's text size; otherwise the shared PDF
                // would change (and overflow) with each vendor's settings.
                return MediaQuery.withNoTextScaling(
                  child: _QrPosterCard(
                    width: width,
                    height: width * 1.414,
                    cartId: profile.cartId ?? "",
                    cartName: profile.cartName ?? "",
                    qrImageUrl: profile.qrImageUrl ?? "",
                    isLoading: _isLoading,
                  ),
                );
              },
            ),
          ),
          AppGaps.h24,
          InfoBox(icon: Icons.lightbulb_outline, lines: [l10n.qrPrintTip]),
        ],
      ),
    );
  }
}

// The printed poster stuck on the cart, identical in the onboarding and vendor
// apps so both share the same PDF. Night purple with orange, sized from its
// width only (A4 proportions); it stays in English, since customers read it.
// The QR sits on a white tile inside viewfinder corners: dark modules on
// white, with a quiet zone, so it scans even on a glossy laminated print.
class _QrPosterCard extends StatelessWidget {
  final double width;
  final double height;
  final String cartId;
  final String cartName;
  final String qrImageUrl;
  final bool isLoading;

  const _QrPosterCard({
    required this.width,
    required this.height,
    required this.cartId,
    required this.cartName,
    required this.qrImageUrl,
    required this.isLoading,
  });

  static const _orangeLight = Color(0xFFFF7A2E);

  TextStyle _text(
    double size, {
    Color color = Colors.white,
    FontWeight weight = FontWeight.w600,
    double? spacing,
    double? lineHeight,
  }) => TextStyle(
    fontFamily: 'Poppins',
    fontSize: width * size,
    color: color,
    fontWeight: weight,
    letterSpacing: spacing == null ? null : width * spacing,
    height: lineHeight,
  );

  @override
  Widget build(BuildContext context) {
    final w = width;
    final qr = w * 0.38;

    return ClipRRect(
      borderRadius: BorderRadius.circular(w * 0.05),
      child: Container(
        width: w,
        height: height,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.nightDeep, AppColors.night, AppColors.nightSoft],
          ),
        ),
        child: Stack(
          children: [
            // A soft lilac glow at the foot; the QR brings its own light (rays).
            Positioned(bottom: -w * 0.45, left: -w * 0.2, child: _glow(w * 1.4, AppColors.lilac, 0.18)),
            ..._doodles(w),
            Padding(
              padding: EdgeInsets.fromLTRB(w * 0.07, w * 0.065, w * 0.07, w * 0.07),
              child: Column(
                children: [
                  _header(w),
                  SizedBox(height: w * 0.045),
                  Text('HUNGRY?', style: _text(0.042, color: _orangeLight, weight: FontWeight.w700, spacing: 0.012)),
                  SizedBox(height: w * 0.008),
                  Text(
                    'Scan & order\nright here',
                    textAlign: TextAlign.center,
                    style: _text(0.078, weight: FontWeight.w700, lineHeight: 1.05),
                  ),
                  const Spacer(),
                  _qrBlock(w, qr),
                  const Spacer(),
                  _steps(w),
                  SizedBox(height: w * 0.035),
                  _ticket(w),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _glow(double size, Color color, double alpha) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      gradient: RadialGradient(
        colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)],
      ),
    ),
  );

  /// Faint street-food doodles around the edges, clear of the QR.
  List<Widget> _doodles(double w) {
    const icons = [
      (Icons.ramen_dining_rounded, 0.04, 0.30, -0.25),
      (Icons.local_cafe_rounded, 0.83, 0.36, 0.2),
      (Icons.lunch_dining_rounded, 0.03, 0.66, 0.18),
      (Icons.local_pizza_rounded, 0.85, 0.70, -0.3),
      (Icons.icecream_rounded, 0.06, 0.94, 0.25),
      (Icons.kebab_dining_rounded, 0.86, 1.02, -0.15),
    ];
    return [
      for (final (icon, x, y, turn) in icons)
        Positioned(
          left: w * x,
          top: w * y,
          child: Transform.rotate(
            angle: turn,
            child: Icon(icon, size: w * 0.1, color: Colors.white.withValues(alpha: 0.07)),
          ),
        ),
    ];
  }

  Widget _header(double w) => Row(
    children: [
      Text.rich(
        TextSpan(
          children: [
            TextSpan(text: 'Gully', style: _text(0.068, color: AppColors.primary, weight: FontWeight.w700)),
            TextSpan(text: 'Eats', style: _text(0.068, weight: FontWeight.w700)),
          ],
        ),
      ),
      const Spacer(),
      Container(
        padding: EdgeInsets.symmetric(horizontal: w * 0.028, vertical: w * 0.012),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(w),
          border: Border.all(color: AppColors.lilac.withValues(alpha: 0.6), width: w * 0.004),
        ),
        child: Text('NO APP NEEDED', style: _text(0.022, color: AppColors.lilac, weight: FontWeight.w700, spacing: 0.004)),
      ),
    ],
  );

  /// The QR on a glowing white tile, framed by orange viewfinder corners.
  Widget _qrBlock(double w, double qr) {
    final frame = qr + w * 0.12;
    final rays = w * 1.6;
    return SizedBox.square(
      dimension: frame,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: (frame - rays) / 2,
            top: (frame - rays) / 2,
            child: CustomPaint(size: Size.square(rays), painter: const _Sunburst()),
          ),
          _glow(frame * 1.25, AppColors.primary, 0.28),
          CustomPaint(
            size: Size.square(frame),
            painter: _ViewfinderCorners(color: AppColors.primary, stroke: w * 0.012, length: w * 0.09),
          ),
          Container(
            padding: EdgeInsets.all(w * 0.022),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(w * 0.04),
              boxShadow: [
                BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: w * 0.09),
              ],
            ),
            child: SizedBox.square(dimension: qr, child: _qrImage(qr)),
          ),
        ],
      ),
    );
  }

  Widget _qrImage(double size) {
    if (isLoading) return _qrPlaceholder(size);
    if (qrImageUrl.isEmpty) return Icon(Icons.qr_code_2_rounded, size: size, color: const Color(0xFFBDBDBD));
    return Image.network(
      qrImageUrl,
      width: size,
      height: size,
      loadingBuilder: (context, child, progress) => progress == null ? child : _qrPlaceholder(size),
      errorBuilder: (_, _, _) => Icon(Icons.qr_code_2_rounded, size: size, color: const Color(0xFFBDBDBD)),
    );
  }

  /// The QR's place while it loads, on the always-white tile.
  Widget _qrPlaceholder(double size) => Shimmer(
    base: const Color(0xFFEEEEEE),
    highlight: const Color(0xFFF8F8F8),
    child: Bone(width: size, height: size),
  );

  /// Scan → Order → Pay & eat, so a first-timer knows what happens next.
  Widget _steps(double w) {
    Widget step(IconData icon, String label) => Column(
      children: [
        Container(
          width: w * 0.085,
          height: w * 0.085,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.08),
            border: Border.all(color: Colors.white.withValues(alpha: 0.18), width: w * 0.003),
          ),
          child: Icon(icon, size: w * 0.045, color: _orangeLight),
        ),
        SizedBox(height: w * 0.014),
        Text(label, style: _text(0.027, weight: FontWeight.w600)),
      ],
    );
    Widget arrow() => Padding(
      padding: EdgeInsets.only(bottom: w * 0.04),
      child: Icon(Icons.arrow_forward_rounded, size: w * 0.04, color: AppColors.lilac.withValues(alpha: 0.7)),
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        step(Icons.qr_code_scanner_rounded, 'Scan'),
        arrow(),
        step(Icons.restaurant_menu_rounded, 'Order'),
        arrow(),
        step(Icons.payments_rounded, 'Pay & eat'),
      ],
    );
  }

  /// The cart's name on a white ticket (the order-token look): dark purple on
  /// white reads from across the street, and a long name wraps to two lines
  /// in a smaller size instead of being cut off. The stub holds the cart ID.
  Widget _ticket(double w) {
    final height = w * 0.2;
    final stub = w * 0.24;
    final n = cartName.length;
    final nameSize = n <= 16 ? 0.062 : (n <= 26 ? 0.05 : (n <= 40 ? 0.042 : 0.035));
    return SizedBox(
      height: height,
      child: ClipPath(
        clipper: _TicketClipper(notchAt: 1 - stub / (w * 0.86), notch: w * 0.028, radius: w * 0.035),
        child: Container(
          color: Colors.white,
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: w * 0.045),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ORDERING FROM',
                        style: _text(0.021, color: AppColors.primary, weight: FontWeight.w700, spacing: 0.006),
                      ),
                      SizedBox(height: w * 0.004),
                      Text(
                        cartName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: _text(nameSize, color: AppColors.night, weight: FontWeight.w700, lineHeight: 1.1),
                      ),
                    ],
                  ),
                ),
              ),
              CustomPaint(
                size: Size(w * 0.004, height),
                painter: _DashedLine(color: const Color(0xFFD9D3EA), dash: w * 0.014, gap: w * 0.01),
              ),
              SizedBox(
                width: stub,
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: w * 0.02),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.storefront_rounded, size: w * 0.055, color: AppColors.primary),
                      SizedBox(height: w * 0.006),
                      Text('CART ID', style: _text(0.017, color: const Color(0xFF8A84A3), weight: FontWeight.w600, spacing: 0.004)),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(cartId, style: _text(0.024, color: AppColors.night, weight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Faint rays fanning out from the centre, like a street-poster sunburst.
class _Sunburst extends CustomPainter {
  const _Sunburst();

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2;
    const count = 28;
    final paint = Paint()..color = Colors.white.withValues(alpha: 0.045);
    for (var i = 0; i < count; i += 2) {
      final a = 2 * math.pi * i / count;
      final b = 2 * math.pi * (i + 1) / count;
      canvas.drawPath(
        Path()
          ..moveTo(c.dx, c.dy)
          ..lineTo(c.dx + r * math.cos(a), c.dy + r * math.sin(a))
          ..lineTo(c.dx + r * math.cos(b), c.dy + r * math.sin(b))
          ..close(),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_Sunburst old) => false;
}

/// A rounded ticket with a half-circle notch top and bottom where it tears
/// ([notchAt]: how far along, 0 to 1).
class _TicketClipper extends CustomClipper<Path> {
  final double notchAt;
  final double notch;
  final double radius;

  const _TicketClipper({required this.notchAt, required this.notch, required this.radius});

  @override
  Path getClip(Size size) {
    final x = size.width * notchAt;
    final card = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)));
    final holes = Path()
      ..addOval(Rect.fromCircle(center: Offset(x, 0), radius: notch))
      ..addOval(Rect.fromCircle(center: Offset(x, size.height), radius: notch));
    return Path.combine(PathOperation.difference, card, holes);
  }

  @override
  bool shouldReclip(_TicketClipper old) =>
      old.notchAt != notchAt || old.notch != notch || old.radius != radius;
}

/// A vertical dashed tear line.
class _DashedLine extends CustomPainter {
  final Color color;
  final double dash;
  final double gap;

  const _DashedLine({required this.color, required this.dash, required this.gap});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = size.width
      ..strokeCap = StrokeCap.round;
    for (var y = dash; y < size.height - dash; y += dash + gap) {
      canvas.drawLine(Offset(size.width / 2, y), Offset(size.width / 2, y + dash), paint);
    }
  }

  @override
  bool shouldRepaint(_DashedLine old) => old.color != color || old.dash != dash || old.gap != gap;
}

/// Four rounded L-shaped corners, like a camera viewfinder.
class _ViewfinderCorners extends CustomPainter {
  final Color color;
  final double stroke;
  final double length;

  const _ViewfinderCorners({required this.color, required this.stroke, required this.length});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = stroke
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final (w, h, l, i) = (size.width, size.height, length, stroke / 2);
    canvas.drawPath(
      Path()
        ..moveTo(i, l)
        ..lineTo(i, i)
        ..lineTo(l, i)
        ..moveTo(w - l, i)
        ..lineTo(w - i, i)
        ..lineTo(w - i, l)
        ..moveTo(w - i, h - l)
        ..lineTo(w - i, h - i)
        ..lineTo(w - l, h - i)
        ..moveTo(l, h - i)
        ..lineTo(i, h - i)
        ..lineTo(i, h - l),
      paint,
    );
  }

  @override
  bool shouldRepaint(_ViewfinderCorners old) =>
      old.color != color || old.stroke != stroke || old.length != length;
}
