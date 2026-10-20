import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_vector_tiles/flutter_map_vector_tiles.dart' as vt;
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';

class LocationResult {
  final double latitude;
  final double longitude;
  final Placemark placemark;

  const LocationResult({
    required this.latitude,
    required this.longitude,
    required this.placemark,
  });
}

/// Shows the cart's current location on a small, static OpenFreeMap
/// (vector-tile) preview with an "Update GPS Location" action that
/// re-fetches device GPS, reverse geocodes it, and reports the result back
/// via [onLocationUpdated].
///
/// Style loading is wrapped in a timeout + try/catch and never leaves the
/// widget stuck on an infinite spinner — on failure it shows a plain
/// coordinate/marker fallback with a manual retry, so a flaky network can
/// never crash or hang this screen.
class LocationPickerField extends StatefulWidget {
  final double initialLatitude;
  final double initialLongitude;
  final ValueChanged<LocationResult> onLocationUpdated;

  const LocationPickerField({
    super.key,
    required this.initialLatitude,
    required this.initialLongitude,
    required this.onLocationUpdated,
  });

  @override
  State<LocationPickerField> createState() => _LocationPickerFieldState();
}

enum _StyleStatus { loading, ready, failed }

class _LocationPickerFieldState extends State<LocationPickerField> {
  late double _lat = widget.initialLatitude;
  late double _lng = widget.initialLongitude;

  bool _isLocating = false;

  vt.Style? _mapStyle;
  _StyleStatus _styleStatus = _StyleStatus.loading;
  bool _disposed = false;

  static const _styleUri = 'https://tiles.openfreemap.org/styles/positron';

  @override
  void initState() {
    super.initState();
    _loadMapStyle();
  }

  @override
  void dispose() {
    _disposed = true;
    _mapStyle?.dispose();
    super.dispose();
  }

  Future<void> _loadMapStyle() async {
    if (mounted) setState(() => _styleStatus = _StyleStatus.loading);

    try {
      final style = await vt.StyleReader(
        uri: _styleUri,
      ).read().timeout(const Duration(seconds: 12));

      // Widget was disposed (or a newer load already finished) while we
      // were waiting on the network — release this style and bail out
      // instead of calling setState on a dead/duplicate state.
      if (_disposed) {
        style.dispose();
        return;
      }

      _mapStyle?.dispose();
      setState(() {
        _mapStyle = style;
        _styleStatus = _StyleStatus.ready;
      });
    } catch (_) {
      if (_disposed) return;
      setState(() => _styleStatus = _StyleStatus.failed);
    }
  }

  Future<Placemark> _getAddressFromLatLng(double lat, double lng) async {
    try {
      final placemarks = await placemarkFromCoordinates(lat, lng);
      return placemarks.isNotEmpty ? placemarks.first : Placemark();
    } catch (_) {
      return Placemark();
    }
  }

  Future<void> _updateLocation() async {
    if (_isLocating) return;

    setState(() => _isLocating = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();

      if (!serviceEnabled) {
        _showSnack("Location services are disabled. Please enable them.");
        await Geolocator.openLocationSettings();
        return;
      }

      var permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        _showSnack("Location permission is required.");
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        _showSnack(
          "Permission permanently denied. Please enable from settings.",
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

      final placemark = await _getAddressFromLatLng(
        position.latitude,
        position.longitude,
      );

      if (!mounted) return;

      setState(() {
        _lat = position.latitude;
        _lng = position.longitude;
      });

      widget.onLocationUpdated(
        LocationResult(
          latitude: position.latitude,
          longitude: position.longitude,
          placemark: placemark,
        ),
      );
    } catch (_) {
      _showSnack("Unable to fetch location. Please try again.");
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _buildMapBody() {
    switch (_styleStatus) {
      case _StyleStatus.loading:
        return const Center(child: CircularProgressIndicator());

      case _StyleStatus.failed:
        // Never leave the user with a blank/dead widget — show the pin +
        // coordinates on a plain background, with a manual retry.
        return Container(
          color: AppColors.grey100,
          alignment: Alignment.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_on, color: AppColors.primary, size: 36),
              const SizedBox(height: 8),
              TextButton(
                onPressed: _loadMapStyle,
                child: const Text("Map unavailable — tap to retry"),
              ),
            ],
          ),
        );

      case _StyleStatus.ready:
        return FlutterMap(
          options: MapOptions(
            initialCenter: LatLng(_lat, _lng),
            initialZoom: 18.0,
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
                  point: LatLng(_lat, _lng),
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.location_on,
                    color: AppColors.primary,
                    size: 36,
                  ),
                ),
              ],
            ),
            Positioned(
              right: 4,
              bottom: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                color: Colors.white.withValues(alpha: 0.8),
                child: const Text(
                  '© OpenStreetMap · OpenFreeMap',
                  style: TextStyle(fontSize: 8),
                ),
              ),
            ),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 160,
          width: double.infinity,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.15),
            ),
          ),
          child: Stack(
            children: [
              _buildMapBody(),
              if (_isLocating)
                Container(
                  color: Colors.black.withValues(alpha: 0.35),
                  alignment: Alignment.center,
                  child: const CircularProgressIndicator(color: Colors.white),
                ),
            ],
          ),
        ),
        AppGaps.h12,
        SizedBox(
          width: double.infinity,
          child: AppButton(
            label: _isLocating ? "Locating..." : "Update GPS Location",
            onPressed: _isLocating ? null : _updateLocation,
          ),
        ),
      ],
    );
  }
}
