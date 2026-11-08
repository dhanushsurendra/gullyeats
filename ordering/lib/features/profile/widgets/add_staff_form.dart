import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/l10n/l10n.dart';

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
        _staffNameError = context.l10n.nameRequired;
      } else if (name.length < 2) {
        _staffNameError = context.l10n.enterValidName;
      }

      if (phone.isEmpty) {
        _staffPhoneError = context.l10n.phoneRequired;
      } else if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phone)) {
        _staffPhoneError = context.l10n.enterValid10DigitNumber;
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
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.addHelper, style: AppTextStyles.heading2),

          AppGaps.h24,

          AppInput(
            controller: _staffNameController,
            label: context.l10n.staffName,
            hint: context.l10n.enterHelperName,
            keyboardType: TextInputType.text,
            hasError: _staffNameError != null,
            errorText: _staffNameError,
            onChanged: (value) {
              if (_staffNameError != null) {
                setState(() => _staffNameError = null);
              }
            },
          ),

          AppGaps.h24,

          AppInput(
            controller: _staffPhoneController,
            label: context.l10n.staffMobileNumber,
            hint: "0000000000",
            keyboardType: TextInputType.phone,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10),
            ],
            prefix: Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text("+91", style: AppTextStyles.heading3),
            ),
            hasError: _staffPhoneError != null,
            errorText: _staffPhoneError,
            onChanged: (value) {
              if (_staffPhoneError != null) {
                setState(() => _staffPhoneError = null);
              }
            },
          ),

          AppGaps.h24,

          AppButton(
            label: context.l10n.sendDetailsCaps,
            isLoading: widget.isLoading,
            onPressed: _handleAddStaff,
          ),
        ],
      ),
    );
  }
}
