import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/features/onboarding/models/cart_model.dart';
import 'package:gullyeats/features/onboarding/onboarding_progress.dart';

CartModel _cart({String image = '', String address = '', List<num>? coords, String qr = ''}) =>
    CartModel.fromJson({
      '_id': 'c1',
      'cartName': 'Dosa Point',
      'cartImageUrl': image,
      'address': address,
      'qrImageUrl': qr,
      if (coords != null) 'location': {'type': 'Point', 'coordinates': coords},
    });

void main() {
  test('resumes at the first unfinished step', () {
    expect(nextOnboardingRoute(_cart(), hasMenu: false), AppRoutes.cartPhoto);
    expect(nextOnboardingRoute(_cart(image: 'p.jpg'), hasMenu: false), AppRoutes.enableLocation);
    expect(nextOnboardingRoute(_cart(image: 'p.jpg', address: 'Indiranagar'), hasMenu: false),
        AppRoutes.addMenu);
    expect(nextOnboardingRoute(_cart(image: 'p.jpg', coords: [12.9, 77.6]), hasMenu: true),
        AppRoutes.operatingSetup);
    expect(
      nextOnboardingRoute(_cart(image: 'p.jpg', address: 'x', qr: 'qr.png'), hasMenu: true),
      AppRoutes.qrPoster,
    );
  });

  test('a cart without saved location data has no location', () {
    expect(_cart().hasLocation, isFalse);
    expect(_cart(coords: [0, 0]).hasLocation, isFalse);
    expect(_cart(coords: [12.9, 77.6]).hasLocation, isTrue);
  });

  test('onboarding is complete once the QR code exists', () {
    expect(isOnboardingComplete(_cart()), isFalse);
    expect(isOnboardingComplete(_cart(qr: 'qr.png')), isTrue);
  });
}
