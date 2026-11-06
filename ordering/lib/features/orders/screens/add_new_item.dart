import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/utils/compress_image.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_footer.dart';

class AddItemScreen extends StatefulWidget {
  const AddItemScreen({super.key});

  @override
  State<AddItemScreen> createState() => _AddItemScreenState();
}

class _AddItemScreenState extends State<AddItemScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _priceController = TextEditingController();
  bool _isInStock = true;
  bool _isVeg = true;
  String _imageUrl = "";

  String? _nameError;
  String? _priceError;

  File? _capturedPhoto;
  bool _photoUploaded = false;
  bool _isUploadingPhoto = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _onContinue() async {
    setState(() => _isUploadingPhoto = true);
    if (_capturedPhoto == null) return;

    try {
      final menuProvider = Provider.of<MenuProvider>(context, listen: false);

      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final compressedFile = await compressImage(_capturedPhoto!);
      final fileUrl = await menuProvider.uploadPhoto(
        auth.token,
        cartProvider.selectedCart?.id ?? "",
        compressedFile,
      );

      if (fileUrl.isNotEmpty) {
        if (!mounted) return;

        setState(() {
          _imageUrl = fileUrl;
          _photoUploaded = true;
        });
      } else {
        throw Exception(LanguageProvider.strings.failedToUploadPhoto);
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true);
      }
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _handleSave() async {
    setState(() {
      final name = _nameController.text.trim();
      _nameError = name.isEmpty
          ? context.l10n.itemNameRequired
          : name.length < 2
          ? context.l10n.itemNameTooShort
          : null;
      _priceError = int.tryParse(_priceController.text.trim()) == null
          ? context.l10n.priceRequired
          : null;
    });

    if (_nameError == null && _priceError == null) {
      try {
        MenuItemModel data = MenuItemModel.fromJson({
          "name": _nameController.text.trim(),
          "price": double.parse(_priceController.text.trim()),
          "isInStock": _isInStock,
          "isVeg": _isVeg,
          "imageUrl": _imageUrl,
        });

        final authProvider = context.read<AuthProvider>();
        final cartProvider = context.read<CartProvider>();

        await context.read<MenuProvider>().addMenuItem(
          authProvider.token,
          data,
          cartProvider.selectedCart?.id ?? "",
        );

        if (!mounted) return;

        AppSnackBar.show(
          context,
          message: context.l10n.itemAdded,
          marginBottom: 0,
        );

        Navigator.pop(context);
      } catch (e) {
        if (!mounted) return;
        final message = AppExceptionHandler.getMessage(e);
        if (mounted) {
          AppSnackBar.show(context, message: message, isError: true);
        }
      }
    }
  }

  Future<void> _openCamera() async {
    setState(() => _isLoading = true);

    final status = await Permission.camera.request();

    if (status.isDenied || status.isPermanentlyDenied) {
      if (mounted) {
        setState(() => _isLoading = false);
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

    final picker = ImagePicker();

    final XFile? photo = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.rear,
      imageQuality: 90,
    );

    if (!mounted) return;

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
        title: Text(context.l10n.cameraPermission),
        content: Text(context.l10n.cameraAccessDenied),
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

  Future<void> _openGallery() async {
    setState(() => _isUploadingPhoto = true);

    try {
      final picker = ImagePicker();

      final XFile? photo = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );

      if (photo != null && mounted) {
        setState(() {
          _capturedPhoto = File(photo.path);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BaseScreen(
      title: l10n.addNewItem,
      onBack: () => Navigator.pop(context),
      bottomNavigationBar: AppFooter(
        note: l10n.itemNameAndPriceRequired,
        children: [
          AppButton(
            label: l10n.addItem.toUpperCase(),
            isLoading: _isLoading,
            // The photo is optional, but one that was taken must be uploaded first.
            onPressed:
                _isUploadingPhoto || (_capturedPhoto != null && !_photoUploaded)
                ? null
                : _handleSave,
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppInput(
              controller: _nameController,
              label: l10n.itemName,
              hint: "e.g. Veg Momos",
              hasError: _nameError != null,
              errorText: _nameError,
              onChanged: (value) {
                if (_nameError != null) setState(() => _nameError = null);
              },
            ),
            AppGaps.h16,
            AppInput(
              controller: _priceController,
              label: l10n.price,
              hint: "0",
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              prefix: Padding(
                padding: const EdgeInsets.only(left: 16, right: 8),
                child: Text("₹", style: AppTextStyles.heading3),
              ),
              hasError: _priceError != null,
              errorText: _priceError,
              onChanged: (value) {
                if (_priceError != null) setState(() => _priceError = null);
              },
            ),
            AppGaps.h24,
            _buildLabel(l10n.category),
            Row(
              children: [
                Expanded(child: _categoryButton(l10n.veg, true)),
                AppGaps.w12,
                Expanded(child: _categoryButton(l10n.nonVeg, false)),
              ],
            ),
            AppGaps.h24,
            _buildLabel(l10n.availability),
            Row(
              children: [
                Expanded(child: _availabilityButton(l10n.inStock, true)),
                AppGaps.w12,
                Expanded(child: _availabilityButton(l10n.outOfStock, false)),
              ],
            ),
            AppGaps.h24,
            _buildLabel(l10n.itemPhoto),
            _buildPhotoSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(label, style: AppTextStyles.heading3),
    );
  }

  Widget _buildPhotoSection() {
    final hasPhoto = _capturedPhoto != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          constraints: const BoxConstraints(minHeight: 180),
          width: double.infinity,
          decoration: BoxDecoration(
            border: Border.all(
              color: _photoUploaded ? AppColors.success : AppColors.grey200,
            ),
            borderRadius: BorderRadius.circular(12),
            color: AppColors.grey100,
          ),
          clipBehavior: Clip.hardEdge,
          child: hasPhoto
              ? Stack(
                  children: [
                    Image.file(
                      _capturedPhoto!,
                      width: double.infinity,
                      height: 180,
                      fit: BoxFit.cover,
                    ),
                    _photoUploaded
                        ? const SizedBox.shrink()
                        : Positioned(
                            top: 10,
                            right: 10,
                            child: GestureDetector(
                              onTap: _isUploadingPhoto
                                  ? null
                                  : _showPhotoOptions,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.55),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.refresh,
                                      color: Colors.white,
                                      size: 14,
                                    ),
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
                          ),
                  ],
                )
              : InkWell(
                  onTap: _isLoading ? null : _showPhotoOptions,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.camera_alt_outlined,
                          size: 36,
                          color: AppColors.primary,
                        ),
                        AppGaps.h8,
                        Text(
                          context.l10n.takeItemPhoto,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.body.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        AppGaps.h4,
                        Text(
                          context.l10n.cameraOrGallery,
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.grey500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ),

        AppGaps.h12,

        // Upload button
        if (hasPhoto && !_photoUploaded)
          AppButton(
            onPressed: _isUploadingPhoto ? null : _onContinue,
            isLoading: _isUploadingPhoto,
            label: context.l10n.uploadPhoto,
            backgroundColor: AppColors.primary,
            textColor: Colors.white,
          ),

        // Uploaded state
        if (_photoUploaded)
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

  Widget _availabilityButton(String label, bool value) => _optionChip(
    label,
    _isInStock == value,
    AppColors.success,
    () => setState(() => _isInStock = value),
  );

  Widget _categoryButton(String label, bool value) => _optionChip(
    label,
    _isVeg == value,
    value ? AppColors.success : AppColors.error,
    () => setState(() => _isVeg = value),
  );

  Widget _optionChip(
    String label,
    bool isSelected,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
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
    );
  }
}
