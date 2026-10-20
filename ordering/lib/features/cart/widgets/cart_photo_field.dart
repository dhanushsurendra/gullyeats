import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';

/// A tappable cart-photo preview + camera launcher.
///
/// Shows [existingImageUrl] until the vendor captures a new photo, at which
/// point the local file preview takes over. Camera-only by design — no
/// gallery picker — matching the existing cart-verification flow.
class CartPhotoField extends StatefulWidget {
  final String? existingImageUrl;
  final ValueChanged<File> onPhotoCaptured;

  const CartPhotoField({
    super.key,
    required this.existingImageUrl,
    required this.onPhotoCaptured,
  });

  @override
  State<CartPhotoField> createState() => _CartPhotoFieldState();
}

class _CartPhotoFieldState extends State<CartPhotoField> {
  File? _newPhoto;
  bool _isOpeningCamera = false;

  Future<void> _openCamera() async {
    setState(() => _isOpeningCamera = true);

    final status = await Permission.camera.request();

    if (status.isDenied || status.isPermanentlyDenied) {
      if (!mounted) return;
      setState(() => _isOpeningCamera = false);

      if (status.isPermanentlyDenied) {
        _showSettingsDialog();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Camera permission is required.")),
        );
      }
      return;
    }

    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 90,
    );

    if (!mounted) return;
    setState(() => _isOpeningCamera = false);

    if (photo != null) {
      final file = File(photo.path);
      setState(() => _newPhoto = file);
      widget.onPhotoCaptured(file);
    }
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Camera Permission"),
        content: const Text(
          "Camera access was denied. Please enable it from app settings.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel"),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            child: const Text("Open Settings"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasNewPhoto = _newPhoto != null;
    final hasExistingPhoto = !hasNewPhoto &&
        widget.existingImageUrl != null &&
        widget.existingImageUrl!.isNotEmpty;

    return GestureDetector(
      onTap: _isOpeningCamera ? null : _openCamera,
      child: Stack(
        children: [
          Container(
            height: 180,
            width: double.infinity,
            clipBehavior: Clip.hardEdge,
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.grey200),
            ),
            child: hasNewPhoto
                ? Image.file(_newPhoto!, fit: BoxFit.cover, width: double.infinity)
                : hasExistingPhoto
                    ? Image.network(
                        widget.existingImageUrl!,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        loadingBuilder: (context, child, progress) {
                          if (progress == null) return child;
                          return const Center(child: CircularProgressIndicator());
                        },
                        errorBuilder: (context, error, stackTrace) => _placeholder(),
                      )
                    : _placeholder(),
          ),
          Positioned(
            right: 12,
            bottom: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _isOpeningCamera
                      ? const SizedBox(
                          height: 12,
                          width: 12,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    hasNewPhoto || hasExistingPhoto ? "Change Photo" : "Add Photo",
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _placeholder() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.storefront_rounded, size: 40, color: AppColors.grey400),
        const SizedBox(height: 8),
        Text(
          "Tap to add cart photo",
          style: AppTextStyles.caption.copyWith(color: AppColors.grey400),
        ),
      ],
    );
  }
}