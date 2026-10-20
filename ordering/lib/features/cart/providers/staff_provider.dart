import 'package:flutter/material.dart';

import 'package:ordering/features/cart/models/staff_model.dart';
import 'package:ordering/features/cart/services/staff_service.dart';

class StaffProvider with ChangeNotifier {
  final StaffService _staffService = StaffService();

  Future<StaffModel> addStaff(
    String? token,
    String staffName,
    String staffPhone,
    String cartId,
  ) async {
    try {
      final result = await _staffService.addStaff(
        token,
        cartId,
        staffName,
        staffPhone,
      );
      return result;
    } finally {
      notifyListeners();
    }
  }

  Future<List<StaffModel>> loadStaff(String? token, String cartId) async {
    try {
      List<StaffModel> staffList = await _staffService.getAllStaff(
        token,
        cartId,
      );
      return staffList;
    } finally {
      notifyListeners();
    }
  }

  Future<String> deleteStaff(String? token, String staffId) async {
    try {
      return await _staffService.deleteStaff(token, staffId);
    } finally {
      notifyListeners();
    }
  }

  /// Moves [staffId] to [newCartId]. Returns the updated staff record.
  Future<StaffModel> switchStaffCart(
    String? token,
    String staffId,
    String newCartId,
  ) async {
    try {
      return await _staffService.switchStaffCart(token, staffId, newCartId);
    } finally {
      notifyListeners();
    }
  }

  void clear() {
    notifyListeners();
  }
}
