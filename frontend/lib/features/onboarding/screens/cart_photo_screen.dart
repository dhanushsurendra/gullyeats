import 'dart:io';
import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/utils/compress_image.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

class CartPhotoScreen extends StatefulWidget {
  const CartPhotoScreen({super.key});

  @override
  State<CartPhotoScreen> createState() => _CartPhotoScreenState();
}

class _CartPhotoScreenState extends State<CartPhotoScreen> {
  File? _capturedPhoto;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
     WidgetsBinding.instance.addPostFrameCallback((_) {
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      cartProvider.loadCartId();
    });
  }

  Future<void> _openCamera() async {
    setState(() => _isLoading = true);

    final status = await Permission.camera.request();

    if (status.isDenied || status.isPermanentlyDenied) {
      setState(() => _isLoading = false);
      if (!mounted) return;

      if (status.isPermanentlyDenied) {
        _showSettingsDialog();
      } else {
        AppSnackBar.show(context, message: "Camera permission is required.", isError: true);
      }
      return;
    }

    final picker = ImagePicker();
    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 90,
    );

    setState(() {
      _isLoading = false;
      if (photo != null) {
        _capturedPhoto = File(photo.path);
      }
    });
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

  void _retakePhoto() {
    setState(() => _capturedPhoto = null);
  }

  void _onContinue() async {
    setState(() => _isLoading = true);
    if (_capturedPhoto == null) return;

    try {
      final cartActivatedProvider = Provider.of<CartProvider>(
        context,
        listen: false,
      );

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final compressedFile = await compressImage(_capturedPhoto!);
      final cart = await cartActivatedProvider.uploadPhoto(
        auth.token,
        cartProvider.cartId!,
        compressedFile,
      );

      if (cart) {
        if (!mounted) return;

        AppSnackBar.show(context, message: "Photo uploaded successfully!");

        if (mounted) {
          Navigator.pushNamed(context, "/enable-location");
        } else {
          throw Exception("Failed to upload photo");
        }
      } else {
        throw Exception(
          "Failed to upload photo"
        );
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool hasPhoto = _capturedPhoto != null;

    return BaseScreen(
      title: "Cart Photo",
      subtitle: "Take a live photo of your cart for verification",
      expandToFullHeight: true,
      onBack: () => Navigator.pop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Text(
              "Make sure your cart name board is visible",
              style: AppTextStyles.body,
              textAlign: TextAlign.center,
            ),
          ),
          AppGaps.h24,

          Stack(
            children: [
              Container(
                height: 250,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppColors.primary,
                    style: BorderStyle.solid,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  color: Colors.grey[50],
                ),
                clipBehavior: Clip.hardEdge,
                child: hasPhoto
                    ? Image.file(
                        _capturedPhoto!,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: 250,
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.camera_alt_outlined,
                            size: 40,
                            color: _isLoading
                                ? AppColors.grey400
                                : AppColors.primary,
                          ),
                          AppGaps.h12,
                          Text(
                            _isLoading ? "Opening camera..." : "Photo Preview",
                            style: AppTextStyles.body,
                          ),
                        ],
                      ),
              ),
              if (hasPhoto)
                Positioned(
                  top: 10,
                  right: 10,
                  child: GestureDetector(
                    onTap: _retakePhoto,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.refresh, color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text(
                            "Retake",
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),

          AppGaps.h16,
          Container(
            padding: const EdgeInsets.all(16),
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,

              children: [
                Text(
                  "• No gallery upload allowed",
                  style: AppTextStyles.caption,
                ),
                AppGaps.h8,
                Text("• Time will be recorded", style: AppTextStyles.caption),
                AppGaps.h8,
                Text(
                  "• Prevents fake carts & builds trust",
                  style: AppTextStyles.caption,
                ),
              ],
            ),
          ),

          const Spacer(),

          Center(
            child: Text(
              "Your photo is used only for verification.",
              style: AppTextStyles.caption,
            ),
          ),
          AppGaps.h12,
          AppButton(
            label: hasPhoto ? "CONFIRM & UPLOAD" : "OPEN CAMERA",
            isLoading: _isLoading,
            onPressed: _isLoading
                ? null
                : hasPhoto
                ? _onContinue
                : _openCamera,
          ),
        ],
      ),
    );
  }
}
