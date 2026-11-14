import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_theme.dart';
import 'package:gullyeats/features/activation/providers/activation_provider.dart';
import 'package:gullyeats/features/activation/screens/qr_poster_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'responsive/harness.dart';

final _navigator = GlobalKey<NavigatorState>();

/// Your Carts → (some onboarding step) → QR poster, like the real flow.
Future<void> _openPoster(WidgetTester tester) async {
  tester.view.physicalSize = const Size(393, 852);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final p = TestProviders();
  await p.cart.loadCartId();
  await p.cart.loadCartDetails();
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: p.auth),
        ChangeNotifierProvider.value(value: p.cart),
        // No server in tests: the QR comes back at once (its image is _PngImages).
        ChangeNotifierProvider<CartActivatedProvider>.value(value: _FakeQr()),
      ],
      child: MaterialApp(
        navigatorKey: _navigator,
        theme: AppTheme.current,
        initialRoute: AppRoutes.carts,
        routes: {
          AppRoutes.carts: (_) => const Scaffold(body: Text('OUTLETS')),
          AppRoutes.cartActivated: (_) =>
              const Scaffold(body: Text('ACTIVATED')),
          AppRoutes.qrPoster: (_) => const QrPosterScreen(),
        },
      ),
    ),
  );
  _navigator.currentState!.pushNamed(AppRoutes.cartActivated);
  _navigator.currentState!.pushNamed(AppRoutes.qrPoster);
  await tester.pump();
  // The QR image downloads and decodes in real time; until then its
  // loading shimmer keeps animating and pumpAndSettle would never settle.
  bool qrShown() => find
      .byType(RawImage)
      .evaluate()
      .any((e) => (e.widget as RawImage).image != null);
  for (var i = 0; i < 40 && !qrShown(); i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 50)),
    );
    await tester.pump();
  }
  await tester.pumpAndSettle();
}

/// Fakes the file and share-sheet plugins so sharing succeeds in a test.
void _fakeSharePlugins() {
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/path_provider'),
    (_) async => Directory.systemTemp.path,
  );
  messenger.setMockMethodCallHandler(
    const MethodChannel('dev.fluttercommunity.plus/share'),
    (_) async => 'dev.fluttercommunity.plus/share/success',
  );
}

class _FakeQr extends CartActivatedProvider {
  @override
  Future<String> loadQR(String? token, String cartId) async =>
      'https://bucket.test/carts/c1/qr.png';
}

/// Tests can't reach the internet, so the poster's QR image (which must
/// download before sharing) is served as a 1x1 PNG.
class _PngImages extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) => _PngClient();
}

final _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
);

class _PngClient implements HttpClient {
  @override
  bool autoUncompress = true;

  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _PngRequest();

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _PngRequest implements HttpClientRequest {
  @override
  Future<HttpClientResponse> close() async => _PngResponse();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _PngResponse extends Stream<List<int>> implements HttpClientResponse {
  @override
  int get statusCode => 200;

  @override
  int get contentLength => _png.length;

  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;

  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int>)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) => Stream.value(_png as List<int>).listen(
    onData,
    onError: onError,
    onDone: onDone,
    cancelOnError: cancelOnError,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _share(WidgetTester tester) async {
  await tester.runAsync(() async {
    await tester.tap(find.text('SHARE QR'));
    // Capturing the poster and writing the PDF need real async time.
    for (
      var i = 0;
      i < 20 && find.text('BACK TO OUTLETS').evaluate().isEmpty;
      i++
    ) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
      await tester.pump();
    }
  });
  await tester.pumpAndSettle();
}

void main() {
  // The poster is drawn in the bundled Poppins; the test font is wider.
  setUpAll(loadFonts);
  setUp(() {
    SharedPreferences.setMockInitialValues({
      'cart': jsonEncode({
        '_id': 'c1',
        'cartName': 'Dosa Point',
        'cartId': 'CRT-1',
      }),
    });
    _fakeSharePlugins();
    HttpOverrides.global = _PngImages();
  });
  tearDown(() => HttpOverrides.global = null);

  testWidgets('before sharing, back returns to the previous step', (
    tester,
  ) async {
    await _openPoster(tester);
    expect(find.text('BACK TO OUTLETS'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('ACTIVATED'), findsOneWidget);
  });

  testWidgets('after sharing, the new button goes straight to Your Carts', (
    tester,
  ) async {
    await _openPoster(tester);
    await _share(tester);

    await tester.tap(find.text('BACK TO OUTLETS'));
    await tester.pumpAndSettle();
    expect(find.text('OUTLETS'), findsOneWidget);
  });

  testWidgets('after sharing, system back also goes to Your Carts', (
    tester,
  ) async {
    await _openPoster(tester);
    await _share(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('OUTLETS'), findsOneWidget);
    expect(find.text('ACTIVATED'), findsNothing);
  });
}
