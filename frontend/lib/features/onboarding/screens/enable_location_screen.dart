
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_vector_tiles/flutter_map_vector_tiles.dart' as vt;
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:latlong2/latlong.dart';

import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';

class EnableLocationScreen extends StatefulWidget {
  const EnableLocationScreen({super.key});

  @override
  State<EnableLocationScreen> createState() =>
      _EnableLocationScreenState();
}

class _EnableLocationScreenState extends State<EnableLocationScreen> {
  bool _isLocating = false;
  bool _isLocationCaptured = false;

  double? lat;
  double? lng;
  Placemark? address;
  double? accuracyValue;

  vt.Style? _mapStyle;
  bool _isMapLoading = true;
  bool _mapStyleFailed = false;

  static const String _styleUri =
      'https://tiles.openfreemap.org/styles/positron';

  @override
  void initState() {
    super.initState();
    _loadMapStyle();
  }

  Future<void> _loadMapStyle() async {
    if (!mounted) return;

    setState(() {
      _isMapLoading = true;
      _mapStyleFailed = false;
    });

    vt.Style? style;

    try {
      style = await vt.StyleReader(
        uri: _styleUri,
      ).read().timeout(const Duration(seconds: 12));

      if (!mounted) {
        style.dispose();
        return;
      }

      final previousStyle = _mapStyle;

      setState(() {
        _mapStyle = style;
        _isMapLoading = false;
        _mapStyleFailed = false;
      });

      previousStyle?.dispose();
    } catch (_) {
      style?.dispose();

      if (!mounted) return;

      setState(() {
        _isMapLoading = false;
        _mapStyleFailed = true;
      });
    }
  }

  @override
  void dispose() {
    _mapStyle?.dispose();
    super.dispose();
  }

  Future<Placemark> getAddressFromLatLng(
    double latitude,
    double longitude,
  ) async {
    try {
      final placemarks = await placemarkFromCoordinates(
        latitude,
        longitude,
      );

      return placemarks.isNotEmpty
          ? placemarks.first
          : Placemark();
    } catch (_) {
      return Placemark();
    }
  }

  Future<void> _handleEnableLocation() async {
    if (_isLocating) return;

    setState(() => _isLocating = true);

    try {
      final serviceEnabled =
          await Geolocator.isLocationServiceEnabled();

      if (!serviceEnabled) {
        if (mounted) {
          AppSnackBar.show(
            context,
            message:
                'Location services are disabled. Please enable them.',
            isError: true,
          );
        }

        await Geolocator.openLocationSettings();
        return;
      }

      var permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        if (mounted) {
          AppSnackBar.show(
            context,
            message: 'Location permission is required.',
            isError: true,
          );
        }
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          AppSnackBar.show(
            context,
            message:
                'Permission permanently denied. Please enable from settings.',
            isError: true,
          );
        }

        await Geolocator.openAppSettings();
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      ).timeout(const Duration(seconds: 20));

      final addressResult = await getAddressFromLatLng(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      setState(() {
        lat = position.latitude;
        lng = position.longitude;
        accuracyValue = position.accuracy;
        address = addressResult;
        _isLocationCaptured = true;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _isLocationCaptured = false);

        AppSnackBar.show(
          context,
          message: 'Unable to fetch location. Please try again.',
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
      title: 'Enable Location',
      subtitle: 'We need your location to verify your cart',
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
              'Securely used only for verification',
              style: AppTextStyles.caption.copyWith(
                color: AppColors.grey400,
              ),
            ),
          ),
          AppGaps.h16,
          AppButton(
            label: _isLocationCaptured
                ? 'CONTINUE'
                : 'ENABLE LOCATION',
            isLoading: _isLocating,
            onPressed: _isLocationCaptured
                ? () {
                    Navigator.pushNamed(
                      context,
                      '/confirm-location',
                      arguments: {
                        'placemark': address,
                        'accuracy': accuracyValue?.toInt(),
                        'lat': lat,
                        'lng': lng,
                      },
                    );
                  }
                : _handleEnableLocation,
          ),
          AppGaps.h12,
        ],
      ),
    );
  }

  Widget _buildMap(double? latitude, double? longitude) {
    if (latitude == null || longitude == null || _isLocating) {
      return _buildMapPlaceholder();
    }

    if (_isMapLoading) {
      return Container(
        height: 220,
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.1),
          ),
        ),
        child: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_mapStyleFailed || _mapStyle == null) {
      return Container(
        height: 220,
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.1),
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.location_on,
              color: AppColors.primary,
              size: 36,
            ),
            AppGaps.h12,
            const Text('Map unavailable'),
            TextButton(
              onPressed: _loadMapStyle,
              child: const Text('Tap to retry'),
            ),
          ],
        ),
      );
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
          initialCenter: LatLng(latitude, longitude),
          initialZoom: 16,
          interactionOptions: const InteractionOptions(
            flags: InteractiveFlag.all &
                ~InteractiveFlag.rotate,
          ),
        ),
        children: [
          vt.VectorTileLayer(
            theme: _mapStyle!.theme,
            tileProviders: _mapStyle!.providers,
            sprites: _mapStyle!.sprites,
            rasterSources: _mapStyle!.rasterSources,
          ),
          MarkerLayer(
            markers: [
              Marker(
                point: LatLng(latitude, longitude),
                width: 50,
                height: 50,
                alignment: Alignment.center,
                child: _buildLightModeMarker(),
              ),
            ],
          ),
          Positioned(
            right: 4,
            bottom: 4,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 4,
                vertical: 2,
              ),
              color: Colors.white.withValues(alpha: 0.8),
              child: const Text(
                '© OpenStreetMap · OpenFreeMap',
                style: TextStyle(fontSize: 8),
              ),
            ),
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
              BoxShadow(
                color: Colors.black12,
                blurRadius: 2,
                spreadRadius: 1,
              ),
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
            child: Icon(
              Icons.grid_4x4,
              size: 300,
              color: AppColors.primary,
            ),
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
                  'Your location will appear here',
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
          Text(
            'Why we need location?',
            style: AppTextStyles.heading2,
          ),
          AppGaps.h16,
          _buildInfoRow(
            'Verify your cart is real',
            'We match your photo location with GPS.',
          ),
          AppGaps.h16,
          _buildInfoRow(
            'Helps customers find you',
            'Your cart will show up on the nearby map.',
          ),
          AppGaps.h16,
          _buildInfoRow(
            'Prevents fake registrations',
            'Ensures only genuine vendors join.',
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
          style: AppTextStyles.caption.copyWith(
            color: AppColors.grey500,
          ),
        ),
      ],
    );
  }
}
