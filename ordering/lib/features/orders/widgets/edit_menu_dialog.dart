import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/compress_image.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';

class EditMenuDialog extends StatefulWidget {
  final String initialName;
  final double initialPrice;
  final bool initialIsVeg;
  final bool initialInStock;
  final String initialImageUrl;
  final String id;
  final String cartId;

  const EditMenuDialog({
    super.key,
    required this.initialName,
    required this.initialPrice,
    required this.initialIsVeg,
    required this.initialInStock,
    required this.initialImageUrl,
    required this.id,
    required this.cartId,
  });

  @override
  State<EditMenuDialog> createState() => _EditMenuDialogState();
}

class _EditMenuDialogState extends State<EditMenuDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;

  late bool _isVeg;
  late bool _isInStock;

  String _imageUrl = "";
  String _oldImageUrl = "";

  File? _selectedPhoto;

  bool _isUploadingPhoto = false;
  bool _isLoading = false;

  String? _nameError;
  String? _priceError;

  bool _photoUploaded = false;

  @override
  void initState() {
    super.initState();

    _nameController = TextEditingController(text: widget.initialName);

    _priceController = TextEditingController(
      text: widget.initialPrice.toString(),
    );

    _isVeg = widget.initialIsVeg;
    _isInStock = widget.initialInStock;

    _imageUrl = widget.initialImageUrl;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  // ============================================================
  // IMAGE PICKING
  // ============================================================

  Future<void> _openCamera() async {
    setState(() => _isUploadingPhoto = true);

    final status = await Permission.camera.request();

    if (status.isDenied || status.isPermanentlyDenied) {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }

      if (!mounted) return;

      if (status.isPermanentlyDenied) {
        _showSettingsDialog();
      } else {
        AppSnackBar.show(
          context,
          message: "Camera permission is required.",
          isError: true,
        );
      }

      return;
    }

    try {
      final picker = ImagePicker();

      final XFile? photo = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.rear,
        imageQuality: 90,
      );

      if (!mounted) return;

      if (photo != null) {
        setState(() {
          _selectedPhoto = File(photo.path);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<void> _openGallery() async {
    setState(() => _isUploadingPhoto = true);

    try {
      final picker = ImagePicker();

      final XFile? photo = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );

      if (!mounted) return;

      if (photo != null) {
        setState(() {
          _selectedPhoto = File(photo.path);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text("Choose Photo", style: AppTextStyles.heading3),

                AppGaps.h16,

                ListTile(
                  leading: const Icon(Icons.camera_alt_outlined),
                  title: const Text("Take Photo"),
                  onTap: () {
                    Navigator.pop(context);
                    _openCamera();
                  },
                ),

                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: const Text("Choose from Gallery"),
                  onTap: () {
                    Navigator.pop(context);
                    _openGallery();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
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

  // ============================================================
  // UPLOAD PHOTO
  // ============================================================

  Future<bool> _uploadPhoto() async {
    if (_selectedPhoto == null) {
      return true;
    }

    setState(() => _isUploadingPhoto = true);

    try {
      final authProvider = context.read<AuthProvider>();
      final menuProvider = context.read<MenuProvider>();

      final compressedFile = await compressImage(_selectedPhoto!);

      final result = await menuProvider.uploadEditMenuItemPhoto(
        authProvider.token,
        widget.cartId,
        compressedFile,
        widget.id,
      );

      if (result.fileUrl.isEmpty) {
        throw Exception("Failed to upload photo");
      }

      if (!mounted) return false;

      setState(() {
        _imageUrl = result.fileUrl;
        _oldImageUrl = result.oldImageUrl ?? "";
        _photoUploaded = true;
      });

      return true;
    } catch (e) {
      if (!mounted) return false;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: message, isError: true);

      return false;
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  // ============================================================
  // UPDATE
  // ============================================================
  Future<void> _handleUpdate() async {
    final name = _nameController.text.trim();
    final priceStr = _priceController.text.trim();
    final price = double.tryParse(priceStr);

    bool hasError = false;

    setState(() {
      _nameError = null;
      _priceError = null;
    });

    if (name.isEmpty) {
      setState(() {
        _nameError = "Item name cannot be empty";
      });
      hasError = true;
    }

    if (price == null || price <= 0) {
      setState(() {
        _priceError = "Please enter a valid price";
      });
      hasError = true;
    }

    if (hasError) {
      return;
    }

    final hasTextChanges =
        name != widget.initialName ||
        price != widget.initialPrice ||
        _isVeg != widget.initialIsVeg ||
        _isInStock != widget.initialInStock;

    final hasImageChange = _photoUploaded == true;

    if (!hasTextChanges && !hasImageChange) {
      if (!mounted) return;
      Navigator.pop(context);
      return;
    }

    // Get providers BEFORE any await
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final menuProvider = Provider.of<MenuProvider>(context, listen: false);

    setState(() => _isLoading = true);

    try {
      // ----------------------------------------------------------
      // Upload image first if user selected a new one
      // ----------------------------------------------------------

      final updatedItem = MenuItemModel(
        name: name,
        price: price!,
        isVeg: _isVeg,
        isInStock: _isInStock,
        cartId: widget.cartId,
        id: widget.id,
        imageUrl: _imageUrl,
      );

      await menuProvider.editMenuItem(
        authProvider.token!,
        widget.id,
        updatedItem,
        _oldImageUrl.isNotEmpty ? _oldImageUrl : null,
      );

      if (!mounted) return;

      Navigator.pop(context);

      AppSnackBar.show(
        context,
        message: "Item updated successfully!",
        marginBottom: 0,
      );
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(
        context,
        message: message,
        isError: true,
        marginBottom: 0,
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  // ============================================================
  // BUILD
  // ============================================================

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        left: 24,
        right: 24,
        top: 12,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            AppGaps.h16,

            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Edit Item", style: AppTextStyles.heading2),
                IconButton(
                  onPressed: _isLoading ? null : () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),

            AppGaps.h24,

            // ====================================================
            // ITEM NAME
            // ====================================================
            _buildLabel("ITEM NAME"),

            _buildTextField(
              controller: _nameController,
              hint: "e.g. Chicken Momos",
              hasError: _nameError != null,
              onChanged: (_) {
                if (_nameError != null) {
                  setState(() => _nameError = null);
                }
              },
            ),

            _buildFieldError(_nameError),

            AppGaps.h24,

            // ====================================================
            // PRICE
            // ====================================================
            _buildLabel("PRICE (₹)"),

            _buildTextField(
              controller: _priceController,
              hint: "0",
              isNumber: true,
              hasError: _priceError != null,
              onChanged: (_) {
                if (_priceError != null) {
                  setState(() => _priceError = null);
                }
              },
            ),

            _buildFieldError(_priceError),

            AppGaps.h24,

            // ====================================================
            // CATEGORY
            // ====================================================
            _buildLabel("CATEGORY"),

            Row(
              children: [
                _categoryChip(
                  label: "Veg",
                  value: true,
                  currentValue: _isVeg,
                  onChanged: (value) {
                    _isVeg = value;
                  },
                ),

                AppGaps.w12,

                _categoryChip(
                  label: "Non Veg",
                  value: false,
                  currentValue: _isVeg,
                  onChanged: (value) {
                    _isVeg = value;
                  },
                ),
              ],
            ),

            AppGaps.h24,

            // ====================================================
            // STOCK
            // ====================================================
            _buildLabel("STOCK"),

            Row(
              children: [
                _categoryChip(
                  label: "In Stock",
                  value: true,
                  currentValue: _isInStock,
                  onChanged: (value) {
                    _isInStock = value;
                  },
                ),

                AppGaps.w12,

                _categoryChip(
                  label: "Out of Stock",
                  value: false,
                  currentValue: _isInStock,
                  onChanged: (value) {
                    _isInStock = value;
                  },
                ),
              ],
            ),

            AppGaps.h24,

            // ====================================================
            // ITEM PHOTO
            // ====================================================
            _buildLabel("ITEM PHOTO"),

            _buildPhotoSection(),

            AppGaps.h32,

            // ====================================================
            // UPDATE BUTTON
            // ====================================================
            AppButton(
              label: "UPDATE ITEM",
              disabled:
                  _isLoading || (_selectedPhoto != null && !_photoUploaded),
              onPressed: (_selectedPhoto != null && !_photoUploaded) || _isUploadingPhoto
                  ? null
                  : _handleUpdate,
              isLoading: _isLoading,
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // PHOTO SECTION
  // ============================================================

  Widget _buildPhotoSection() {
    bool isPhotoUploaded = _photoUploaded;
    final hasNewPhoto = _selectedPhoto != null;
    final hasExistingPhoto = _imageUrl.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 180,
          width: double.infinity,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.grey200),
            borderRadius: BorderRadius.circular(12),
            color: AppColors.grey100.withValues(alpha: 0.3),
          ),
          clipBehavior: Clip.hardEdge,
          child: hasNewPhoto
              ? Stack(
                  children: [
                    Image.file(
                      _selectedPhoto!,
                      width: double.infinity,
                      height: double.infinity,
                      fit: BoxFit.cover,
                    ),

                    _photoChangeButton(),
                  ],
                )
              : hasExistingPhoto
              ? Stack(
                  children: [
                    Image.network(
                      _imageUrl,
                      width: double.infinity,
                      height: double.infinity,
                      fit: BoxFit.cover,
                      loadingBuilder: (context, child, loadingProgress) {
                        if (loadingProgress == null) {
                          return child;
                        }

                        return const Center(child: CircularProgressIndicator());
                      },
                      errorBuilder: (context, error, stackTrace) {
                        return _emptyPhotoView();
                      },
                    ),

                    _photoChangeButton(),
                  ],
                )
              : _emptyPhotoView(),
        ),

        // --------------------------------------------------------
        // Upload new image button
        // --------------------------------------------------------
        AppGaps.h12,
        if (hasNewPhoto && !isPhotoUploaded) ...[
          AppButton(
            label: "UPLOAD NEW PHOTO",
            onPressed: _isUploadingPhoto
                ? null
                : () async {
                    await _uploadPhoto();
                  },
            isLoading: _isUploadingPhoto,
          ),
        ],

        // Uploaded state
        if (isPhotoUploaded)
          Row(
            children: [
              const Icon(
                Icons.check_circle,
                color: AppColors.success,
                size: 16,
              ),
              const SizedBox(width: 6),
              Text(
                "Photo uploaded successfully",
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.success,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _photoChangeButton() {
    return _photoUploaded ? SizedBox.shrink() : Positioned(
      top: 10,
      right: 10,
      child: GestureDetector(
        onTap: _isUploadingPhoto ? null : _showPhotoOptions,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                "Change",
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
    );
  }

  Widget _emptyPhotoView() {
    return InkWell(
      onTap: _isUploadingPhoto ? null : _showPhotoOptions,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.camera_alt_outlined, size: 36, color: AppColors.primary),

          AppGaps.h8,

          Text(
            "Add Item Photo",
            style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
          ),

          AppGaps.h4,

          Text(
            "Camera or gallery",
            style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // LABEL
  // ============================================================

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(
        text,
        style: AppTextStyles.caption.copyWith(
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
          color: Colors.grey.shade600,
        ),
      ),
    );
  }

  // ============================================================
  // FIELD ERROR
  // ============================================================

  Widget _buildFieldError(String? errorMsg) {
    if (errorMsg == null) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 6.0, left: 4.0),
      child: Text(
        errorMsg,
        style: const TextStyle(
          color: AppColors.error,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  // ============================================================
  // TEXT FIELD
  // ============================================================

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    bool isNumber = false,
    bool hasError = false,
    void Function(String)? onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.grey100.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasError ? AppColors.error : AppColors.grey200,
          width: hasError ? 1.5 : 1.0,
        ),
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        keyboardType: isNumber
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
        inputFormatters: isNumber
            ? [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))]
            : null,
        style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey.shade400),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 16,
          ),
        ),
      ),
    );
  }

  // ============================================================
  // CATEGORY / STOCK CHIP
  // ============================================================

  Widget _categoryChip({
    required String label,
    required bool value,
    required bool currentValue,
    required ValueChanged<bool> onChanged,
  }) {
    final isSelected = currentValue == value;

    final activeColor = value ? Colors.green : Colors.red;

    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            onChanged(value);
          });
        },
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? activeColor.withValues(alpha: 0.08)
                : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? activeColor : AppColors.grey200,
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.circle,
                size: 10,
                color: isSelected ? activeColor : Colors.grey.shade300,
              ),

              AppGaps.w8,

              Text(
                label,
                style: TextStyle(
                  color: isSelected ? activeColor : Colors.grey.shade600,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
