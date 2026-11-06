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
import 'package:ordering/features/cart/presentation/switch_cart_screen.dart';
import 'package:provider/provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/theme/app_padding.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _vendorIdController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();

  bool _obscurePin = true;

  String? _vendorIdError;
  String? _pinError;

  @override
  void dispose() {
    _vendorIdController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    try {
      setState(() {
        _vendorIdError = _vendorIdController.text.isEmpty
            ? context.l10n.vendorIdRequired
            : null;
        _pinError = _pinController.text.length < 4
            ? context.l10n.enter4DigitPin
            : null;
      });

      if (_vendorIdError != null || _pinError != null) {
        return;
      }

      final provider = Provider.of<AuthProvider>(context, listen: false);
      bool isLoggedIn = await provider.login(
        _vendorIdController.text.trim(),
        _pinController.text.trim(),
      );

      if (isLoggedIn) {
        if (!mounted) return;
        AppSnackBar.show(context, message: context.l10n.loginSuccessful, isError: false);

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const SwitchCartScreen(isDraggable: false),
          ),
        );
      } else {
        if (!mounted) return;
        AppSnackBar.show(
          context,
          message: context.l10n.loginFailed,
          isError: true,
        );
      }
    } catch (e) {
      if (!mounted) return;

      final message = AppExceptionHandler.getMessage(e);

      AppSnackBar.show(
        context,
        message: message,
        marginBottom: 0,
        isError: true,
      );
    }
  }

  void _showSupport() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: AppPadding.screen,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(context.l10n.support, style: AppTextStyles.heading2),
              AppGaps.h16,
              Text(
                context.l10n.callSupport,
                textAlign: TextAlign.center,
                style: AppTextStyles.body,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final provider = Provider.of<AuthProvider>(context);

    return BaseScreen(
      showBackButton: false,
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Image.asset("assets/images/logo_text.png", height: 24),
          AppGaps.h40,
          Text(l10n.welcomeBack, style: AppTextStyles.heading1),
          AppGaps.h4,
          Text(
            l10n.loginSubtitle,
            style: AppTextStyles.body.copyWith(color: AppColors.grey400),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppInput(
              controller: _vendorIdController,
              label: l10n.phoneOrVendorId,
              hint: l10n.loginHint,
              keyboardType: TextInputType.text,
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, right: 8),
                child: Icon(Icons.person_outline, color: AppColors.grey400, size: 22),
              ),
              hasError: _vendorIdError != null,
              errorText: _vendorIdError,
              onChanged: (v) {
                if (_vendorIdError != null) {
                  setState(() => _vendorIdError = null);
                }
              },
            ),
            AppGaps.h16,
            AppInput(
              controller: _pinController,
              label: l10n.fourDigitPin,
              hint: "• • • •",
              obscureText: _obscurePin,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, right: 8),
                child: Icon(Icons.lock_outline, color: AppColors.grey400, size: 22),
              ),
              suffix: IconButton(
                icon: Icon(
                  _obscurePin
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: AppColors.grey400,
                ),
                onPressed: () => setState(() => _obscurePin = !_obscurePin),
              ),
              hasError: _pinError != null,
              errorText: _pinError,
              onChanged: (v) {
                if (_pinError != null) setState(() => _pinError = null);
              },
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _showSupport,
                child: Text(
                  l10n.forgotPin,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            AppGaps.h8,
            // Right after typing, so under the fields rather than in a footer.
            AppButton(
              label: l10n.login.toUpperCase(),
              onPressed: () => _handleLogin(),
              isLoading: provider.isLoading,
            ),
            AppGaps.h24,
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    l10n.newVendor,
                    style: AppTextStyles.body.copyWith(color: AppColors.grey400),
                  ),
                  InkWell(
                    onTap: _showSupport,
                    child: Text(
                      l10n.contactSupport,
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.primary,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
