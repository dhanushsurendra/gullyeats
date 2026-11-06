import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_input.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/core/widgets/info_box.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';

/// Login for a vendor who already has a finished outlet. The server refuses
/// OTP for them, so staff use the vendor's ID or phone number and PIN.
class PinLoginScreen extends StatefulWidget {
  const PinLoginScreen({super.key});

  @override
  State<PinLoginScreen> createState() => _PinLoginScreenState();
}

class _PinLoginScreenState extends State<PinLoginScreen> {
  final _idController = TextEditingController();
  final _pinController = TextEditingController();
  String? _errorMessage;
  bool _isLoading = false;

  @override
  void dispose() {
    _idController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    final id = _idController.text.trim();
    final pin = _pinController.text.trim();

    if (id.isEmpty || pin.length != 4) {
      setState(() => _errorMessage = "Enter the Vendor ID or phone number and the 4-digit PIN");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final args = await context.read<AuthProvider>().loginWithPin(id, pin);
      if (mounted) Navigator.pushNamed(context, AppRoutes.carts, arguments: args);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) setState(() => _errorMessage = message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: 'Vendor Login',
      subtitle: 'For vendors who are already onboarded',
      onBack: () => Navigator.pop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppInput(
            controller: _idController,
            label: "Vendor ID or Mobile Number",
            hint: "VEN-XXXXXX or 0000000000",
          ),
          AppGaps.h16,
          AppInput(
            controller: _pinController,
            label: "PIN",
            hint: "4 digits",
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(4),
            ],
          ),
          if (_errorMessage != null) ...[
            AppGaps.h8,
            Text(
              _errorMessage!,
              style: AppTextStyles.body.copyWith(color: AppColors.error, fontSize: 13),
            ),
          ],
          AppGaps.h24,
          AppButton(label: "LOG IN", isLoading: _isLoading, onPressed: _login),
          AppGaps.h24,
          const InfoBox(
            lines: ["The vendor got their ID and PIN by SMS when onboarding finished."],
            icon: Icons.info_outline,
          ),
        ],
      ),
    );
  }
}
