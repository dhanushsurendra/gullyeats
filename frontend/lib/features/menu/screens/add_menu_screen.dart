import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/utils/format_price.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_footer.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/menu/models/menu_item_model.dart';
import 'package:gullyeats/features/menu/screens/menu_review_screen.dart';

class AddMenuScreen extends StatefulWidget {
  const AddMenuScreen({super.key});

  @override
  State<AddMenuScreen> createState() => _AddMenuScreenState();
}

class _AddMenuScreenState extends State<AddMenuScreen> {
  final List<MenuItemModel> _menuItems = [];
  final Map<MenuItemModel, TextEditingController> _nameControllers = {};
  final Map<MenuItemModel, TextEditingController> _priceControllers = {};
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    for (var c in _nameControllers.values) {
      c.dispose();
    }
    for (var c in _priceControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _addNewItem() {
    final newItem = MenuItemModel(name: "", price: 0, isVeg: true);

    setState(() {
      _menuItems.add(newItem);
      _nameControllers[newItem] = TextEditingController();
      _priceControllers[newItem] = TextEditingController();
    });
  }

  void _saveAndContinue() async {
    if (_menuItems.isEmpty) return;

    bool valid = _menuItems.every(
      (item) => item.name.trim().isNotEmpty && item.price > 0,
    );

    if (!valid) {
      AppSnackBar.show(context, message: "Please fill all item details correctly.", isError: true);
      return;
    }

    // Review edits this same list, so changes survive however the user
    // leaves the review screen (back arrow, system back, "add more").
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MenuReviewScreen(menuItems: _menuItems),
      ),
    );

    if (!mounted) return;
    setState(_syncControllers);
  }

  /// Review may replace or remove items, so rebuild the fields from the list.
  void _syncControllers() {
    final old = [..._nameControllers.values, ..._priceControllers.values];
    // The fields still use the old controllers until this rebuild is drawn.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      for (final c in old) {
        c.dispose();
      }
    });
    _nameControllers.clear();
    _priceControllers.clear();
    for (final item in _menuItems) {
      _nameControllers[item] = TextEditingController(text: item.name);
      _priceControllers[item] = TextEditingController(
        text: formatPrice(item.price),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: "Add Menu",
      subtitle: "Add your items prices. You can edit anytime.",
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: _buildFooter(),
      child: ListView(
        controller: _scrollController,
        physics: const BouncingScrollPhysics(),
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 100,
        ),
        children: [
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _menuItems.length,
            itemBuilder: (context, index) =>
                _buildMenuItemRow(_menuItems[index]),
          ),

          if (_menuItems.isNotEmpty) AppGaps.h24,

          AppButton(
            label: "+ ADD ITEM",
            onPressed: _addNewItem,
            isDotted: true,
            backgroundColor: AppColors.primary.withValues(alpha: 0.02),
            borderColor: AppColors.primary.withValues(alpha: 0.3),
            textColor: AppColors.primary,
          ),

          AppGaps.h32,
          _buildInfoBox(),
        ],
      ),
    );
  }

  Widget _buildMenuItemRow(MenuItemModel item) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              flex: 5,
              child: _buildField(
                hint: "Item Name",
                controller: _nameControllers[item] ??= TextEditingController(),
                onChanged: (val) => setState(() => item.name = val),
              ),
            ),
            AppGaps.w12,
            Expanded(
              flex: 3,
              child: _buildField(
                hint: "0",
                prefix: "₹",
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                controller: _priceControllers[item] ??= TextEditingController(),
                onChanged: (val) =>
                    setState(() => item.price = double.tryParse(val) ?? 0),
              ),
            ),
            _buildDeleteButton(item),
          ],
        ),
        AppGaps.h16,
        Row(
          children: [
            _buildTypeChip(
              "Veg",
              item.isVeg,
              Colors.green,
              () => setState(() => item.isVeg = true),
            ),
            AppGaps.w12,
            _buildTypeChip(
              "Non-Veg",
              !item.isVeg,
              Colors.red,
              () => setState(() => item.isVeg = false),
            ),
          ],
        ),
        AppGaps.h16,
      ],
    );
  }

  Widget _buildField({
    required String hint,
    required TextEditingController controller,
    String? prefix,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    Function(String)? onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.grey100.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.grey200),
      ),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: hint,
          // Always-visible currency prefix: prefixText only shows once the
          // field has focus but still takes its width, which squeezed the hint.
          prefixIcon: prefix == null
              ? null
              : Padding(
                  padding: const EdgeInsets.only(left: 16, right: 4),
                  child: Text(
                    prefix,
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
          prefixIconConstraints: const BoxConstraints(),
          hintStyle: TextStyle(color: AppColors.grey400, fontSize: 14),
          border: InputBorder.none,
          contentPadding: EdgeInsets.fromLTRB(prefix == null ? 16 : 0, 14, 16, 14),
        ),
      ),
    );
  }

  Widget _buildTypeChip(
    String label,
    bool isSelected,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.1) : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? color.withValues(alpha: 0.5)
                : AppColors.grey200,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.circle,
              size: 8,
              color: isSelected ? color : AppColors.grey300,
            ),
            AppGaps.w8,
            Text(
              label,
              style: AppTextStyles.body.copyWith(
                color: isSelected ? color : AppColors.grey400,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeleteButton(MenuItemModel item) {
    return IconButton(
      onPressed: () {
        setState(() {
          _menuItems.remove(item);
          _nameControllers.remove(item)?.dispose();
          _priceControllers.remove(item)?.dispose();
        });
      },
      icon: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.close, color: AppColors.error, size: 18),
      ),
    );
  }

  Widget _buildInfoBox() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.grey100.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        children: [
          _infoRow("Simple setup (Text + Price)"),
          AppGaps.h12,
          _infoRow("No images needed for now"),
          AppGaps.h12,
          _infoRow("Update your menu anytime"),
        ],
      ),
    );
  }

  Widget _infoRow(String text) {
    return Row(
      children: [
        const Icon(
          Icons.check_circle_outline,
          size: 18,
          color: AppColors.grey400,
        ),
        AppGaps.w12,
        Expanded(
          child: Text(
            text,
            style: AppTextStyles.body.copyWith(
              color: AppColors.grey400,
              fontSize: 13,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return AppFooter(
      children: [
        AppButton(label: "SAVE & CONTINUE", onPressed: _saveAndContinue),
      ],
    );
  }
}
