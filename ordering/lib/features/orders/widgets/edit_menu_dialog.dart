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
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/utils/format_price.dart';

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

    // "60", not "60.0", so typing after it doesn't produce "60.05".
    _priceController = TextEditingController(
      text: formatPrice(widget.initialPrice),
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
          message: context.l10n.cameraPermissionRequired,
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
                Text(context.l10n.choosePhoto, style: AppTextStyles.heading3),

                AppGaps.h16,

                ListTile(
                  leading: const Icon(Icons.camera_alt_outlined),
                  title: Text(context.l10n.takePhoto),
                  onTap: () {
                    Navigator.pop(context);
                    _openCamera();
                  },
                ),

                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: Text(context.l10n.chooseFromGallery),
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
        title: Text(context.l10n.cameraPermission),
        content: Text(
          context.l10n.cameraAccessDenied,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.l10n.cancel),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            child: Text(context.l10n.openSettings),
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
        throw Exception(LanguageProvider.strings.failedToUploadPhoto);
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
        _nameError = context.l10n.itemNameEmpty;
      });
      hasError = true;
    }

    if (price == null || price <= 0) {
      setState(() {
        _priceError = context.l10n.enterValidPrice;
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
        message: context.l10n.itemUpdated,
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
    final l10n = context.l10n;
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        left: 24,
        right: 24,
        top: 12,
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.grey300,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
              AppGaps.h16,
              Row(
                children: [
                  Expanded(child: Text(l10n.editItem, style: AppTextStyles.heading2)),
                  IconButton(
                    onPressed: _isLoading ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, color: AppColors.grey600),
                  ),
                ],
              ),
              AppGaps.h16,
              // The same fields as the Add Item screen.
              AppInput(
                controller: _nameController,
                label: l10n.itemName,
                hint: "e.g. Chicken Momos",
                hasError: _nameError != null,
                errorText: _nameError,
                onChanged: (_) {
                  if (_nameError != null) setState(() => _nameError = null);
                },
              ),
              AppGaps.h16,
              AppInput(
                controller: _priceController,
                label: l10n.price,
                hint: "0",
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                prefix: Padding(
                  padding: const EdgeInsets.only(left: 16, right: 8),
                  child: Text("₹", style: AppTextStyles.heading3),
                ),
                hasError: _priceError != null,
                errorText: _priceError,
                onChanged: (_) {
                  if (_priceError != null) setState(() => _priceError = null);
                },
              ),
              AppGaps.h24,
              _buildLabel(l10n.category),
              Row(
                children: [
                  _categoryChip(
                    label: l10n.veg,
                    value: true,
                    currentValue: _isVeg,
                    color: AppColors.success,
                    onChanged: (value) => _isVeg = value,
                  ),
                  AppGaps.w12,
                  _categoryChip(
                    label: l10n.nonVeg,
                    value: false,
                    currentValue: _isVeg,
                    color: AppColors.error,
                    onChanged: (value) => _isVeg = value,
                  ),
                ],
              ),
              AppGaps.h24,
              _buildLabel(l10n.availability),
              Row(
                children: [
                  _categoryChip(
                    label: l10n.inStock,
                    value: true,
                    currentValue: _isInStock,
                    color: AppColors.success,
                    onChanged: (value) => _isInStock = value,
                  ),
                  AppGaps.w12,
                  _categoryChip(
                    label: l10n.outOfStock,
                    value: false,
                    currentValue: _isInStock,
                    color: AppColors.success,
                    onChanged: (value) => _isInStock = value,
                  ),
                ],
              ),
              AppGaps.h24,
              _buildLabel(l10n.itemPhoto),
              _buildPhotoSection(),
              AppGaps.h32,
              AppButton(
                label: l10n.updateItemCaps,
                disabled: _isLoading || (_selectedPhoto != null && !_photoUploaded),
                onPressed: (_selectedPhoto != null && !_photoUploaded) || _isUploadingPhoto
                    ? null
                    : _handleUpdate,
                isLoading: _isLoading,
              ),
            ],
          ),
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
          constraints: const BoxConstraints(minHeight: 180),
          width: double.infinity,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.grey200),
            borderRadius: BorderRadius.circular(12),
            color: AppColors.grey100,
          ),
          clipBehavior: Clip.hardEdge,
          child: hasNewPhoto
              ? Stack(
                  children: [
                    Image.file(
                      _selectedPhoto!,
                      width: double.infinity,
                      height: 180,
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
                      height: 180,
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
            label: context.l10n.uploadNewPhotoCaps,
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
              Flexible(
                child: Text(
                  context.l10n.photoUploaded,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.success,
                    fontWeight: FontWeight.w600,
                  ),
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
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.refresh, color: Colors.white, size: 14),
              SizedBox(width: 4),
              Text(
                context.l10n.change,
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
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.camera_alt_outlined, size: 36, color: AppColors.primary),
            AppGaps.h8,
            Text(
              context.l10n.addItemPhoto,
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
            ),
            AppGaps.h4,
            Text(
              context.l10n.cameraOrGallery,
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // LABEL
  // ============================================================

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: AppTextStyles.heading3),
    );
  }

  // ============================================================
  // CATEGORY / STOCK CHIP
  // ============================================================

  Widget _categoryChip({
    required String label,
    required bool value,
    required bool currentValue,
    required Color color,
    required ValueChanged<bool> onChanged,
  }) {
    final isSelected = currentValue == value;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => onChanged(value)),
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.05) : AppColors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? color : AppColors.grey200),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: AppTextStyles.body.copyWith(
              color: isSelected ? color : AppColors.grey500,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }
}
