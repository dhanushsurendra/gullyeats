import 'package:flutter/material.dart';
import 'package:flutter/services.dart'; 
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';

class EditMenuDialog extends StatefulWidget {
  final String initialName;
  final double initialPrice;
  final bool initialIsVeg;

  const EditMenuDialog({
    super.key,
    required this.initialName,
    required this.initialPrice,
    required this.initialIsVeg,
  });

  @override
  State<EditMenuDialog> createState() => _EditMenuDialogState();
}

class _EditMenuDialogState extends State<EditMenuDialog> {
  late final TextEditingController _nameController;
  late final TextEditingController _priceController;
  late bool _isVeg;

  String? _errorText;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName);
    _priceController = TextEditingController(
      text: widget.initialPrice.toString(),
    );
    _isVeg = widget.initialIsVeg;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _handleUpdate() {
    final name = _nameController.text.trim();
    final priceStr = _priceController.text.trim();
    final price = double.tryParse(priceStr);

    if (name.isEmpty) {
      setState(() => _errorText = "Item name cannot be empty");
      return;
    }
    if (price == null || price <= 0) {
      setState(() => _errorText = "Please enter a valid price");
      return;
    }

    Navigator.pop(context, {'name': name, 'price': price, 'isVeg': _isVeg});
  }

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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Edit Item", style: AppTextStyles.heading2),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded),
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          AppGaps.h24,
          _buildLabel("ITEM NAME"),
          _buildTextField(
            controller: _nameController,
            hint: "e.g. Chicken Momos",
            onChanged: (_) => setState(() => _errorText = null),
          ),
          AppGaps.h24,
          _buildLabel("PRICE (₹)"),
          _buildTextField(
            controller: _priceController,
            hint: "0",
            isNumber: true,
            onChanged: (_) => setState(() => _errorText = null),
          ),
          AppGaps.h24,
          _buildLabel("CATEGORY"),
          Row(
            children: [
              _categoryChip("Veg", true),
              AppGaps.w12,
              _categoryChip("Non-Veg", false),
            ],
          ),

          if (_errorText != null) ...[
            AppGaps.h16,
            Text(
              _errorText!,
              style: const TextStyle(
                color: AppColors.error,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],

          AppGaps.h32,
          AppButton(label: "UPDATE ITEM", onPressed: _handleUpdate),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) => Padding(
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

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    bool isNumber = false,
    void Function(String)? onChanged,
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
        keyboardType: isNumber
            ? const TextInputType.numberWithOptions(decimal: false)
            : TextInputType.text,
        inputFormatters: isNumber
            ? [FilteringTextInputFormatter.digitsOnly]
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

  Widget _categoryChip(String label, bool value) {
    bool isSelected = _isVeg == value;
    Color activeColor = value ? Colors.green : Colors.red;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _isVeg = value),
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? activeColor.withValues(alpha: 0.08) : Colors.white,
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
