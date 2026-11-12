import 'package:flutter/material.dart';
import 'package:ordering/core/widgets/skeleton.dart';

import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
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
import 'package:ordering/l10n/l10n.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/core/widgets/list_message.dart';

class StaffManagementScreen extends StatefulWidget {
  const StaffManagementScreen({super.key});

  @override
  State<StaffManagementScreen> createState() => _StaffManagementScreenState();
}

class _StaffManagementScreenState extends State<StaffManagementScreen> {
  bool _isLoading = false; // adding staff
  bool _isStaffLoading = false; // initial list load
  bool _loadFailed = false;
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
    setState(() {
      _isStaffLoading = true;
      _loadFailed = false;
    });

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartId = cartProvider.selectedCart?.id;

      List<StaffModel> staffList = await staffProvider.loadStaff(
        auth.token,
        cartId!,
      );

      if (mounted) setState(() => _staffList = staffList);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        setState(() => _loadFailed = true);
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 0);
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
        throw Exception(context.l10n.noCartSelected);
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

      AppSnackBar.show(context, message: context.l10n.staffAdded, marginBottom: 0);

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
          ? context.l10n.staffAddedNoSms
          : AppExceptionHandler.getMessage(e);

      AppSnackBar.show(context, message: errorMessage, isError: true, marginBottom: 0);
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
          AppSnackBar.show(context, message: result, marginBottom: 0);
        }
        setState(() {
          _staffList.removeWhere((staff) => staff.id == staffId);
        });
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 0);
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
        AppSnackBar.show(context, message: context.l10n.staffMovedTo(newCartName), marginBottom: 0);
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true, marginBottom: 0);
      }
    } finally {
      if (mounted) setState(() => _switchingStaffId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return BaseScreen(
      title: l10n.staffManagement,
      subtitle: l10n.staffSubtitle,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
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
                Expanded(
                  child: Text(l10n.yourStaff, style: AppTextStyles.heading2),
                ),
                if (_staffList.isNotEmpty)
                  Text(
                    l10n.totalCount(_staffList.length),
                    style: AppTextStyles.caption.copyWith(color: AppColors.grey500),
                  ),
              ],
            ),
            AppGaps.h16,
            if (_staffList.length > 3) ...[
              AppSearchBar(
                controller: _searchController,
                hintText: l10n.searchStaff,
                onChanged: (value) => setState(() => _query = value),
              ),
              AppGaps.h16,
            ],
            if (_isStaffLoading && _staffList.isEmpty)
              Skeleton.rows(count: 3, height: 72)
            else if (_loadFailed && _staffList.isEmpty)
              ListMessage.failed(message: l10n.couldntLoadStaff, onRetry: _loadStaff)
            else if (_staffList.isEmpty)
              ListMessage(icon: Icons.people_outline, message: l10n.noStaffYet)
            else if (_filteredStaff.isEmpty)
              ListMessage(
                icon: Icons.search_off_rounded,
                message: l10n.noStaffMatch(_query),
              )
            else
              for (final staff in _filteredStaff)
                Padding(
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
          ],
        ),
      ),
    );
  }
}
