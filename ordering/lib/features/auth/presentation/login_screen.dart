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
            ? "Vendor ID or Mobile Number is required"
            : null;
        _pinError = _pinController.text.length < 4
            ? "Please enter a 4-digit PIN"
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
        AppSnackBar.show(context, message: "Login successful", isError: false);

        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => const SwitchCartScreen(isDraggable: false),
          ),
        );
      } else {
        if (!mounted) return;
        AppSnackBar.show(
          context,
          message: "Login failed. Please check your credentials.",
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppGaps.h40,
              Image.asset("assets/images/logo_text.png", height: 24),
              AppGaps.h40,
              Text("Welcome Back", style: AppTextStyles.heading1),
              AppGaps.h8,
              Text(
                "Login to manage your cart and start\nreceiving orders.",
                style: AppTextStyles.body.copyWith(color: Colors.grey[600]),
              ),
              AppGaps.h16,
              _buildLoginForm(),
              AppGaps.h16,
              _buildFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    final provider = Provider.of<AuthProvider>(context);

    void openBottomSheet() {
      showModalBottomSheet(
        context: context,
        builder: (context) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "Support",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 16),
                Text(
                  "Please call this number for support:\n9008533182",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16),
                ),
                SizedBox(height: 20),
              ],
            ),
          );
        },
      );
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppInput(
              controller: _vendorIdController,
              label: "Phone Number or Vendor ID",
              hint: "XXXXXXXXXX or VEN-XXXXXX",
              keyboardType: TextInputType.text,
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, right: 8),
                child: Icon(Icons.person_outline, color: Colors.grey, size: 22),
              ),
              onChanged: (v) {
                if (_vendorIdError != null) {
                  setState(() => _vendorIdError = null);
                }
              },
            ),
            if (_vendorIdError != null) ...[
              AppGaps.h8,
              Text(
                _vendorIdError!,
                style: AppTextStyles.body.copyWith(
                  color: Colors.red,
                  fontSize: 13,
                ),
              ),
            ],

            AppGaps.h24,

            AppInput(
              controller: _pinController,
              label: "4-digit PIN",
              hint: "• • • •",
              obscureText: _obscurePin,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, right: 8),
                child: Icon(Icons.lock_outline, color: Colors.grey, size: 22),
              ),
              suffix: IconButton(
                icon: Icon(
                  _obscurePin
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  color: Colors.grey,
                ),
                onPressed: () => setState(() => _obscurePin = !_obscurePin),
              ),
              onChanged: (v) {
                if (_pinError != null) setState(() => _pinError = null);
              },
            ),
            if (_pinError != null) ...[
              AppGaps.h8,
              Text(
                _pinError!,
                style: AppTextStyles.body.copyWith(
                  color: Colors.red,
                  fontSize: 13,
                ),
              ),
            ],
            AppGaps.h12,
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SizedBox(),
                GestureDetector(
                  onTap: () {
                    openBottomSheet();
                  },
                  child: const Text(
                    "Forgot PIN?",
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            AppGaps.h12,
            AppButton(
              label: "Login",
              onPressed: () => _handleLogin(),
              isLoading: provider.isLoading,
              width: double.infinity,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    void openBottomSheet() {
      showModalBottomSheet(
        context: context,
        builder: (context) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "Support",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 16),
                Text(
                  "Please call this number for support:\n9008533182",
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16),
                ),
                SizedBox(height: 20),
              ],
            ),
          );
        },
      );
    }

    return Center(
      child: RichText(
        text: TextSpan(
          text: "New vendor? ",
          style: AppTextStyles.body.copyWith(color: Colors.grey),
          children: [
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: InkWell(
                onTap: () {
                  openBottomSheet();
                },
                child: Text(
                  "Contact Support",
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.primary,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
