import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_input.dart';

class AddStaffForm extends StatefulWidget {
  final Future<void> Function(String, String) onAddStaff;
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

  String? _staffNameError;
  String? _staffPhoneError;

  @override
  void dispose() {
    _staffNameController.dispose();
    _staffPhoneController.dispose();
    super.dispose();
  }

  Future<void> _handleAddStaff() async {
    setState(() {
      _staffNameError = null;
      _staffPhoneError = null;

      final name = _staffNameController.text.trim();
      final phone = _staffPhoneController.text.trim();

      if (name.isEmpty) {
        _staffNameError = "Name is required";
      } else if (name.length < 2) {
        _staffNameError = "Enter a valid name";
      }

      if (phone.isEmpty) {
        _staffPhoneError = "Phone number is required";
      } else if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
        _staffPhoneError = "Enter a valid 10-digit number";
      }
    });

    if (_staffNameError != null || _staffPhoneError != null) {
      return;
    }

    await widget.onAddStaff(
      _staffNameController.text.trim(),
      _staffPhoneController.text.trim(),
    );

    if (!mounted) return;

    _staffNameController.clear();
    _staffPhoneController.clear();
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
            onChanged: (value) {
              if (_staffNameError != null) {
                setState(() => _staffNameError = null);
              }
            },
          ),

          if (_staffNameError != null) ...[
            AppGaps.h8,
            Text(
              _staffNameError!,
              style: AppTextStyles.body.copyWith(
                color: Colors.red,
                fontSize: 13,
              ),
            ),
          ],

          AppGaps.h24,

          AppInput(
            controller: _staffPhoneController,
            label: "Staff Mobile Number",
            hint: "0000000000",
            keyboardType: TextInputType.phone,
            prefix: const SizedBox(
              width: 48,
              child: Center(child: Text("+91", style: AppTextStyles.heading3)),
            ),
            onChanged: (value) {
              if (_staffPhoneError != null) {
                setState(() => _staffPhoneError = null);
              }
            },
          ),

          if (_staffPhoneError != null) ...[
            AppGaps.h8,
            Text(
              _staffPhoneError!,
              style: AppTextStyles.body.copyWith(
                color: Colors.red,
                fontSize: 13,
              ),
            ),
          ],

          AppGaps.h24,

          AppButton(
            label: "SEND DETAILS",
            isLoading: widget.isLoading,
            onPressed: _handleAddStaff,
          ),
        ],
      ),
    );
  }
}
