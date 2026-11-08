import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/orders/models/food_name_model.dart';
import 'package:ordering/features/orders/providers/menu_provider.dart';

/// The item name field, suggesting common items (in the app's language) as
/// the vendor types. Picking one fills the English name, whose spellings the
/// server already has; anything else typed is saved as it is.
class FoodNameField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<FoodNameModel>? onSelected;

  const FoodNameField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.errorText,
    this.onChanged,
    this.onSelected,
  });

  @override
  State<FoodNameField> createState() => _FoodNameFieldState();
}

class _FoodNameFieldState extends State<FoodNameField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    final token = context.read<AuthProvider>().token;
    context.read<MenuProvider>().loadFoodNames(token);
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => RawAutocomplete<FoodNameModel>(
        textEditingController: widget.controller,
        focusNode: _focus,
        displayStringForOption: (option) => option.name,
        optionsBuilder: (value) =>
            context.read<MenuProvider>().suggestFoodNames(value.text),
        onSelected: (option) {
          widget.onSelected?.call(option);
          widget.onChanged?.call(option.name);
        },
        fieldViewBuilder: (context, controller, focusNode, _) => AppInput(
          controller: controller,
          focusNode: focusNode,
          label: widget.label,
          hint: widget.hint,
          hasError: widget.errorText != null,
          errorText: widget.errorText,
          onChanged: widget.onChanged,
        ),
        optionsViewBuilder: (context, onSelected, options) => Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            clipBehavior: Clip.antiAlias,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: 240,
                maxWidth: constraints.maxWidth,
              ),
              child: ListView(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                children: [
                  for (final option in options)
                    InkWell(
                      onTap: () => onSelected(option),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              option.displayName,
                              style: AppTextStyles.body.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (option.displayName != option.name)
                              Text(
                                option.name,
                                style: AppTextStyles.caption.copyWith(
                                  color: AppColors.grey500,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
