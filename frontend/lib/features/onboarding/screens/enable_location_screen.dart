import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart'; 
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart';

class EnableLocationScreen extends StatefulWidget {
  const EnableLocationScreen({super.key});

  @override
  State<EnableLocationScreen> createState() => _EnableLocationScreenState();
}

class _EnableLocationScreenState extends State<EnableLocationScreen> {
  bool _isLocating = false;
  bool _isLocationCaptured = false;
  double? lat;
  double? lng;
  Placemark? address;
  double? accuracyValue;

  Future<Placemark> getAddressFromLatLng(double lat, double lng) async {
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(lat, lng);

      if (placemarks.isNotEmpty) {
        Placemark place = placemarks[0];
        return place;
      }

      return Placemark();
    } catch (e) {
      if (mounted) {
        AppSnackBar.show(
          context,
          message: "Failed to get address from coordinates.",
          isError: true,
        );
      }
      return Placemark();
    }
  }

  Future<void> _handleEnableLocation() async {
    if (_isLocating) return;

    setState(() => _isLocating = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled && mounted) {
        AppSnackBar.show(
          context,
          message: "Location services are disabled. Please enable them.",
          isError: true,
        );
        await Geolocator.openLocationSettings();
        return;
      }

      var permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied && mounted) {
        AppSnackBar.show(
          context,
          message: "Location permission is required.",
          isError: true,
        );
      }

      if (permission == LocationPermission.deniedForever && mounted) {
        AppSnackBar.show(
          context,
          message:
              "Permission permanently denied. Please enable from settings.",
          isError: true,
        );
        await Geolocator.openAppSettings();
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      ).timeout(const Duration(seconds: 20));

      if (!mounted) return;

      Placemark addressStr = await getAddressFromLatLng(
        position.latitude,
        position.longitude,
      );

      setState(() {
        lat = position.latitude;
        lng = position.longitude;
        accuracyValue = position.accuracy;
        address = addressStr;
        _isLocationCaptured = true;
      });

    } catch (e) {
      _isLocationCaptured = false;
      if (mounted) {
        AppSnackBar.show(
          context,
          message: "Unable to fetch location. Please try again.",
          isError: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLocating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: "Enable Location",
      subtitle: "We need your location to verify your cart",
      expandToFullHeight: true,
      onBack: () => Navigator.pop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMap(lat, lng),
          AppGaps.h32,
          _buildWhyLocationCard(),
          const Spacer(),
          Center(
            child: Text(
              "Securely used only for verification",
              style: AppTextStyles.caption.copyWith(color: AppColors.grey400),
            ),
          ),
          AppGaps.h16,
          AppButton(
            label: _isLocationCaptured ? "CONTINUE" : "ENABLE LOCATION",
            isLoading: _isLocating,
            onPressed: _isLocationCaptured
                ? () => Navigator.pushNamed(
                    context,
                    "/confirm-location",
                    arguments: {
                      "placemark": address,
                      "accuracy": accuracyValue?.toInt(),
                      "lat": lat,
                      "lng": lng,
                    },
                  )
                : _handleEnableLocation,
          ),
          AppGaps.h12,
        ],
      ),
    );
  }

  Widget _buildMap(double? lat, double? lng) {
    if (lat == null || lng == null || _isLocating) {
      return _buildMapPlaceholder();
    }

    return Container(
      height: 220,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.1),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: FlutterMap(
        options: MapOptions(
          initialCenter: LatLng(lat, lng),
          initialZoom: 16.0,
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
          ),
        ),
        children: [
          TileLayer(
            urlTemplate:
                'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            subdomains: const ['a', 'b', 'c', 'd'],
          ),
          MarkerLayer(
            markers: [
              Marker(
                point: LatLng(lat, lng),
                width: 50,
                height: 50,
                alignment: Alignment.center,
                child: _buildLightModeMarker(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLightModeMarker() {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primary.withValues(alpha: 0.15),
            border: Border.all(
              color: Colors.orange.withValues(alpha: 0.4),
              width: 1.5,
            ),
          ),
        ),
        Container(
          width: 16,
          height: 16,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
            boxShadow: [
              BoxShadow(color: Colors.black12, blurRadius: 2, spreadRadius: 1),
            ],
          ),
        ),
        Container(
          width: 10,
          height: 10,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }

  Widget _buildMapPlaceholder() {
    return Container(
      height: 220,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.5),
          width: 2,
        ),
      ),

      child: Stack(
        alignment: Alignment.center,
        children: [
          Opacity(
            opacity: 0.1,
            child: Icon(Icons.grid_4x4, size: 300, color: AppColors.primary),
          ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.location_on,
                  size: 40,
                  color: AppColors.primary,
                ),
              ),
              AppGaps.h12,
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: Text(
                  "Your location will appear here",
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWhyLocationCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.grey100.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Why we need location?", style: AppTextStyles.heading2),
          AppGaps.h16,
          _buildInfoRow(
            "Verify your cart is real",
            "We match your photo location with GPS.",
          ),
          AppGaps.h16,
          _buildInfoRow(
            "Helps customers find you",
            "Your cart will show up on the nearby map.",
          ),
          AppGaps.h16,
          _buildInfoRow(
            "Prevents fake registrations",
            "Ensures only genuine vendors join.",
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTextStyles.body.copyWith(
            fontWeight: FontWeight.w600,
            fontSize: 14,
            color: AppColors.black,
          ),
        ),
        Text(
          subtitle,
          style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
        ),
      ],
    );
  }
}
