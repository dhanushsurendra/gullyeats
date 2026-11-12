import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/info_box.dart';

class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key});

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  final _currentPin = TextEditingController();
  final _newPin = TextEditingController();
  final _confirmPin = TextEditingController();
  bool _isLoading = false;

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  String? currentPinError;
  String? newPinError;
  String? confirmPinError;
  
  Future<void> _validateAndSubmit() async {
    setState(() {
      currentPinError = null;
      newPinError = null;
      confirmPinError = null;
    });

    bool isValid = true;

    if (_currentPin.text.isEmpty) {
      currentPinError = context.l10n.currentPinRequired;
      isValid = false;
    }

    if (_newPin.text.isEmpty) {
      newPinError = context.l10n.newPinRequired;
      isValid = false;
    } else if (!RegExp(r'^\d{4}$').hasMatch(_newPin.text)) {
      newPinError = context.l10n.pinMust4Digits;
      isValid = false;
    } else if (_currentPin.text == _newPin.text) {
      newPinError = context.l10n.pinSameAsCurrent;
      isValid = false;
    }

    if (_confirmPin.text.isEmpty) {
      confirmPinError = context.l10n.confirmYourPin;
      isValid = false;
    } else if (_newPin.text != _confirmPin.text) {
      confirmPinError = context.l10n.pinMismatch;
      isValid = false;
    }

    if (!isValid) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final auth = context.read<AuthProvider>();
      await auth.changePin(auth.token, _currentPin.text, _newPin.text);

      if (!mounted) return;

      AppSnackBar.show(
        context,
        message: context.l10n.pinUpdated,
        marginBottom: 0,
      );

      _currentPin.clear();
      _newPin.clear();
      _confirmPin.clear();

      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _currentPin.dispose();
    _newPin.dispose();
    _confirmPin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BaseScreen(
      title: l10n.changePin,
      subtitle: l10n.changePinSubtitle,
      onBack: () => Navigator.pop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _pinField(
            label: l10n.currentPin,
            controller: _currentPin,
            obscure: _obscureCurrent,
            toggle: () => setState(() => _obscureCurrent = !_obscureCurrent),
            error: currentPinError,
            onChanged: (_) => setState(() => currentPinError = null),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => AppSnackBar.show(
                context,
                message: l10n.contactSupportToResetPin,
                marginBottom: 0,
              ),
              child: Text(
                l10n.forgotCurrentPin,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          AppGaps.h8,
          _pinField(
            label: l10n.newPin,
            controller: _newPin,
            obscure: _obscureNew,
            toggle: () => setState(() => _obscureNew = !_obscureNew),
            error: newPinError,
            onChanged: (_) => setState(() => newPinError = null),
          ),
          AppGaps.h16,
          _pinField(
            label: l10n.confirmNewPin,
            controller: _confirmPin,
            obscure: _obscureConfirm,
            toggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
            error: confirmPinError,
            onChanged: (_) => setState(() => confirmPinError = null),
          ),
          AppGaps.h24,
          // The action comes right after typing, so it sits under the fields
          // rather than in a footer the keyboard would hide.
          AppButton(
            label: l10n.updatePinCaps,
            isLoading: _isLoading,
            onPressed: _validateAndSubmit,
          ),
          AppGaps.h24,
          InfoBox(lines: [l10n.pinHint], icon: Icons.lock_outline),
        ],
      ),
    );
  }

  Widget _pinField({
    required String label,
    required TextEditingController controller,
    required bool obscure,
    required VoidCallback toggle,
    required String? error,
    required Function(String) onChanged,
  }) {
    return AppInput(
      label: label,
      controller: controller,
      obscureText: obscure,
      keyboardType: TextInputType.number,
      hint: "••••",
      hasError: error != null,
      errorText: error,
      suffix: IconButton(
        icon: Icon(
          obscure ? Icons.visibility_off : Icons.visibility,
          color: AppColors.grey600,
        ),
        onPressed: toggle,
      ),
      onChanged: onChanged,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(4),
      ],
    );
  }
}
