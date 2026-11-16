import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/weather/characters.dart';
import 'package:ordering/features/weather/mood.dart';

// Every mood once, as a reference picture (goldens/characters.png).
// Regenerate with --update-goldens after an intended change to the drawings.
void main() {
  testWidgets('Sunny and Chill in every outfit', (tester) async {
    tester.view.physicalSize = const Size(900, 340);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        home: MediaQuery(
          // Still frame: eyes open, mid-breath.
          data: const MediaQueryData(disableAnimations: true),
          child: Material(
            color: const Color(0xFFEFF3FA),
            child: Wrap(
              children: [
                for (final m in Mood.values)
                  Container(
                    width: 180,
                    height: 170,
                    margin: EdgeInsets.zero,
                    color: m.character == Character.sunny
                        ? const Color(0xFFBFE3FF)
                        : const Color(0xFF1E2A4A),
                    child: Center(child: CharacterView(mood: m, size: 150)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    await expectLater(
      find.byType(Wrap),
      matchesGoldenFile('goldens/characters.png'),
    );
  });
}
