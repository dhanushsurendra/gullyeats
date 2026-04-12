import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_input.dart';

class AddStaffForm extends StatefulWidget {
  final Function(String, String) onAddStaff;
  final bool isLoading;
  const AddStaffForm({
    super.key,
    required this.onAddStaff,
    required this.isLoading,
  });

  @override
  State<AddStaffForm> createState() => _AddStaffFormState();
}

class _AddStaffFormState extends State<AddStaffForm> {
  final TextEditingController _staffNameController = TextEditingController();
  final TextEditingController _staffPhoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _staffNameController.dispose();
    _staffPhoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Add Helper", style: AppTextStyles.heading2),
            AppGaps.h24,
            AppInput(
              controller: _staffNameController,
              label: "Staff Name",
              hint: "Enter helper's name",
              keyboardType: TextInputType.text,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return "Name is required";
                }
                if (value.trim().length < 2) {
                  return "Enter a valid name";
                }
                return null;
              },
            ),
            AppGaps.h24,
            AppInput(
              controller: _staffPhoneController,
              label: "Staff Mobile Number",
              hint: "0000000000",
              keyboardType: TextInputType.phone,
              prefix: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text("+91", style: AppTextStyles.heading3),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return "Phone number is required";
                }
                if (!RegExp(r'^[6-9]\d{9}$').hasMatch(value.trim())) {
                  return "Enter a valid 10-digit number";
                }
                return null;
              },
            ),
            AppGaps.h24,
            AppButton(
              label: "SEND DETAILS",
              isLoading: widget.isLoading,
              onPressed: () {
                if (_formKey.currentState!.validate()) {
                  widget.onAddStaff(
                    _staffNameController.text.trim(),
                    _staffPhoneController.text.trim(),
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
