import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ordering/features/weather/mood.dart';

/// Sunny (a baby squirrel) and Chill (a baby penguin), drawn in code: no image
/// files, sharp at any size. One 4 s loop drives blinking, breathing, a small
/// bounce, Sunny's tail, umbrellas and rain. Still when the phone asks for
/// less motion, and paused by the TickerMode of a hidden tab.
class CharacterView extends StatefulWidget {
  final Mood mood;
  final double size;

  const CharacterView({super.key, required this.mood, this.size = 56});

  @override
  State<CharacterView> createState() => _CharacterViewState();
}

class _CharacterViewState extends State<CharacterView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _loop.stop();
      _loop.value = 0.25; // eyes open, mid-breath
    } else if (!_loop.isAnimating) {
      _loop.repeat();
    }
  }

  @override
  void dispose() {
    _loop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: SizedBox.square(
        dimension: widget.size,
        child: CustomPaint(painter: CharacterPainter(widget.mood, _loop)),
      ),
    );
  }
}

const _caramel = Color(0xFFD9822B);
const _caramelDark = Color(0xFFB4651C);
const _tailLight = Color(0xFFF2B46B);
const _cream = Color(0xFFFCE7C8);
const _ink = Color(0xFF1F2430);
const _charcoal = Color(0xFF2E3446);
const _snow = Color(0xFFF7F7F4);
const _beak = Color(0xFFF59E0B);
const _blush = Color(0x66FF8FA3);
const _earPink = Color(0xFFF6B3AE);

/// Paints [mood] in a 100×100 box scaled to the canvas; [loop] is 0..1.
class CharacterPainter extends CustomPainter {
  final Mood mood;
  final Animation<double> loop;

  CharacterPainter(this.mood, this.loop) : super(repaint: loop);

  double get t => loop.value;
  double wave([double cycles = 1, double phase = 0]) =>
      math.sin(2 * math.pi * (t * cycles + phase));
  bool get blinking => t > 0.90 && t < 0.94;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    switch (mood.character) {
      case Character.sunny:
        _withBody(canvas, () => _squirrel(canvas));
      case Character.chill:
        _withBody(canvas, () => _penguin(canvas));
      case Character.both:
        _sleeping(canvas);
    }
    canvas.restore();
  }

  // Breathing (a slight stretch from the feet) and a gentle bounce.
  void _withBody(Canvas canvas, VoidCallback draw) {
    canvas.save();
    final bounce = -1.6 * (0.5 + 0.5 * wave(2));
    final breath = 1 + 0.025 * wave(1, 0.25);
    canvas.translate(50, 96 + bounce);
    canvas.scale(1 / breath, breath);
    canvas.translate(-50, -96);
    draw();
    canvas.restore();
  }

  Paint _fill(Color c) => Paint()..color = c;

  void _eyes(
    Canvas canvas,
    Offset l,
    Offset r,
    double radius, {
    bool closed = false,
  }) {
    for (final c in [l, r]) {
      if (closed || blinking) {
        canvas.drawArc(
          Rect.fromCircle(center: c.translate(0, -1), radius: radius * 0.8),
          0.15 * math.pi,
          0.7 * math.pi,
          false,
          Paint()
            ..color = _ink
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.6
            ..strokeCap = StrokeCap.round,
        );
        continue;
      }
      canvas.drawOval(
        Rect.fromCenter(center: c, width: radius * 1.8, height: radius * 2.1),
        _fill(_ink),
      );
      // The glossy shine.
      canvas.drawCircle(
        c.translate(-radius * 0.32, -radius * 0.42),
        radius * 0.36,
        _fill(Colors.white),
      );
      canvas.drawCircle(
        c.translate(radius * 0.3, radius * 0.35),
        radius * 0.15,
        _fill(Colors.white70),
      );
    }
  }

  void _cheeks(Canvas canvas, Offset l, Offset r) {
    canvas.drawCircle(l, 4.2, _fill(_blush));
    canvas.drawCircle(r, 4.2, _fill(_blush));
  }

  void _smile(Canvas canvas, Offset at, {double width = 5}) {
    canvas.drawArc(
      Rect.fromCenter(center: at, width: width, height: width * 0.8),
      0.1 * math.pi,
      0.8 * math.pi,
      false,
      Paint()
        ..color = _ink
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.1
        ..strokeCap = StrokeCap.round,
    );
  }

  void _rain(Canvas canvas, {int drops = 7, double slant = 0}) {
    final paint = Paint()
      ..color = const Color(0xFF7DB4F5)
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round;
    final rnd = math.Random(7);
    for (var i = 0; i < drops; i++) {
      final x = rnd.nextDouble() * 100;
      final y = ((rnd.nextDouble() + t * 2) % 1) * 100;
      canvas.drawLine(Offset(x, y), Offset(x - slant, y + 5), paint);
    }
  }

  void _umbrella(
    Canvas canvas,
    Color color,
    Offset hand, {
    double radius = 30,
  }) {
    canvas.save();
    canvas.translate(hand.dx, hand.dy);
    canvas.rotate(0.06 * wave());
    final top = -radius * 1.75;
    canvas.drawLine(
      Offset.zero,
      Offset(0, top),
      Paint()
        ..color = const Color(0xFF6B4A2B)
        ..strokeWidth = 1.8,
    );
    // Canopy: a half dome with scalloped edge.
    final canopy = Path()
      ..moveTo(-radius, top + radius * 0.55)
      ..arcToPoint(
        Offset(radius, top + radius * 0.55),
        radius: Radius.circular(radius),
        clockwise: true,
      );
    for (var i = 0; i < 4; i++) {
      final x1 = radius - i * radius / 2;
      canopy.arcToPoint(
        Offset(x1 - radius / 2, top + radius * 0.55),
        radius: Radius.circular(radius / 4),
        clockwise: false,
      );
    }
    canopy.close();
    canvas.drawPath(canopy, _fill(color));
    canvas.drawPath(
      Path()
        ..moveTo(0, top - radius * 0.45)
        ..lineTo(-radius * 0.45, top + radius * 0.5)
        ..moveTo(0, top - radius * 0.45)
        ..lineTo(radius * 0.45, top + radius * 0.5),
      Paint()
        ..color = Colors.white24
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
    // The hook of the handle.
    canvas.drawArc(
      Rect.fromCenter(center: const Offset(-2.2, 0), width: 4.4, height: 4.4),
      0,
      math.pi,
      false,
      Paint()
        ..color = const Color(0xFF6B4A2B)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8,
    );
    canvas.restore();
  }

  // ---- Sunny ----

  void _squirrel(Canvas canvas) {
    final m = mood;
    if (m == Mood.sunnyRain) _rain(canvas, drops: 6);
    if (m == Mood.sunnyCloudy) {
      _cloud(canvas, Offset(14 + 2 * wave(0.5), 20), 0.9);
    }
    if (m == Mood.sunnyClear || m == Mood.sunnyHot) {
      _sun(canvas, const Offset(16, 16));
    }

    // Tail, swaying from its base.
    canvas.save();
    canvas.translate(62, 80);
    canvas.rotate(0.12 * wave(1, 0.1));
    canvas.translate(-62, -80);
    final tail = Path()
      ..moveTo(58, 86)
      ..cubicTo(92, 84, 98, 46, 84, 26)
      ..cubicTo(74, 10, 52, 14, 58, 30)
      ..cubicTo(62, 40, 76, 36, 72, 48)
      ..cubicTo(68, 62, 56, 66, 58, 86)
      ..close();
    canvas.drawPath(tail, _fill(_caramel));
    final stripe = Path()
      ..moveTo(64, 80)
      ..cubicTo(86, 76, 90, 50, 80, 32)
      ..cubicTo(74, 22, 64, 22, 64, 28)
      ..cubicTo(72, 30, 80, 40, 76, 52)
      ..cubicTo(72, 66, 62, 70, 64, 80)
      ..close();
    canvas.drawPath(stripe, _fill(_tailLight));
    canvas.restore();

    // Body, belly and feet.
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 74), width: 40, height: 42),
      _fill(_caramel),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 78), width: 24, height: 30),
      _fill(_cream),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(37, 94), width: 12, height: 6),
      _fill(_caramelDark),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(55, 94), width: 12, height: 6),
      _fill(_caramelDark),
    );

    // Ears with tufts.
    for (final x in [30.0, 62.0]) {
      final ear = Path()
        ..moveTo(x - 7, 30)
        ..quadraticBezierTo(x - 2, 10, x + 2, 12)
        ..quadraticBezierTo(x + 9, 18, x + 7, 30)
        ..close();
      canvas.drawPath(ear, _fill(_caramel));
      canvas.drawOval(
        Rect.fromCenter(center: Offset(x + 0.5, 23), width: 6, height: 10),
        _fill(_earPink),
      );
    }

    // Head and muzzle.
    canvas.drawCircle(const Offset(46, 42), 22, _fill(_caramel));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 52), width: 24, height: 17),
      _fill(_cream),
    );
    _cheeks(canvas, const Offset(31, 50), const Offset(61, 50));
    if (m == Mood.sunnyClear || m == Mood.sunnyHot) {
      _sunglasses(canvas);
    } else {
      _eyes(canvas, const Offset(38.5, 41), const Offset(53.5, 41), 4.8);
    }
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 48.5), width: 5, height: 3.4),
      _fill(_ink),
    );
    _smile(canvas, const Offset(43.8, 52));
    _smile(canvas, const Offset(48.2, 52));

    // Paws, and what they hold.
    if (m == Mood.sunnyHot) _bottle(canvas, const Offset(60, 58));
    if (m == Mood.sunnyHot) _sweat(canvas, const Offset(68, 30));
    if (m == Mood.sunnyRain) {
      _umbrella(
        canvas,
        const Color(0xFFFFC21A),
        const Offset(62, 64),
        radius: 26,
      );
    }
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(38, 64), width: 9, height: 7),
      _fill(_caramelDark),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(57, 64), width: 9, height: 7),
      _fill(_caramelDark),
    );
  }

  void _sunglasses(Canvas canvas) {
    final lens = _fill(const Color(0xFF1B1F2A));
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: const Offset(38.5, 41), width: 12, height: 8.5),
        const Radius.circular(3.5),
      ),
      lens,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: const Offset(53.5, 41), width: 12, height: 8.5),
        const Radius.circular(3.5),
      ),
      lens,
    );
    canvas.drawLine(
      const Offset(44.5, 40),
      const Offset(47.5, 40),
      Paint()
        ..color = const Color(0xFF1B1F2A)
        ..strokeWidth = 1.4,
    );
    final shine = Paint()
      ..color = Colors.white54
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(34.5, 40), const Offset(37, 37.8), shine);
    canvas.drawLine(const Offset(49.5, 40), const Offset(52, 37.8), shine);
  }

  void _sun(Canvas canvas, Offset c) {
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(t * 2 * math.pi / 4);
    final ray = Paint()
      ..color = const Color(0xFFFFC21A)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 8; i++) {
      final a = i * math.pi / 4;
      canvas.drawLine(
        Offset(math.cos(a) * 9, math.sin(a) * 9),
        Offset(math.cos(a) * 12.5, math.sin(a) * 12.5),
        ray,
      );
    }
    canvas.restore();
    canvas.drawCircle(c, 7, _fill(const Color(0xFFFFC21A)));
  }

  void _cloud(Canvas canvas, Offset c, double s) {
    final p = _fill(Colors.white.withValues(alpha: 0.95));
    canvas.drawOval(
      Rect.fromCenter(center: c, width: 22 * s, height: 10 * s),
      p,
    );
    canvas.drawCircle(c.translate(-4 * s, -4 * s), 6 * s, p);
    canvas.drawCircle(c.translate(4 * s, -5 * s), 7 * s, p);
  }

  void _bottle(Canvas canvas, Offset at) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(at.dx - 3.5, at.dy - 8, 7, 14),
        const Radius.circular(2.5),
      ),
      _fill(const Color(0xFF5FB4F0)),
    );
    canvas.drawRect(
      Rect.fromLTWH(at.dx - 2, at.dy - 10.5, 4, 3),
      _fill(const Color(0xFF2E7BC6)),
    );
    canvas.drawRect(
      Rect.fromLTWH(at.dx - 3.5, at.dy - 2, 7, 3),
      _fill(Colors.white70),
    );
  }

  void _sweat(Canvas canvas, Offset at) {
    final y = at.dy + 3 * ((t * 2) % 1);
    final drop = Path()
      ..moveTo(at.dx, y - 4)
      ..quadraticBezierTo(at.dx + 3, y + 1, at.dx, y + 2)
      ..quadraticBezierTo(at.dx - 3, y + 1, at.dx, y - 4);
    canvas.drawPath(drop, _fill(const Color(0xFF8FD0FF)));
  }

  // ---- Chill ----

  void _penguin(Canvas canvas) {
    final m = mood;
    if (m == Mood.chillRain) _rain(canvas, drops: 6);
    if (m == Mood.chillHeavyRain) _rain(canvas, drops: 14, slant: 2.5);
    final coat = m == Mood.chillHeavyRain ? const Color(0xFFFACC15) : _charcoal;

    // Flippers, flapping a little.
    for (final side in [-1.0, 1.0]) {
      canvas.save();
      canvas.translate(50 + side * 22, 58);
      canvas.rotate(side * (0.35 + 0.08 * wave(1, side > 0 ? 0 : 0.5)));
      canvas.drawOval(
        Rect.fromCenter(center: const Offset(0, 9), width: 9, height: 22),
        _fill(coat),
      );
      canvas.restore();
    }
    // A soft light rim, so the dark body stands out on a night sky.
    _penguinRim(canvas, const Offset(50, 62), const Offset(50, 40));
    // Body and belly.
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 62), width: 50, height: 66),
      _fill(coat),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 69), width: 34, height: 46),
      _fill(_snow),
    );
    if (m == Mood.chillHeavyRain) {
      // Raincoat buttons, hood rim and boots.
      for (final y in [62.0, 72.0, 82.0]) {
        canvas.drawCircle(Offset(50, y), 1.4, _fill(const Color(0xFFB45309)));
      }
      canvas.drawArc(
        Rect.fromCenter(center: const Offset(50, 40), width: 52, height: 46),
        math.pi * 1.05,
        math.pi * 0.9,
        false,
        Paint()
          ..color = const Color(0xFFEAB308)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: const Offset(41, 94), width: 11, height: 8),
          const Radius.circular(2.5),
        ),
        _fill(const Color(0xFF15803D)),
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: const Offset(59, 94), width: 11, height: 8),
          const Radius.circular(2.5),
        ),
        _fill(const Color(0xFF15803D)),
      );
    } else {
      canvas.drawOval(
        Rect.fromCenter(center: const Offset(42, 95), width: 11, height: 5),
        _fill(_beak),
      );
      canvas.drawOval(
        Rect.fromCenter(center: const Offset(58, 95), width: 11, height: 5),
        _fill(_beak),
      );
    }
    // Face: a heart-shaped white mask.
    final faceTop = m == Mood.chillHeavyRain ? coat : _charcoal;
    canvas.drawCircle(const Offset(50, 40), 21, _fill(faceTop));
    canvas.drawCircle(const Offset(43, 43), 11, _fill(_snow));
    canvas.drawCircle(const Offset(57, 43), 11, _fill(_snow));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 50), width: 20, height: 12),
      _fill(_snow),
    );
    _cheeks(canvas, const Offset(36.5, 50), const Offset(63.5, 50));
    _eyes(canvas, const Offset(43, 42), const Offset(57, 42), 4.6);
    final beak = Path()
      ..moveTo(46, 48)
      ..quadraticBezierTo(50, 46.5, 54, 48)
      ..quadraticBezierTo(51, 54, 50, 54)
      ..quadraticBezierTo(49, 54, 46, 48)
      ..close();
    canvas.drawPath(beak, _fill(_beak));

    if (m == Mood.chillCool || m == Mood.chillEvening) {
      _scarf(
        canvas,
        m == Mood.chillCool ? const Color(0xFFE4572E) : const Color(0xFF8B5CF6),
      );
    }
    if (m == Mood.chillRain) {
      _umbrella(
        canvas,
        const Color(0xFF4F8EF7),
        const Offset(73, 66),
        radius: 24,
      );
    }
    if (m == Mood.chillHeavyRain) {
      _umbrella(
        canvas,
        const Color(0xFF4F8EF7),
        const Offset(74, 66),
        radius: 27,
      );
    }
  }

  void _scarf(Canvas canvas, Color color) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(31, 55, 38, 7),
        const Radius.circular(3.5),
      ),
      _fill(color),
    );
    canvas.save();
    canvas.translate(60, 60);
    canvas.rotate(0.15 + 0.05 * wave(1, 0.3));
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(-3, 0, 7, 15),
        const Radius.circular(2.5),
      ),
      _fill(color),
    );
    canvas.restore();
    final stripe = Paint()
      ..color = Colors.white60
      ..strokeWidth = 1.2;
    for (final x in [38.0, 46.0, 54.0, 62.0]) {
      canvas.drawLine(Offset(x, 56), Offset(x, 61), stripe);
    }
  }

  // ---- Both, asleep ----

  void _sleeping(Canvas canvas) {
    // Slow breathing only: no bounce while asleep.
    final breath = 1 + 0.03 * wave(0.5);
    canvas.save();
    canvas.translate(2, 22);
    canvas.scale(0.56, 0.56 * breath);
    _sleepySquirrel(canvas);
    canvas.restore();
    canvas.save();
    canvas.translate(44, 22);
    canvas.scale(0.56, 0.56 * breath);
    _sleepyPenguin(canvas);
    canvas.restore();
    // Floating "z"s.
    for (var i = 0; i < 3; i++) {
      final p = (t * 0.5 + i / 3) % 1;
      final tp = TextPainter(
        text: TextSpan(
          text: 'z',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 1 - p),
            fontSize: 7 + 5 * p,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(66 + 14 * p, 24 - 22 * p));
    }
  }

  void _sleepySquirrel(Canvas canvas) {
    final tail = Path()
      ..moveTo(58, 88)
      ..cubicTo(96, 86, 96, 44, 78, 34)
      ..cubicTo(64, 28, 56, 44, 66, 50)
      ..cubicTo(74, 56, 66, 70, 58, 88)
      ..close();
    canvas.drawPath(tail, _fill(_caramel));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 74), width: 40, height: 40),
      _fill(_caramel),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 78), width: 24, height: 28),
      _fill(_cream),
    );
    for (final x in [30.0, 62.0]) {
      canvas.drawOval(
        Rect.fromCenter(center: Offset(x, 26), width: 12, height: 16),
        _fill(_caramel),
      );
      canvas.drawOval(
        Rect.fromCenter(center: Offset(x, 27), width: 6, height: 9),
        _fill(_earPink),
      );
    }
    canvas.drawCircle(const Offset(46, 44), 21, _fill(_caramel));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 53), width: 24, height: 16),
      _fill(_cream),
    );
    _cheeks(canvas, const Offset(32, 51), const Offset(60, 51));
    _eyes(
      canvas,
      const Offset(38.5, 44),
      const Offset(53.5, 44),
      4.8,
      closed: true,
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(46, 50.5), width: 5, height: 3.4),
      _fill(_ink),
    );
  }

  void _penguinRim(Canvas canvas, Offset body, Offset head) {
    final rim = _fill(Colors.white.withValues(alpha: 0.35));
    canvas.drawOval(Rect.fromCenter(center: body, width: 53, height: 69), rim);
    canvas.drawCircle(head, 22.5, rim);
  }

  void _sleepyPenguin(Canvas canvas) {
    _penguinRim(canvas, const Offset(50, 64), const Offset(50, 42));
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 64), width: 50, height: 62),
      _fill(_charcoal),
    );
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(50, 70), width: 34, height: 42),
      _fill(_snow),
    );
    canvas.drawCircle(const Offset(50, 42), 21, _fill(_charcoal));
    canvas.drawCircle(const Offset(43, 45), 11, _fill(_snow));
    canvas.drawCircle(const Offset(57, 45), 11, _fill(_snow));
    _cheeks(canvas, const Offset(36.5, 52), const Offset(63.5, 52));
    _eyes(
      canvas,
      const Offset(43, 45),
      const Offset(57, 45),
      4.6,
      closed: true,
    );
    canvas.drawPath(
      Path()
        ..moveTo(46, 50)
        ..quadraticBezierTo(50, 48.5, 54, 50)
        ..quadraticBezierTo(50, 55, 46, 50)
        ..close(),
      _fill(_beak),
    );
    // Nightcap with a pom-pom.
    final cap = Path()
      ..moveTo(30, 34)
      ..quadraticBezierTo(50, 14, 70, 34)
      ..quadraticBezierTo(80, 18, 88, 30)
      ..quadraticBezierTo(70, 22, 66, 36)
      ..close();
    canvas.drawPath(cap, _fill(const Color(0xFF6366F1)));
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(29, 31, 42, 6),
        const Radius.circular(3),
      ),
      _fill(Colors.white),
    );
    canvas.drawCircle(const Offset(88, 30), 4, _fill(Colors.white));
  }

  @override
  bool shouldRepaint(CharacterPainter old) => old.mood != mood;
}
