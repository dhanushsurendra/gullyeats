import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/voice/wave_detector.dart';

void main() {
  final t0 = DateTime(2026, 11, 17, 12);
  DateTime at(int ms) => t0.add(Duration(milliseconds: ms));

  test('a quick wave counts once', () {
    final d = WaveDetector();
    expect(d.add(near: true, at: at(0)), isFalse);
    expect(d.add(near: false, at: at(400)), isTrue);
  });

  test('covered too long (face down, pocket) never counts', () {
    final d = WaveDetector();
    d.add(near: true, at: at(0));
    expect(d.add(near: false, at: at(5000)), isFalse);
  });

  test('a clear reading without a near one first does nothing', () {
    expect(WaveDetector().add(near: false, at: at(0)), isFalse);
  });

  test('two waves close together count once; later ones count again', () {
    final d = WaveDetector();
    d.add(near: true, at: at(0));
    expect(d.add(near: false, at: at(300)), isTrue);
    d.add(near: true, at: at(800));
    expect(d.add(near: false, at: at(1100)), isFalse, reason: 'within the cooldown');
    d.add(near: true, at: at(4000));
    expect(d.add(near: false, at: at(4300)), isTrue);
  });
}
