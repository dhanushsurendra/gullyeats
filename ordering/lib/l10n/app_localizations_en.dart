// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get sales => 'Sales';

  @override
  String get orders => 'Orders';

  @override
  String get profile => 'Profile';

  @override
  String get cancel => 'Cancel';

  @override
  String get change => 'Change';

  @override
  String get open => 'Open';

  @override
  String get closed => 'Closed';

  @override
  String get delete => 'Delete';

  @override
  String get remove => 'Remove';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get platformFee => 'Platform Fee';

  @override
  String get parcel => 'Parcel';

  @override
  String get total => 'Total';

  @override
  String get paid => 'Paid';

  @override
  String get served => 'Served';

  @override
  String get unpaid => 'Unpaid';

  @override
  String get cancelled => 'Cancelled';

  @override
  String get pending => 'Pending';

  @override
  String get veg => 'Veg';

  @override
  String get nonVeg => 'Non-Veg';

  @override
  String get inStock => 'In Stock';

  @override
  String get outOfStock => 'Out of Stock';

  @override
  String get inStockCaps => 'IN STOCK';

  @override
  String get outOfStockCaps => 'OUT OF STOCK';

  @override
  String get stockIn => 'In';

  @override
  String get stockOut => 'Out';

  @override
  String get qrOrder => 'QR Order';

  @override
  String get manual => 'Manual';

  @override
  String get all => 'All';

  @override
  String get active => 'Active';

  @override
  String get qrOrders => 'QR Orders';

  @override
  String get stock => 'Stock';

  @override
  String get allItems => 'All Items';

  @override
  String get noItems => 'No items';

  @override
  String get searchItems => 'Search items...';

  @override
  String get dateRange => 'Date Range';

  @override
  String get noOrdersInPeriod => 'No orders in this period yet';

  @override
  String get cameraPermissionRequired => 'Camera permission is required.';

  @override
  String get cameraPermission => 'Camera Permission';

  @override
  String get cameraAccessDenied =>
      'Camera access was denied. Please enable it from app settings.';

  @override
  String get openSettings => 'Open Settings';

  @override
  String get choosePhoto => 'Choose Photo';

  @override
  String get takePhoto => 'Take Photo';

  @override
  String get chooseFromGallery => 'Choose from Gallery';

  @override
  String get failedToUploadPhoto => 'Failed to upload photo';

  @override
  String get photoUploaded => 'Photo uploaded successfully';

  @override
  String get cameraOrGallery => 'Camera or gallery';

  @override
  String get addItem => 'Add Item';

  @override
  String get saveChangesCaps => 'SAVE CHANGES';

  @override
  String get switchCart => 'Switch Cart';

  @override
  String get switchCartCaps => 'SWITCH CART';

  @override
  String get vendor => 'Vendor';

  @override
  String get ordersOverview => 'Orders Overview';

  @override
  String get languagePreferences => 'Language Preferences';

  @override
  String get busyHours => 'Busy Hours';

  @override
  String get unableToCheckPaymentStatus =>
      'Unable to check payment status. Please try again.';

  @override
  String get verificationPending => 'Verification Pending';

  @override
  String get vendorIdRequired => 'Vendor ID or Mobile Number is required';

  @override
  String get enter4DigitPin => 'Please enter a 4-digit PIN';

  @override
  String get loginSuccessful => 'Login successful';

  @override
  String get loginFailed => 'Login failed. Please check your credentials.';

  @override
  String get welcomeBack => 'Welcome Back';

  @override
  String get loginSubtitle =>
      'Login to manage your cart and start\nreceiving orders.';

  @override
  String get support => 'Support';

  @override
  String get callSupport => 'Please call this number for support:\n9008533182';

  @override
  String get phoneOrVendorId => 'Phone Number or Vendor ID';

  @override
  String get loginHint => 'XXXXXXXXXX or VEN-XXXXXX';

  @override
  String get fourDigitPin => '4-digit PIN';

  @override
  String get forgotPin => 'Forgot PIN?';

  @override
  String get login => 'Login';

  @override
  String get newVendor => 'New vendor? ';

  @override
  String get contactSupport => 'Contact Support';

  @override
  String get cartNameEmpty => 'Cart name can\'t be empty.';

  @override
  String get cityEmpty => 'City can\'t be empty.';

  @override
  String get cartDetailsUpdated => 'Cart details updated!';

  @override
  String get discardChanges => 'Discard changes?';

  @override
  String get unsavedChanges =>
      'You have unsaved changes. Leave without saving?';

  @override
  String get keepEditing => 'Keep Editing';

  @override
  String get discard => 'Discard';

  @override
  String get editCartDetails => 'Edit Cart Details';

  @override
  String get selectCity => 'Select City';

  @override
  String get cartPhoto => 'Cart Photo';

  @override
  String get cartPhotoHelp =>
      'Used for verification — no gallery uploads allowed.';

  @override
  String get cartInformation => 'Cart Information';

  @override
  String get cartName => 'Cart Name';

  @override
  String get cartCity => 'Cart City';

  @override
  String get address => 'Address';

  @override
  String get cartId => 'Cart ID';

  @override
  String get location => 'Location';

  @override
  String get addressAutoUpdates =>
      'Address above updates automatically when you refresh GPS.';

  @override
  String get cartStatus => 'Cart Status';

  @override
  String get cartActive => 'Cart Active';

  @override
  String get visibleToCustomers => 'Visible to customers';

  @override
  String get cartOpen => 'Cart Open';

  @override
  String get acceptingOrders => 'Accepting orders';

  @override
  String get salesDashboard => 'Sales Dashboard';

  @override
  String get salesSubtitle => 'Track your earnings and progress';

  @override
  String get totalRevenue => 'Total Revenue';

  @override
  String get net => 'Net';

  @override
  String get avgOrder => 'Avg Order';

  @override
  String get orderType => 'Order Type';

  @override
  String get parcelOrders => 'Parcel Orders';

  @override
  String get avgParcelCharge => 'Avg Parcel Charge';

  @override
  String get topSellers => 'Top Sellers';

  @override
  String qrOrdersSummary(int count, String amount) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return 'QR · $_temp0 · $amount';
  }

  @override
  String manualOrdersSummary(int count, String amount) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return 'Manual · $_temp0 · $amount';
  }

  @override
  String peakHour(String hour) {
    return 'Peak: $hour';
  }

  @override
  String soldCount(int count) {
    return '$count sold';
  }

  @override
  String totalCount(int count) {
    return '$count total';
  }

  @override
  String rangeLabel(String range) {
    String _temp0 = intl.Intl.selectLogic(range, {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last7': 'Last 7 Days',
      'week': 'Week',
      'other': 'Last 30 Days',
    });
    return '$_temp0';
  }

  @override
  String get stockControl => 'Stock Control';

  @override
  String get chooseCartToSwitch => 'Choose which cart to switch';

  @override
  String get logout => 'Logout';

  @override
  String get searchCarts => 'Search carts...';

  @override
  String get noCartsAssigned => 'No carts assigned. Contact your vendor.';

  @override
  String get checkingPaymentStatus => 'Checking your payment status';

  @override
  String get pleaseWait => 'Please wait a moment...';

  @override
  String get changePhoto => 'Change Photo';

  @override
  String get addPhoto => 'Add Photo';

  @override
  String get tapToAddCartPhoto => 'Tap to add cart photo';

  @override
  String get locationServicesDisabled =>
      'Location services are disabled. Please enable them.';

  @override
  String get locationPermissionRequired => 'Location permission is required.';

  @override
  String get permissionPermanentlyDenied =>
      'Permission permanently denied. Please enable from settings.';

  @override
  String get unableToFetchLocation =>
      'Unable to fetch location. Please try again.';

  @override
  String get mapUnavailable => 'Map unavailable — tap to retry';

  @override
  String get locating => 'Locating...';

  @override
  String get updateGpsLocation => 'Update GPS Location';

  @override
  String get itemNameRequired => 'Item name is required';

  @override
  String get itemNameTooShort => 'Item name must be at least 2 characters';

  @override
  String get priceRequired => 'Price is required';

  @override
  String get itemAdded => 'Added Item Successfully';

  @override
  String get addNewItem => 'Add New Item';

  @override
  String get itemName => 'Item Name';

  @override
  String get itemNameInMyLanguage => 'Item name in your language';

  @override
  String get price => 'Price';

  @override
  String get enterPriceInRupees => 'Enter price in rupees.';

  @override
  String get category => 'Category';

  @override
  String get availability => 'Availability';

  @override
  String get itemPhoto => 'Item Photo (optional)';

  @override
  String get itemNameAndPriceRequired => 'Item name and price are required.';

  @override
  String get takeItemPhoto => 'Take Item Photo';

  @override
  String get uploadPhoto => 'Upload Photo';

  @override
  String get orderCreatedPaid => 'Order created and marked as paid.';

  @override
  String get orderCreated => 'Order created successfully.';

  @override
  String get orderDeleted => 'Order deleted';

  @override
  String get orderUpdated => 'Order updated successfully';

  @override
  String get menuItems => 'Menu Items';

  @override
  String get updateOrder => 'Update Order';

  @override
  String get createOrder => 'Create Order';

  @override
  String get parcelCharges => 'Parcel Charges';

  @override
  String get previousTotal => 'Previous Total';

  @override
  String get newTotalCaps => 'NEW TOTAL';

  @override
  String get markAsPaidCaps => 'MARK AS PAID';

  @override
  String get deleteOrderCaps => 'DELETE ORDER';

  @override
  String get updateOrderCaps => 'UPDATE ORDER';

  @override
  String customerNeedsToPay(String amount) {
    return 'Customer needs to pay ₹$amount more';
  }

  @override
  String giveBackToCustomer(String amount) {
    return 'Give ₹$amount back to customer';
  }

  @override
  String get searchMenuItems => 'Search menu items';

  @override
  String get noMenuItemsFound => 'No menu items found';

  @override
  String get editMenuItems => 'Edit Menu Items';

  @override
  String get editMenuSubtitle => 'Add, remove or update your cart menu.';

  @override
  String get deleteItemQuestion => 'Delete Item?';

  @override
  String get confirmRemoveItem => 'Are you sure you want to remove this item?';

  @override
  String get itemDeleted => 'Item deleted successfully!';

  @override
  String get ordersStatus => 'Orders Status';

  @override
  String get orderMarkedServed => 'Order marked as served';

  @override
  String get serveReverted => 'Serve reverted';

  @override
  String get orderMarkedPaid => 'Order marked as paid';

  @override
  String get paymentReverted => 'Payment reverted';

  @override
  String get orderCancelled => 'Order cancelled';

  @override
  String get orderRestored => 'Order restored';

  @override
  String get noActiveOrders => 'No active orders';

  @override
  String get noQrOrdersToday => 'No QR orders today';

  @override
  String get noManualOrdersToday => 'No manual orders today';

  @override
  String get noOrdersToday => 'No orders today';

  @override
  String ordersTitle(String tab, int count) {
    String _temp0 = intl.Intl.selectLogic(tab, {
      'active': 'Active Orders',
      'qr': 'QR Orders',
      'manual': 'Manual Orders',
      'other': 'All Orders',
    });
    return '$_temp0 ($count)';
  }

  @override
  String get itemNameEmpty => 'Item name cannot be empty';

  @override
  String get enterValidPrice => 'Please enter a valid price';

  @override
  String get itemUpdated => 'Item updated successfully!';

  @override
  String get editItem => 'Edit Item';

  @override
  String get itemNameCaps => 'ITEM NAME';

  @override
  String get priceRupeeCaps => 'PRICE (₹)';

  @override
  String get itemPhotoCaps => 'ITEM PHOTO';

  @override
  String get updateItemCaps => 'UPDATE ITEM';

  @override
  String get uploadNewPhotoCaps => 'UPLOAD NEW PHOTO';

  @override
  String get addItemPhoto => 'Add Item Photo';

  @override
  String get deleteOrder => 'Delete Order';

  @override
  String get confirmDeleteOrder =>
      'Are you sure you want to delete this order?';

  @override
  String get markPaidCaps => 'MARK PAID';

  @override
  String collectFromCustomer(String amount) {
    return 'Collect ₹$amount from customer';
  }

  @override
  String returnToCustomer(String amount) {
    return 'Return ₹$amount to customer';
  }

  @override
  String get markRefunded => 'Mark refunded';

  @override
  String refundedAmount(String amount) {
    return '₹$amount refunded';
  }

  @override
  String get customerSaysNotRefunded =>
      'Customer says they didn\'t get it back';

  @override
  String get toRefund => 'To refund';

  @override
  String moreItems(int count) {
    return '+$count more';
  }

  @override
  String get parcelCharge => 'Parcel Charge';

  @override
  String paidAt(String time) {
    return 'Paid $time';
  }

  @override
  String servedAt(String time) {
    return 'Served $time';
  }

  @override
  String get cartNotFound => 'Unable to find the selected cart.';

  @override
  String get unableToStartPayment =>
      'Unable to start payment. Please try again.';

  @override
  String get paymentReceivedUnlocked =>
      'Payment received. Your cart is unlocked.';

  @override
  String get unableToOpenGateway => 'Unable to open payment gateway.';

  @override
  String get paymentRecordNotFound =>
      'Payment received, but the payment record could not be found.';

  @override
  String get paymentResponseIncomplete =>
      'Payment response was incomplete. Please check payment status.';

  @override
  String get paymentVerifiedUnlocked =>
      'Payment verified successfully. Your cart is unlocked.';

  @override
  String get paymentVerificationPending =>
      'Payment was received but verification is still pending.';

  @override
  String get duplicatePaymentRefunded =>
      'This bill was already paid, so your online payment will be refunded in 5–7 working days.';

  @override
  String get paymentFailedRetry =>
      'Payment failed. You can retry using the same payment.';

  @override
  String get salesOverview => 'Sales Overview';

  @override
  String get trackEarningsAndFees => 'Track earnings & platform fees';

  @override
  String get openingGatewayCaps => 'OPENING PAYMENT GATEWAY...';

  @override
  String get paymentPendingCaps => 'PAYMENT PENDING';

  @override
  String payAndUnlockNow(String amount) {
    return 'PAY ₹$amount & UNLOCK NOW';
  }

  @override
  String get todaySummaryCaps => 'TODAY SUMMARY';

  @override
  String get ordersCompleted => 'Orders Completed';

  @override
  String get paymentStatus => 'Payment Status';

  @override
  String get partiallyPaidCaps => 'PARTIALLY PAID';

  @override
  String get platformFeePending => 'Platform Fee Pending';

  @override
  String get storeLockedPayRazorpay =>
      'Your store is locked. Pay securely using Razorpay to unlock it.';

  @override
  String get securePaymentsRazorpay => 'Secure payments · Powered by Razorpay';

  @override
  String get transactionHistory => 'Transaction History';

  @override
  String get tryAgain => 'Try Again';

  @override
  String get noTransactionsInPeriod => 'No transactions in this period yet';

  @override
  String get transactions => 'Transactions';

  @override
  String get currentPendingTransactionCaps => 'CURRENT PENDING TRANSACTION';

  @override
  String get payment => 'Payment';

  @override
  String get billingDate => 'Billing date';

  @override
  String get paidOn => 'Paid on';

  @override
  String get verifiedOn => 'Verified on';

  @override
  String get noOrders => 'No orders';

  @override
  String orderCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return '$_temp0';
  }

  @override
  String get paymentVerified => 'Payment Verified';

  @override
  String get paymentRejected => 'Payment Rejected';

  @override
  String get paymentExpired => 'Payment Expired';

  @override
  String get transactionReference => 'Transaction reference';

  @override
  String get cartLockedFeePending =>
      'Your cart is currently locked because the platform payment is pending.';

  @override
  String get amountDue => 'Amount Due';

  @override
  String payAndUnlock(String amount) {
    return 'PAY ₹$amount & UNLOCK';
  }

  @override
  String get paymentSubmitted => 'Payment Submitted';

  @override
  String get paymentSubmittedWaiting =>
      'Your payment has been submitted and is waiting for verification.';

  @override
  String get amount => 'Amount';

  @override
  String get status => 'Status';

  @override
  String get checkPaymentStatusCaps => 'CHECK PAYMENT STATUS';

  @override
  String get totalOrders => 'Total Orders';

  @override
  String get currentPinRequired => 'Current PIN is required';

  @override
  String get newPinRequired => 'New PIN is required';

  @override
  String get pinMust4Digits => 'PIN must be 4 digits';

  @override
  String get confirmYourPin => 'Confirm your PIN';

  @override
  String get pinMismatch => 'PIN does not match';

  @override
  String get pinSameAsCurrent => 'New PIN cannot be same as current PIN';

  @override
  String get pinUpdated => 'PIN updated successfully';

  @override
  String get changePin => 'Change PIN';

  @override
  String get changePinSubtitle => 'Update your 4-digit login PIN securely.';

  @override
  String get currentPin => 'Current PIN';

  @override
  String get newPin => 'New PIN';

  @override
  String get contactSupportToResetPin =>
      'Please contact support at 9108735100 to reset your PIN';

  @override
  String get forgotCurrentPin => 'Forgot current PIN?';

  @override
  String get confirmNewPin => 'Confirm New PIN';

  @override
  String get pinHint => 'PIN must be 4 digits. Do not share.';

  @override
  String get updatePinCaps => 'UPDATE PIN';

  @override
  String get chooseLanguageSubtitle =>
      'Choose your preferred language for the app.';

  @override
  String get currentLanguage => 'Current Language';

  @override
  String get supportedLanguages => 'Supported: English, ಕನ್ನಡ, हिन्दी, தமிழ்';

  @override
  String get selected => '✓ Selected';

  @override
  String get searchLanguage => 'Search language...';

  @override
  String get availableLanguages => 'Available Languages';

  @override
  String get menuItemsUnchanged => 'Menu items will remain the same.';

  @override
  String get saveLanguageCaps => 'SAVE LANGUAGE';

  @override
  String get paymentsHistory => 'Payments History';

  @override
  String get trackPayments => 'Track Payments';

  @override
  String get menuManagement => 'Menu Management';

  @override
  String get staffManagement => 'Staff Management';

  @override
  String get editStaffDetails => 'Edit Staff Details';

  @override
  String get viewOrderDetails => 'View Order Details';

  @override
  String get cartDetails => 'Cart Details';

  @override
  String get cartClosedNote => 'Customers can\'t order right now';

  @override
  String get cartIdCopied => 'Cart ID copied';

  @override
  String get cartIdCaps => 'CART ID';

  @override
  String get viewQrCaps => 'VIEW QR';

  @override
  String get securityAndLogin => 'Security & Login';

  @override
  String get logOutCaps => 'LOG OUT';

  @override
  String get qrCodePoster => 'QR Code Poster';

  @override
  String get qrPrintTip => 'Tip: Print in A4 size and laminate for durability.';

  @override
  String get shareQrCaps => 'SHARE QR';

  @override
  String get noCartSelected => 'No cart selected';

  @override
  String get staffAdded => 'Staff added successfully';

  @override
  String get staffAddedNoSms => 'Staff added, but couldn\'t open SMS app.';

  @override
  String staffMovedTo(String cart) {
    return 'Staff moved to $cart';
  }

  @override
  String get yourStaff => 'Your Staff';

  @override
  String get searchStaff => 'Search by name or number';

  @override
  String get noStaffYet => 'No staff added yet';

  @override
  String noStaffMatch(String query) {
    return 'No staff match \"$query\"';
  }

  @override
  String get staffSubtitle => 'Add helpers who can log in and run your cart.';

  @override
  String get nameRequired => 'Name is required';

  @override
  String get enterValidName => 'Enter a valid name';

  @override
  String get phoneRequired => 'Phone number is required';

  @override
  String get enterValid10DigitNumber => 'Enter a valid 10-digit number';

  @override
  String get addHelper => 'Add Helper';

  @override
  String get staffName => 'Staff Name';

  @override
  String get enterHelperName => 'Enter helper\'s name';

  @override
  String get staffMobileNumber => 'Staff Mobile Number';

  @override
  String get sendDetailsCaps => 'SEND DETAILS';

  @override
  String get removeStaffQuestion => 'Remove Staff?';

  @override
  String moveStaffToCart(String name) {
    return 'Move $name to a different cart';
  }

  @override
  String get noCartsAvailable => 'No carts available';

  @override
  String get confirmSwitchCaps => 'CONFIRM SWITCH';

  @override
  String get findingBestBites => 'Finding the best bites...';

  @override
  String get retry => 'Retry';

  @override
  String get welcome => 'Welcome';

  @override
  String get skip => 'Skip';

  @override
  String get undo => 'Undo';

  @override
  String get serve => 'Serve';

  @override
  String get due => 'Due';

  @override
  String get notAvailable => 'N/A';

  @override
  String get continueLabel => 'Continue';

  @override
  String get current => 'Current';

  @override
  String get qrPosterSubtitle => 'Print and paste this on your cart.';

  @override
  String get couldntLoadMenu => 'Couldn\'t load the menu.';

  @override
  String get couldntLoadOrders => 'Couldn\'t load orders.';

  @override
  String get couldntLoadStaff => 'Couldn\'t load staff.';

  @override
  String get couldntLoadCarts => 'Couldn\'t load your carts.';

  @override
  String get couldntLoadPayments => 'Couldn\'t load payments.';

  @override
  String get couldntLoadSales => 'Couldn\'t load sales.';

  @override
  String staffWillLoseAccess(String name) {
    return '$name will lose access to this cart. This can\'t be undone.';
  }

  @override
  String ordersTimesFee(int count, String fee) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return '$_temp0 × ₹$fee';
  }

  @override
  String walletSelected(String wallet) {
    return '$wallet selected.';
  }

  @override
  String get externalWallet => 'External wallet';

  @override
  String feeLocksAt(String time) {
    return 'Pay before $time to keep taking orders';
  }

  @override
  String feeDueBanner(String time, String amount) {
    return 'Your cart locks at $time. Pay ₹$amount now to keep taking orders.';
  }

  @override
  String get payNowCaps => 'PAY NOW';

  @override
  String get payEarlySubtitle =>
      'Pay now to keep taking orders after the lock time.';

  @override
  String get askOwnerToPay =>
      'Ask the cart owner to pay the platform fee to unlock the cart.';

  @override
  String get sessionExpired => 'Your login has expired. Please log in again.';

  @override
  String get wrongIdOrPin =>
      'Wrong Vendor ID or PIN. Please check and try again.';

  @override
  String get checkInternet => 'Check your internet connection';

  @override
  String get requestTimedOut => 'Request timed out. Try again';

  @override
  String get somethingWentWrong => 'Something went wrong. Please try again.';

  @override
  String newOrderAlert(String number) {
    return 'New order #$number';
  }

  @override
  String get justNow => 'Just now';

  @override
  String minutesAgo(int count) {
    return '$count min ago';
  }

  @override
  String get liveStatus => 'Live';

  @override
  String get reconnecting => 'Reconnecting…';

  @override
  String get feePaidTitle => 'Payment done!';

  @override
  String get toCollect => 'To collect';

  @override
  String get toServe => 'To serve';

  @override
  String get handover => 'Handover';

  @override
  String get handoverTitle => 'Today\'s handover';

  @override
  String get handoverSubtitle =>
      'The money to hand over at the end of your shift.';

  @override
  String get collected => 'Collected';

  @override
  String get refunded => 'Refunded';

  @override
  String get preparing => 'Preparing';

  @override
  String get startPreparing => 'Start preparing';

  @override
  String get termsAndConditions => 'Terms and conditions';

  @override
  String get termsAndPrivacySubtitle =>
      'Our terms, and how GullyEats uses your data';

  @override
  String get darkTheme => 'Dark theme';

  @override
  String get darkThemeSubtitle => 'Easier on the eyes at night';

  @override
  String get comparedDayBefore => 'Compared with the day before';

  @override
  String comparedDaysBefore(int days) {
    return 'Compared with the $days days before';
  }

  @override
  String get revenueLabel => 'Revenue';

  @override
  String get paidOrdersLabel => 'Paid orders';

  @override
  String get noSalesBefore => 'None before';

  @override
  String get dailySales => 'Daily sales';

  @override
  String bestDay(String day) {
    return 'Best: $day';
  }

  @override
  String get missedMoney => 'Missed money';

  @override
  String missedUnpaid(int count, String amount) {
    return '$count unpaid · $amount';
  }

  @override
  String missedCancelled(int count, String amount) {
    return '$count cancelled · $amount';
  }

  @override
  String get missedHint =>
      'Unpaid orders are customers who ordered on the QR but never paid.';

  @override
  String get customersAndService => 'Customers & service';

  @override
  String get customersLabel => 'Customers';

  @override
  String returningCount(int count) {
    return '$count came back';
  }

  @override
  String ratingCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ratings',
      one: '1 rating',
    );
    return '$_temp0';
  }

  @override
  String get noRatingsYet => 'No ratings yet';

  @override
  String get avgWait => 'Avg wait after paying';

  @override
  String get customersHint =>
      'Only paying customers who gave a phone number are counted.';

  @override
  String get notSold => 'Didn\'t sell';

  @override
  String get notSoldHint => 'On your menu, but no paid orders in this period.';

  @override
  String andMore(int count) {
    return '+$count more';
  }

  @override
  String get atAGlance => 'At a glance';

  @override
  String get itemsSoldLabel => 'Items sold';

  @override
  String get itemsPerOrder => 'Items per order';

  @override
  String get overallRating => 'Overall rating';

  @override
  String get recentFeedback => 'Latest feedback';

  @override
  String bestWeekday(String day) {
    return 'Your best day is usually $day';
  }

  @override
  String get samplePhoto => 'Sample photo';

  @override
  String get areaAlertReport => 'Alert nearby carts';

  @override
  String get areaAlertTileNote =>
      'Warn carts within 1 km and see alerts near you';

  @override
  String get areaAlertSheetTitle => 'What\'s happening near your cart?';

  @override
  String get areaAlertSheetNote =>
      'Every GullyEats cart within 1 km gets a notification. Your cart\'s name is not shown.';

  @override
  String get areaReasonEviction => 'Eviction drive';

  @override
  String get areaReasonRoadBlocked => 'Road blocked';

  @override
  String get areaReasonRain => 'Heavy rain';

  @override
  String get areaReasonCrowd => 'Big crowd or event';

  @override
  String get areaAlertSend => 'Send alert';

  @override
  String get areaAlertSent => 'Alert sent to nearby carts';

  @override
  String get areaAlertCooldown =>
      'You already sent an alert in the last 30 minutes';

  @override
  String areaAlertNearby(String reason, int distance) {
    return '$reason reported about $distance m away';
  }

  @override
  String areaAlertMine(String reason) {
    return 'You reported: $reason';
  }

  @override
  String get areaAlertSeeItToo => 'I SEE IT TOO';

  @override
  String areaAlertMore(int count) {
    return '+$count more';
  }

  @override
  String get areaAlertsTitle => 'Alerts near your cart';

  @override
  String get areaAlertHide => 'Hide';

  @override
  String areaAlertVendors(int count) {
    return '$count vendors';
  }

  @override
  String get weatherMsgClear => 'Beautiful day! Have a great one at the stall.';

  @override
  String get weatherMsgCloudy => 'Cloudy and comfortable. A good day to sell!';

  @override
  String get weatherMsgHot =>
      'It\'s hot! Keep drinking water and stay in the shade.';

  @override
  String get weatherMsgRainDay =>
      'A little rain about. Keep your stall covered.';

  @override
  String get weatherMsgEvening =>
      'I\'m here for the evening shift. Let\'s make it a good one!';

  @override
  String get weatherMsgCool => 'Cool evening. Stay warm!';

  @override
  String get weatherMsgRainNight =>
      'Rainy evening. Keep your stall and stove covered.';

  @override
  String get weatherMsgHeavy =>
      'Heavy rain. Cover your stall and protect your equipment.';

  @override
  String get weatherMsgSleeping =>
      'Shop\'s closed. Good night, see you tomorrow!';

  @override
  String weatherHeavySoon(String time) {
    return 'Heavy rain likely around $time. Cover your stall in time.';
  }

  @override
  String get weatherCondClear => 'Clear';

  @override
  String get weatherCondCloudy => 'Cloudy';

  @override
  String get weatherCondFog => 'Hazy';

  @override
  String get weatherCondDrizzle => 'Drizzle';

  @override
  String get weatherCondRain => 'Rain';

  @override
  String get weatherCondHeavyRain => 'Heavy rain';

  @override
  String get weatherCondStorm => 'Thunderstorm';

  @override
  String weatherFeelsLike(int temp) {
    return 'Feels like $temp°';
  }

  @override
  String get weatherRain => 'Next hour';

  @override
  String get weatherNoRain => 'No rain';

  @override
  String get weatherHumidity => 'Humidity';

  @override
  String get weatherWind => 'Wind';

  @override
  String get weatherNextHours => 'Next hours';

  @override
  String weatherUpdated(String ago) {
    return 'Updated $ago';
  }

  @override
  String get weatherNow => 'Now';

  @override
  String weatherSunrise(String time) {
    return 'Sunrise $time';
  }

  @override
  String weatherSunset(String time) {
    return 'Sunset $time';
  }

  @override
  String get weatherForecastNote =>
      'Forecast from MET Norway, not an official weather warning.';

  @override
  String get eveningTitle => 'Today so far';

  @override
  String get eveningFeeNote => 'Today\'s fee goes on your bill after midnight.';

  @override
  String eveningBillDue(String amount) {
    return 'Bill due: ₹$amount';
  }

  @override
  String get eveningNoBill => 'No bill due';
}
