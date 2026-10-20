import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geocoding/geocoding.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/features/cart/widgets/location_picker.dart';
import 'package:provider/provider.dart';

import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/utils/build_address.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/cart_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/widgets/cart_photo_field.dart';

class EditCartScreen extends StatefulWidget {
  final CartModel cart;

  const EditCartScreen({super.key, required this.cart});

  @override
  State<EditCartScreen> createState() => _EditCartScreenState();
}

class _EditCartScreenState extends State<EditCartScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _cityController;
  late final TextEditingController _addressController;
  late final TextEditingController _parcelController;

  late bool _isOpen;
  late bool _isActive;

  late double _latitude;
  late double _longitude;
  Placemark? _pendingPlacemark;

  File? _newPhoto;
  String? _currentImageUrl;

  bool _isSaving = false;
  bool _isDirty = false;

  final List<String> _cities = ["Bangalore"];
  String? _selectedCity;

  @override
  void initState() {
    super.initState();

    _nameController = TextEditingController(text: widget.cart.cartName)
      ..addListener(_markDirty);

    _cityController = TextEditingController(text: widget.cart.cartCity)
      ..addListener(_markDirty);

    _addressController = TextEditingController(text: widget.cart.address)
      ..addListener(_markDirty);

    _parcelController = TextEditingController(
      text: widget.cart.parcelCharge.toString(),
    )..addListener(_markDirty);

    _selectedCity = widget.cart.cartCity;

    _isOpen = widget.cart.isOpen;
    _isActive = widget.cart.isActive;

    _latitude = widget.cart.location.latitude;
    _longitude = widget.cart.location.longitude;

    _currentImageUrl = widget.cart.cartImageUrl;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _cityController.dispose();
    _addressController.dispose();
    _parcelController.dispose();
    super.dispose();
  }

  void _markDirty() {
    if (!_isDirty) setState(() => _isDirty = true);
  }

  void _onLocationUpdated(LocationResult result) {
    setState(() {
      _latitude = result.latitude;
      _longitude = result.longitude;
      _pendingPlacemark = result.placemark;

      // Requirement: address is derived from the newly picked location.
      // The vendor can still hand-edit it afterwards.
      final derived = buildAddress(result.placemark);
      if (derived.isNotEmpty) _addressController.text = derived;

      _isDirty = true;
    });
  }

  Future<void> _save() async {
    if (_nameController.text.trim().isEmpty) {
      AppSnackBar.show(
        context,
        message: "Cart name can't be empty.",
        isError: true,
      );
      return;
    }

    if (_cityController.text.trim().isEmpty) {
      AppSnackBar.show(context, message: "City can't be empty.", isError: true);
      return;
    }

    setState(() => _isSaving = true);

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cartProvider = Provider.of<CartProvider>(context, listen: false);

    try {
      final updatedCart = widget.cart.copyWith(
        cartName: _nameController.text.trim(),
        cartCity: _selectedCity ?? widget.cart.cartCity,
        address: _addressController.text.trim(),
        parcelCharge: int.tryParse(_parcelController.text.trim()) ?? 0,
        isOpen: _isOpen,
        isActive: _isActive,
        location: _pendingPlacemark != null
            ? CartLocation(
                type: widget.cart.location.type,
                latitude: _latitude,
                longitude: _longitude,
              )
            : widget.cart.location,
      );

      await cartProvider.updateCart(
        auth.token,
        updatedCart,
        imageFile: _newPhoto,
      );

      if (!mounted) return;

      AppSnackBar.show(
        context,
        message: "Cart details updated!",
        isError: false,
      );

      Navigator.pop(context, true);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);

      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true);
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<bool> _confirmDiscard() async {
    if (!_isDirty) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Discard changes?"),
        content: const Text("You have unsaved changes. Leave without saving?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Keep Editing"),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Discard"),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isDirty,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _confirmDiscard() && mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppHeader(title: "Edit Cart Details", showBack: true),
        bottomNavigationBar: Container(
          color: AppColors.white,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          child: SizedBox(
            height: 56,
            child: AppButton(
              label: "SAVE CHANGES",
              onPressed: _isSaving ? null : _save,
              isLoading: _isSaving,
            ),
          ),
        ),
        body: SingleChildScrollView(
          padding: AppPadding.screen,
          child: Column(
            children: [
              _photoCard(),
              AppGaps.h16,
              _basicInfoCard(),
              AppGaps.h16,
              _locationCard(),
              // AppGaps.h16,
              _statusCard(),
              AppGaps.h32,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCityDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _selectedCity != null
              ? AppColors.primary.withValues(alpha: 0.3)
              : Colors.transparent,
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedCity,
          hint: Text(
            "Select City",
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.grey400),
          dropdownColor: Colors.white,
          borderRadius: BorderRadius.circular(12),
          items: _cities.map((String city) {
            return DropdownMenuItem<String>(
              value: city,
              child: Text(
                city,
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
              ),
            );
          }).toList(),
          onChanged: (value) {
            setState(() {
              _selectedCity = value;
              _isDirty = true;
            });
          },
        ),
      ),
    );
  }

  Widget _photoCard() {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Cart Photo", style: AppTextStyles.heading3),
          AppGaps.h8,
          Text(
            "Used for verification — no gallery uploads allowed.",
            style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
          ),
          AppGaps.h16,
          CartPhotoField(
            existingImageUrl: _currentImageUrl,
            onPhotoCaptured: (file) => setState(() {
              _newPhoto = file;
              _isDirty = true;
            }),
          ),
        ],
      ),
    );
  }

  Widget _basicInfoCard() {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Cart Information", style: AppTextStyles.heading3),
          AppGaps.h16,
          AppInput(
            controller: _nameController,
            label: "Cart Name",
            hint: "e.g. Indie Momos",
          ),
          AppGaps.h16,
          Text("Cart City", style: AppTextStyles.heading3),
          AppGaps.h8,
          _buildCityDropdown(),
          AppGaps.h16,
          AppInput(
            controller: _addressController,
            label: "Address",
            hint: "BTM 2nd Stage",
            maxLines: 4,
            enabled:
                false, // Address is derived from GPS location; vendor can't edit it directly.
          ),
          AppGaps.h16,
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.qr_code_2_rounded, color: AppColors.primary),
                AppGaps.w8,
                Expanded(child: Text("Cart ID", style: AppTextStyles.caption)),
                Text(
                  widget.cart.cartId,
                  style: AppTextStyles.body.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _locationCard() {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Location", style: AppTextStyles.heading3),
          AppGaps.h4,
          Text(
            "Address above updates automatically when you refresh GPS.",
            style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
          ),
          AppGaps.h16,
          LocationPickerField(
            initialLatitude: _latitude,
            initialLongitude: _longitude,
            onLocationUpdated: _onLocationUpdated,
          ),
        ],
      ),
    );
  }

  Widget _statusCard() {
    return AppCard(
      padding: AppPadding.card,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Cart Status", style: AppTextStyles.heading3),
          AppGaps.h8,

          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              "Cart Active",
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            subtitle: const Text(
              "Visible to customers",
              style: TextStyle(fontSize: 13),
            ),
            value: _isActive,
            activeTrackColor: AppColors.primary,
            inactiveTrackColor: AppColors.grey300,
            thumbColor: WidgetStateProperty.all(Colors.white),
            trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
            onChanged: (value) async {
              if (widget.cart.id.isEmpty) return;

              setState(() {
                _isActive = value;
                _isDirty = true;
              });
            },
          ),

          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              "Cart Open",
              style: TextStyle(fontWeight: FontWeight.w500),
            ),
            subtitle: const Text(
              "Accepting orders",
              style: TextStyle(fontSize: 13),
            ),
            value: _isOpen,
            activeTrackColor: AppColors.primary,
            inactiveTrackColor: AppColors.grey300,
            thumbColor: WidgetStateProperty.all(Colors.white),
            trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
            onChanged: (value) async {
              if (widget.cart.id.isEmpty) return;

              setState(() {
                _isOpen = value;
                _isDirty = true;
              });
            },
          ),
        ],
      ),
    );
  }
}
