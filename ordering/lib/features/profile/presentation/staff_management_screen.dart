import 'package:flutter/material.dart';

import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/widgets/app_back_button.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_input.dart';
import 'package:ordering/core/widgets/app_snack_bar.dart';
import 'package:ordering/features/auth/providers/auth_provider.dart';
import 'package:ordering/features/cart/models/staff_model.dart';
import 'package:ordering/features/cart/providers/cart_provider.dart';
import 'package:ordering/features/cart/providers/staff_provider.dart';
import 'package:ordering/features/profile/widgets/switch_staff_cart_sheet.dart';
import 'package:ordering/features/profile/widgets/add_staff_form.dart';
import 'package:ordering/features/profile/widgets/staff_member_card.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class StaffManagementScreen extends StatefulWidget {
  const StaffManagementScreen({super.key});

  @override
  State<StaffManagementScreen> createState() => _StaffManagementScreenState();
}

class _StaffManagementScreenState extends State<StaffManagementScreen> {
  bool _isLoading = false; // adding staff
  bool _isStaffLoading = false; // initial list load
  String? _switchingStaffId; // staff currently being moved (for sheet spinner)
  String _query = '';

  final TextEditingController _searchController = TextEditingController();

  List<StaffModel> _staffList = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadStaff();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<StaffModel> get _filteredStaff {
    if (_query.trim().isEmpty) return _staffList;
    final q = _query.trim().toLowerCase();
    return _staffList
        .where(
          (s) =>
              s.name.toLowerCase().contains(q) ||
              s.phoneNumber.toLowerCase().contains(q),
        )
        .toList();
  }

  Future<void> _loadStaff() async {
    setState(() => _isStaffLoading = true);

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartId = cartProvider.selectedCart?.id;

      List<StaffModel> staffList = await staffProvider.loadStaff(
        auth.token,
        cartId!,
      );

      setState(() {
        _staffList = staffList;
      });
    } catch (e) {
      print(e);
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 32);
      }
    } finally {
      if (mounted) setState(() => _isStaffLoading = false);
    }
  }

  Future<void> _addStaff(String staffName, String staffPhone) async {
    setState(() => _isLoading = true);

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);

      final cartId = cartProvider.selectedCart?.id;

      if (cartId == null) {
        throw Exception("No cart selected");
      }

      final StaffModel result = await staffProvider.addStaff(
        auth.token,
        staffName,
        staffPhone,
        cartId,
      );

      if (!mounted) return;

      setState(() {
        _staffList.add(result);
      });

      AppSnackBar.show(context, message: "Staff added successfully", marginBottom: 32);

      final message =
          "Your GullyEats credentials:\n"
          "User ID: ${result.userId}\n"
          "PIN: ${result.pinHash}";

      final Uri smsUri = Uri(
        scheme: 'sms',
        path: staffPhone,
        queryParameters: {'body': message},
      );

      if (await canLaunchUrl(smsUri)) {
        await launchUrl(smsUri);
      } else {
        throw 'could_not_launch_sms';
      }
    } catch (e) {
      if (!mounted) return;

      final errorMessage = e == 'could_not_launch_sms'
          ? "Staff added, but couldn't open SMS app."
          : AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: errorMessage, isError: true, marginBottom: 32);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _onDelete(String staffId) async {
    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final result = await staffProvider.deleteStaff(auth.token, staffId);


      if (result != '') {
        if (mounted) {
          AppSnackBar.show(context, message: result, marginBottom: 32);
        }
        setState(() {
          _staffList.removeWhere((staff) => staff.id == staffId);
        });
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 32);
      }
    }
  }

  void _openSwitchCartSheet(String staffId) {
    final staff = _staffList.firstWhere((s) => s.id == staffId);
    final cartProvider = Provider.of<CartProvider>(context, listen: false);

    final cartOptions = cartProvider.carts
        .map(
          (c) => CartOption(id: c.id, cartName: c.cartName, address: c.address),
        )
        .toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return SwitchStaffCartSheet(
          staffName: staff.name,
          currentCartId: staff.cartId,
          carts: cartOptions,
          isLoading: _switchingStaffId == staffId,
          onConfirm: (newCartId, newCartName) async {
            await _switchCart(staffId, newCartId, newCartName);

            if (sheetContext.mounted) {
              Navigator.pop(sheetContext);
            }
          },
        );
      },
    );
  }

  Future<void> _switchCart(
    String staffId,
    String newCartId,
    String newCartName,
  ) async {
    setState(() => _switchingStaffId = staffId);

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);

      await staffProvider.switchStaffCart(auth.token, staffId, newCartId);

      if (mounted) {
        setState(() {
          // Staff no longer belongs to the currently viewed cart.
          _staffList.removeWhere((staff) => staff.id == staffId);
        });
        AppSnackBar.show(context, message: "Staff moved to $newCartName", marginBottom: 32);
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 32);
      }
    } finally {
      if (mounted) setState(() => _switchingStaffId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: AppPadding.screen,
          child: Column(
            children: [
              _buildHeader(context),
              AppGaps.h16,
              Expanded(
                child: RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _loadStaff,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      AddStaffForm(
                        onAddStaff: (staffName, staffPhone) =>
                            _addStaff(staffName, staffPhone),
                        isLoading: _isLoading,
                      ),

                      AppGaps.h32,

                      Row(
                        children: [
                          Text("Your Staff", style: AppTextStyles.heading3),
                          const Spacer(),
                          if (_staffList.isNotEmpty)
                            Text(
                              "${_staffList.length} total",
                              style: AppTextStyles.caption.copyWith(
                                color: Colors.grey.shade500,
                              ),
                            ),
                        ],
                      ),

                      AppGaps.h16,

                      if (_staffList.length > 3) ...[
                        AppInput(
                          controller: _searchController,
                          hint: "Search by name or number",
                          keyboardType: TextInputType.text,
                          prefix: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Icon(
                              Icons.search,
                              color: Colors.grey.shade500,
                            ),
                          ),
                          onChanged: (value) => setState(() => _query = value),
                        ),
                        AppGaps.h16,
                      ],

                      if (_isStaffLoading)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (_staffList.isEmpty)
                        _buildEmptyState("No staff added yet")
                      else if (_filteredStaff.isEmpty)
                        _buildEmptyState("No staff match \"$_query\"")
                      else
                        ..._filteredStaff.map(
                          (staff) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: StaffMemberCard(
                              staffId: staff.id,
                              name: staff.name,
                              phone: staff.phoneNumber,
                              role: staff.role,
                              onDelete: _onDelete,
                              onSwitchCart: _openSwitchCartSheet,
                            ),
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
      bottomNavigationBar: _buildFooter(),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [AppBackButton()]),
        AppGaps.h24,
        Text("Staff Management", style: AppTextStyles.heading2),
        AppGaps.h4,
        Text(
          "Add helpers who can run your cart using OTP.",
          style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
        ),
      ],
    );
  }

  Widget _buildEmptyState(String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.people_outline, size: 48, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            Text(
              message,
              style: AppTextStyles.body.copyWith(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: AppButton(
          label: "CONTINUE",
          onPressed: () => Navigator.pushNamed(context, "/cart-activated"),
        ),
      ),
    );
  }
}
