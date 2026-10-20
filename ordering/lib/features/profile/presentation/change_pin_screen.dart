import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_header.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';

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
      currentPinError = "Current PIN is required";
      isValid = false;
    }

    if (_newPin.text.isEmpty) {
      newPinError = "New PIN is required";
      isValid = false;
    } 

    if (_confirmPin.text.isEmpty) {
      confirmPinError = "Confirm your PIN";
      isValid = false;
    } 

    if (_newPin.text != _confirmPin.text) {
      confirmPinError = "PIN does not match";
      isValid = false;
    }

    if (_currentPin.text == _newPin.text) {
      newPinError = "New PIN cannot be same as current PIN";
      isValid = false;
    }

    if (!isValid) return;

    setState(() {
      _isLoading = true;
    });

    // TODO: Pass actual token and user ID

    try {
      await context.read<AuthProvider>().changePin(
        "",
        _currentPin.text,
        _newPin.text,
        "69db91a03766ae8b43dd50bf"
      );

      if (!mounted) return;

      AppSnackBar.show(
        context,
        message: "PIN updated successfully",
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
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            AppGaps.h16,
            AppHeader(title: "Change Pin", showBack: true),
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: AppPadding.screen,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Update your 4-digit login PIN securely.",
                        style: AppTextStyles.caption,
                      ),
                      AppGaps.h24,
                      Container(
                        padding: AppPadding.card,
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.grey200),
                        ),
                        child: Column(
                          children: [
                            _pinField(
                              label: "Current PIN",
                              controller: _currentPin,
                              obscure: _obscureCurrent,
                              toggle: () => setState(
                                () => _obscureCurrent = !_obscureCurrent,
                              ),
                              error: currentPinError,
                              onChanged: (_) {
                                setState(() {
                                  currentPinError = null;
                                });
                              },
                            ),
                            AppGaps.h12,

                            Align(
                              alignment: Alignment.centerRight,
                              child: GestureDetector(
                                onTap: () {
                                  AppSnackBar.show(
                                    context,
                                    message:
                                        "Please contact support at 9108735100 to reset your PIN",
                                    marginBottom: 0,
                                  );
                                },
                                child: Text(
                                  "Forgot current PIN?",
                                  style: AppTextStyles.caption.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            AppGaps.h12,

                            _pinField(
                              label: "Current PIN",
                              controller: _newPin,
                              obscure: _obscureNew,
                              toggle: () =>
                                  setState(() => _obscureNew = !_obscureNew),
                              error: newPinError,
                              onChanged: (_) {
                                setState(() {
                                  currentPinError = null;
                                });
                              },
                            ),

                            AppGaps.h12,
                            _pinField(
                              label: "Confirm New PIN",
                              controller: _confirmPin,
                              obscure: _obscureConfirm,
                              toggle: () => setState(
                                () => _obscureConfirm = !_obscureConfirm,
                              ),
                              error: confirmPinError,
                              onChanged: (_) {
                                setState(() {
                                  currentPinError = null;
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                      AppGaps.h16,
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.grey100,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.lock,
                              size: 16,
                              color: AppColors.grey600,
                            ),
                            AppGaps.w8,
                            Expanded(
                              child: Text(
                                "PIN must be 4 digits. Do not share.",
                                style: AppTextStyles.caption,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16.0),
              child: AppButton(
                label: "UPDATE PIN",
                isLoading: _isLoading,
                onPressed: _validateAndSubmit
              ),
            ),
          ],
        ),
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
