import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_kn.dart';
import 'app_localizations_ta.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi'),
    Locale('kn'),
    Locale('ta'),
  ];

  /// No description provided for @sales.
  ///
  /// In en, this message translates to:
  /// **'Sales'**
  String get sales;

  /// No description provided for @orders.
  ///
  /// In en, this message translates to:
  /// **'Orders'**
  String get orders;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @change.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get change;

  /// No description provided for @open.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get open;

  /// No description provided for @closed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get closed;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @remove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get remove;

  /// No description provided for @subtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

  /// No description provided for @platformFee.
  ///
  /// In en, this message translates to:
  /// **'Platform Fee'**
  String get platformFee;

  /// No description provided for @parcel.
  ///
  /// In en, this message translates to:
  /// **'Parcel'**
  String get parcel;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @paid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get paid;

  /// No description provided for @served.
  ///
  /// In en, this message translates to:
  /// **'Served'**
  String get served;

  /// No description provided for @unpaid.
  ///
  /// In en, this message translates to:
  /// **'Unpaid'**
  String get unpaid;

  /// No description provided for @cancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get cancelled;

  /// No description provided for @pending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get pending;

  /// No description provided for @veg.
  ///
  /// In en, this message translates to:
  /// **'Veg'**
  String get veg;

  /// No description provided for @nonVeg.
  ///
  /// In en, this message translates to:
  /// **'Non-Veg'**
  String get nonVeg;

  /// No description provided for @inStock.
  ///
  /// In en, this message translates to:
  /// **'In Stock'**
  String get inStock;

  /// No description provided for @outOfStock.
  ///
  /// In en, this message translates to:
  /// **'Out of Stock'**
  String get outOfStock;

  /// No description provided for @inStockCaps.
  ///
  /// In en, this message translates to:
  /// **'IN STOCK'**
  String get inStockCaps;

  /// No description provided for @outOfStockCaps.
  ///
  /// In en, this message translates to:
  /// **'OUT OF STOCK'**
  String get outOfStockCaps;

  /// No description provided for @stockIn.
  ///
  /// In en, this message translates to:
  /// **'In'**
  String get stockIn;

  /// No description provided for @stockOut.
  ///
  /// In en, this message translates to:
  /// **'Out'**
  String get stockOut;

  /// No description provided for @qrOrder.
  ///
  /// In en, this message translates to:
  /// **'QR Order'**
  String get qrOrder;

  /// No description provided for @manual.
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get manual;

  /// No description provided for @all.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get all;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @qrOrders.
  ///
  /// In en, this message translates to:
  /// **'QR Orders'**
  String get qrOrders;

  /// No description provided for @stock.
  ///
  /// In en, this message translates to:
  /// **'Stock'**
  String get stock;

  /// No description provided for @allItems.
  ///
  /// In en, this message translates to:
  /// **'All Items'**
  String get allItems;

  /// No description provided for @noItems.
  ///
  /// In en, this message translates to:
  /// **'No items'**
  String get noItems;

  /// No description provided for @searchItems.
  ///
  /// In en, this message translates to:
  /// **'Search items...'**
  String get searchItems;

  /// No description provided for @dateRange.
  ///
  /// In en, this message translates to:
  /// **'Date Range'**
  String get dateRange;

  /// No description provided for @noOrdersInPeriod.
  ///
  /// In en, this message translates to:
  /// **'No orders in this period yet'**
  String get noOrdersInPeriod;

  /// No description provided for @cameraPermissionRequired.
  ///
  /// In en, this message translates to:
  /// **'Camera permission is required.'**
  String get cameraPermissionRequired;

  /// No description provided for @cameraPermission.
  ///
  /// In en, this message translates to:
  /// **'Camera Permission'**
  String get cameraPermission;

  /// No description provided for @cameraAccessDenied.
  ///
  /// In en, this message translates to:
  /// **'Camera access was denied. Please enable it from app settings.'**
  String get cameraAccessDenied;

  /// No description provided for @openSettings.
  ///
  /// In en, this message translates to:
  /// **'Open Settings'**
  String get openSettings;

  /// No description provided for @choosePhoto.
  ///
  /// In en, this message translates to:
  /// **'Choose Photo'**
  String get choosePhoto;

  /// No description provided for @takePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get takePhoto;

  /// No description provided for @chooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from Gallery'**
  String get chooseFromGallery;

  /// No description provided for @failedToUploadPhoto.
  ///
  /// In en, this message translates to:
  /// **'Failed to upload photo'**
  String get failedToUploadPhoto;

  /// No description provided for @photoUploaded.
  ///
  /// In en, this message translates to:
  /// **'Photo uploaded successfully'**
  String get photoUploaded;

  /// No description provided for @cameraOrGallery.
  ///
  /// In en, this message translates to:
  /// **'Camera or gallery'**
  String get cameraOrGallery;

  /// No description provided for @addItem.
  ///
  /// In en, this message translates to:
  /// **'Add Item'**
  String get addItem;

  /// No description provided for @saveChangesCaps.
  ///
  /// In en, this message translates to:
  /// **'SAVE CHANGES'**
  String get saveChangesCaps;

  /// No description provided for @switchCart.
  ///
  /// In en, this message translates to:
  /// **'Switch Cart'**
  String get switchCart;

  /// No description provided for @switchCartCaps.
  ///
  /// In en, this message translates to:
  /// **'SWITCH CART'**
  String get switchCartCaps;

  /// No description provided for @vendor.
  ///
  /// In en, this message translates to:
  /// **'Vendor'**
  String get vendor;

  /// No description provided for @ordersOverview.
  ///
  /// In en, this message translates to:
  /// **'Orders Overview'**
  String get ordersOverview;

  /// No description provided for @languagePreferences.
  ///
  /// In en, this message translates to:
  /// **'Language Preferences'**
  String get languagePreferences;

  /// No description provided for @busyHours.
  ///
  /// In en, this message translates to:
  /// **'Busy Hours'**
  String get busyHours;

  /// No description provided for @unableToCheckPaymentStatus.
  ///
  /// In en, this message translates to:
  /// **'Unable to check payment status. Please try again.'**
  String get unableToCheckPaymentStatus;

  /// No description provided for @verificationPending.
  ///
  /// In en, this message translates to:
  /// **'Verification Pending'**
  String get verificationPending;

  /// No description provided for @vendorIdRequired.
  ///
  /// In en, this message translates to:
  /// **'Vendor ID or Mobile Number is required'**
  String get vendorIdRequired;

  /// No description provided for @enter4DigitPin.
  ///
  /// In en, this message translates to:
  /// **'Please enter a 4-digit PIN'**
  String get enter4DigitPin;

  /// No description provided for @loginSuccessful.
  ///
  /// In en, this message translates to:
  /// **'Login successful'**
  String get loginSuccessful;

  /// No description provided for @loginFailed.
  ///
  /// In en, this message translates to:
  /// **'Login failed. Please check your credentials.'**
  String get loginFailed;

  /// No description provided for @welcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome Back'**
  String get welcomeBack;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Login to manage your cart and start\nreceiving orders.'**
  String get loginSubtitle;

  /// No description provided for @support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get support;

  /// No description provided for @callSupport.
  ///
  /// In en, this message translates to:
  /// **'Please call this number for support:\n9008533182'**
  String get callSupport;

  /// No description provided for @phoneOrVendorId.
  ///
  /// In en, this message translates to:
  /// **'Phone Number or Vendor ID'**
  String get phoneOrVendorId;

  /// No description provided for @loginHint.
  ///
  /// In en, this message translates to:
  /// **'XXXXXXXXXX or VEN-XXXXXX'**
  String get loginHint;

  /// No description provided for @fourDigitPin.
  ///
  /// In en, this message translates to:
  /// **'4-digit PIN'**
  String get fourDigitPin;

  /// No description provided for @forgotPin.
  ///
  /// In en, this message translates to:
  /// **'Forgot PIN?'**
  String get forgotPin;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// No description provided for @newVendor.
  ///
  /// In en, this message translates to:
  /// **'New vendor? '**
  String get newVendor;

  /// No description provided for @contactSupport.
  ///
  /// In en, this message translates to:
  /// **'Contact Support'**
  String get contactSupport;

  /// No description provided for @cartNameEmpty.
  ///
  /// In en, this message translates to:
  /// **'Cart name can\'t be empty.'**
  String get cartNameEmpty;

  /// No description provided for @cityEmpty.
  ///
  /// In en, this message translates to:
  /// **'City can\'t be empty.'**
  String get cityEmpty;

  /// No description provided for @cartDetailsUpdated.
  ///
  /// In en, this message translates to:
  /// **'Cart details updated!'**
  String get cartDetailsUpdated;

  /// No description provided for @discardChanges.
  ///
  /// In en, this message translates to:
  /// **'Discard changes?'**
  String get discardChanges;

  /// No description provided for @unsavedChanges.
  ///
  /// In en, this message translates to:
  /// **'You have unsaved changes. Leave without saving?'**
  String get unsavedChanges;

  /// No description provided for @keepEditing.
  ///
  /// In en, this message translates to:
  /// **'Keep Editing'**
  String get keepEditing;

  /// No description provided for @discard.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discard;

  /// No description provided for @editCartDetails.
  ///
  /// In en, this message translates to:
  /// **'Edit Cart Details'**
  String get editCartDetails;

  /// No description provided for @selectCity.
  ///
  /// In en, this message translates to:
  /// **'Select City'**
  String get selectCity;

  /// No description provided for @cartPhoto.
  ///
  /// In en, this message translates to:
  /// **'Cart Photo'**
  String get cartPhoto;

  /// No description provided for @cartPhotoHelp.
  ///
  /// In en, this message translates to:
  /// **'Used for verification — no gallery uploads allowed.'**
  String get cartPhotoHelp;

  /// No description provided for @cartInformation.
  ///
  /// In en, this message translates to:
  /// **'Cart Information'**
  String get cartInformation;

  /// No description provided for @cartName.
  ///
  /// In en, this message translates to:
  /// **'Cart Name'**
  String get cartName;

  /// No description provided for @cartCity.
  ///
  /// In en, this message translates to:
  /// **'Cart City'**
  String get cartCity;

  /// No description provided for @address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get address;

  /// No description provided for @cartId.
  ///
  /// In en, this message translates to:
  /// **'Cart ID'**
  String get cartId;

  /// No description provided for @location.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get location;

  /// No description provided for @addressAutoUpdates.
  ///
  /// In en, this message translates to:
  /// **'Address above updates automatically when you refresh GPS.'**
  String get addressAutoUpdates;

  /// No description provided for @cartStatus.
  ///
  /// In en, this message translates to:
  /// **'Cart Status'**
  String get cartStatus;

  /// No description provided for @cartActive.
  ///
  /// In en, this message translates to:
  /// **'Cart Active'**
  String get cartActive;

  /// No description provided for @visibleToCustomers.
  ///
  /// In en, this message translates to:
  /// **'Visible to customers'**
  String get visibleToCustomers;

  /// No description provided for @cartOpen.
  ///
  /// In en, this message translates to:
  /// **'Cart Open'**
  String get cartOpen;

  /// No description provided for @acceptingOrders.
  ///
  /// In en, this message translates to:
  /// **'Accepting orders'**
  String get acceptingOrders;

  /// No description provided for @salesDashboard.
  ///
  /// In en, this message translates to:
  /// **'Sales Dashboard'**
  String get salesDashboard;

  /// No description provided for @salesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Track your earnings and progress'**
  String get salesSubtitle;

  /// No description provided for @totalRevenue.
  ///
  /// In en, this message translates to:
  /// **'Total Revenue'**
  String get totalRevenue;

  /// No description provided for @net.
  ///
  /// In en, this message translates to:
  /// **'Net'**
  String get net;

  /// No description provided for @avgOrder.
  ///
  /// In en, this message translates to:
  /// **'Avg Order'**
  String get avgOrder;

  /// No description provided for @highest.
  ///
  /// In en, this message translates to:
  /// **'Highest'**
  String get highest;

  /// No description provided for @lowest.
  ///
  /// In en, this message translates to:
  /// **'Lowest'**
  String get lowest;

  /// No description provided for @completionRate.
  ///
  /// In en, this message translates to:
  /// **'Completion Rate'**
  String get completionRate;

  /// No description provided for @paymentRate.
  ///
  /// In en, this message translates to:
  /// **'Payment Rate'**
  String get paymentRate;

  /// No description provided for @cancellationRate.
  ///
  /// In en, this message translates to:
  /// **'Cancellation Rate'**
  String get cancellationRate;

  /// No description provided for @itemsSold.
  ///
  /// In en, this message translates to:
  /// **'Items Sold'**
  String get itemsSold;

  /// No description provided for @totalSold.
  ///
  /// In en, this message translates to:
  /// **'Total Sold'**
  String get totalSold;

  /// No description provided for @unique.
  ///
  /// In en, this message translates to:
  /// **'Unique'**
  String get unique;

  /// No description provided for @avgPerOrder.
  ///
  /// In en, this message translates to:
  /// **'Avg / Order'**
  String get avgPerOrder;

  /// No description provided for @maxInOneOrder.
  ///
  /// In en, this message translates to:
  /// **'Max in 1 Order'**
  String get maxInOneOrder;

  /// No description provided for @orderType.
  ///
  /// In en, this message translates to:
  /// **'Order Type'**
  String get orderType;

  /// No description provided for @parcelOrders.
  ///
  /// In en, this message translates to:
  /// **'Parcel Orders'**
  String get parcelOrders;

  /// No description provided for @avgParcelCharge.
  ///
  /// In en, this message translates to:
  /// **'Avg Parcel Charge'**
  String get avgParcelCharge;

  /// No description provided for @timing.
  ///
  /// In en, this message translates to:
  /// **'Timing'**
  String get timing;

  /// No description provided for @avgPrepTime.
  ///
  /// In en, this message translates to:
  /// **'Avg Prep Time'**
  String get avgPrepTime;

  /// No description provided for @fastestOrder.
  ///
  /// In en, this message translates to:
  /// **'Fastest Order'**
  String get fastestOrder;

  /// No description provided for @slowestOrder.
  ///
  /// In en, this message translates to:
  /// **'Slowest Order'**
  String get slowestOrder;

  /// No description provided for @avgPaymentTime.
  ///
  /// In en, this message translates to:
  /// **'Avg Payment Time'**
  String get avgPaymentTime;

  /// No description provided for @avgServeAfterPayment.
  ///
  /// In en, this message translates to:
  /// **'Avg Serve After Payment'**
  String get avgServeAfterPayment;

  /// No description provided for @avgTimeBetweenOrders.
  ///
  /// In en, this message translates to:
  /// **'Avg Time Between Orders'**
  String get avgTimeBetweenOrders;

  /// No description provided for @itemLeaderboard.
  ///
  /// In en, this message translates to:
  /// **'Item Leaderboard'**
  String get itemLeaderboard;

  /// No description provided for @topRevenue.
  ///
  /// In en, this message translates to:
  /// **'Top Revenue'**
  String get topRevenue;

  /// No description provided for @topVolume.
  ///
  /// In en, this message translates to:
  /// **'Top Volume'**
  String get topVolume;

  /// No description provided for @topSellers.
  ///
  /// In en, this message translates to:
  /// **'Top Sellers'**
  String get topSellers;

  /// No description provided for @needsAPush.
  ///
  /// In en, this message translates to:
  /// **'Needs a Push'**
  String get needsAPush;

  /// No description provided for @qrOrdersSummary.
  ///
  /// In en, this message translates to:
  /// **'QR · {count} orders · {amount}'**
  String qrOrdersSummary(int count, String amount);

  /// No description provided for @manualOrdersSummary.
  ///
  /// In en, this message translates to:
  /// **'Manual · {count} orders · {amount}'**
  String manualOrdersSummary(int count, String amount);

  /// No description provided for @peakHour.
  ///
  /// In en, this message translates to:
  /// **'Peak: {hour}'**
  String peakHour(String hour);

  /// No description provided for @soldCount.
  ///
  /// In en, this message translates to:
  /// **'{count} sold'**
  String soldCount(int count);

  /// No description provided for @totalCount.
  ///
  /// In en, this message translates to:
  /// **'{count} total'**
  String totalCount(int count);

  /// No description provided for @rangeLabel.
  ///
  /// In en, this message translates to:
  /// **'{range, select, today{Today} yesterday{Yesterday} last7{Last 7 Days} week{Week} other{Last 30 Days}}'**
  String rangeLabel(String range);

  /// No description provided for @stockControl.
  ///
  /// In en, this message translates to:
  /// **'Stock Control'**
  String get stockControl;

  /// No description provided for @chooseCartToSwitch.
  ///
  /// In en, this message translates to:
  /// **'Choose which cart to switch'**
  String get chooseCartToSwitch;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @searchCarts.
  ///
  /// In en, this message translates to:
  /// **'Search carts...'**
  String get searchCarts;

  /// No description provided for @noCartsAssigned.
  ///
  /// In en, this message translates to:
  /// **'No carts assigned. Contact your vendor.'**
  String get noCartsAssigned;

  /// No description provided for @checkingPaymentStatus.
  ///
  /// In en, this message translates to:
  /// **'Checking your payment status'**
  String get checkingPaymentStatus;

  /// No description provided for @pleaseWait.
  ///
  /// In en, this message translates to:
  /// **'Please wait a moment...'**
  String get pleaseWait;

  /// No description provided for @changePhoto.
  ///
  /// In en, this message translates to:
  /// **'Change Photo'**
  String get changePhoto;

  /// No description provided for @addPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add Photo'**
  String get addPhoto;

  /// No description provided for @tapToAddCartPhoto.
  ///
  /// In en, this message translates to:
  /// **'Tap to add cart photo'**
  String get tapToAddCartPhoto;

  /// No description provided for @locationServicesDisabled.
  ///
  /// In en, this message translates to:
  /// **'Location services are disabled. Please enable them.'**
  String get locationServicesDisabled;

  /// No description provided for @locationPermissionRequired.
  ///
  /// In en, this message translates to:
  /// **'Location permission is required.'**
  String get locationPermissionRequired;

  /// No description provided for @permissionPermanentlyDenied.
  ///
  /// In en, this message translates to:
  /// **'Permission permanently denied. Please enable from settings.'**
  String get permissionPermanentlyDenied;

  /// No description provided for @unableToFetchLocation.
  ///
  /// In en, this message translates to:
  /// **'Unable to fetch location. Please try again.'**
  String get unableToFetchLocation;

  /// No description provided for @mapUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Map unavailable — tap to retry'**
  String get mapUnavailable;

  /// No description provided for @locating.
  ///
  /// In en, this message translates to:
  /// **'Locating...'**
  String get locating;

  /// No description provided for @updateGpsLocation.
  ///
  /// In en, this message translates to:
  /// **'Update GPS Location'**
  String get updateGpsLocation;

  /// No description provided for @itemNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Item name is required'**
  String get itemNameRequired;

  /// No description provided for @itemNameTooShort.
  ///
  /// In en, this message translates to:
  /// **'Item name must be at least 2 characters'**
  String get itemNameTooShort;

  /// No description provided for @priceRequired.
  ///
  /// In en, this message translates to:
  /// **'Price is required'**
  String get priceRequired;

  /// No description provided for @itemAdded.
  ///
  /// In en, this message translates to:
  /// **'Added Item Successfully'**
  String get itemAdded;

  /// No description provided for @addNewItem.
  ///
  /// In en, this message translates to:
  /// **'Add New Item'**
  String get addNewItem;

  /// No description provided for @itemName.
  ///
  /// In en, this message translates to:
  /// **'Item Name'**
  String get itemName;

  /// No description provided for @price.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get price;

  /// No description provided for @enterPriceInRupees.
  ///
  /// In en, this message translates to:
  /// **'Enter price in rupees.'**
  String get enterPriceInRupees;

  /// No description provided for @category.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get category;

  /// No description provided for @availability.
  ///
  /// In en, this message translates to:
  /// **'Availability'**
  String get availability;

  /// No description provided for @itemPhoto.
  ///
  /// In en, this message translates to:
  /// **'Item Photo (optional)'**
  String get itemPhoto;

  /// No description provided for @itemNameAndPriceRequired.
  ///
  /// In en, this message translates to:
  /// **'Item name and price are required.'**
  String get itemNameAndPriceRequired;

  /// No description provided for @takeItemPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take Item Photo'**
  String get takeItemPhoto;

  /// No description provided for @uploadPhoto.
  ///
  /// In en, this message translates to:
  /// **'Upload Photo'**
  String get uploadPhoto;

  /// No description provided for @orderCreatedPaid.
  ///
  /// In en, this message translates to:
  /// **'Order created and marked as paid.'**
  String get orderCreatedPaid;

  /// No description provided for @orderCreated.
  ///
  /// In en, this message translates to:
  /// **'Order created successfully.'**
  String get orderCreated;

  /// No description provided for @orderDeleted.
  ///
  /// In en, this message translates to:
  /// **'Order deleted'**
  String get orderDeleted;

  /// No description provided for @orderUpdated.
  ///
  /// In en, this message translates to:
  /// **'Order updated successfully'**
  String get orderUpdated;

  /// No description provided for @menuItems.
  ///
  /// In en, this message translates to:
  /// **'Menu Items'**
  String get menuItems;

  /// No description provided for @updateOrder.
  ///
  /// In en, this message translates to:
  /// **'Update Order'**
  String get updateOrder;

  /// No description provided for @createOrder.
  ///
  /// In en, this message translates to:
  /// **'Create Order'**
  String get createOrder;

  /// No description provided for @parcelCharges.
  ///
  /// In en, this message translates to:
  /// **'Parcel Charges'**
  String get parcelCharges;

  /// No description provided for @previousTotal.
  ///
  /// In en, this message translates to:
  /// **'Previous Total'**
  String get previousTotal;

  /// No description provided for @newTotalCaps.
  ///
  /// In en, this message translates to:
  /// **'NEW TOTAL'**
  String get newTotalCaps;

  /// No description provided for @markAsPaidCaps.
  ///
  /// In en, this message translates to:
  /// **'MARK AS PAID'**
  String get markAsPaidCaps;

  /// No description provided for @deleteOrderCaps.
  ///
  /// In en, this message translates to:
  /// **'DELETE ORDER'**
  String get deleteOrderCaps;

  /// No description provided for @updateOrderCaps.
  ///
  /// In en, this message translates to:
  /// **'UPDATE ORDER'**
  String get updateOrderCaps;

  /// No description provided for @customerNeedsToPay.
  ///
  /// In en, this message translates to:
  /// **'Customer needs to pay ₹{amount} more'**
  String customerNeedsToPay(String amount);

  /// No description provided for @giveBackToCustomer.
  ///
  /// In en, this message translates to:
  /// **'Give ₹{amount} back to customer'**
  String giveBackToCustomer(String amount);

  /// No description provided for @searchMenuItems.
  ///
  /// In en, this message translates to:
  /// **'Search menu items'**
  String get searchMenuItems;

  /// No description provided for @noMenuItemsFound.
  ///
  /// In en, this message translates to:
  /// **'No menu items found'**
  String get noMenuItemsFound;

  /// No description provided for @editMenuItems.
  ///
  /// In en, this message translates to:
  /// **'Edit Menu Items'**
  String get editMenuItems;

  /// No description provided for @editMenuSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add, remove or update your cart menu.'**
  String get editMenuSubtitle;

  /// No description provided for @deleteItemQuestion.
  ///
  /// In en, this message translates to:
  /// **'Delete Item?'**
  String get deleteItemQuestion;

  /// No description provided for @confirmRemoveItem.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to remove this item?'**
  String get confirmRemoveItem;

  /// No description provided for @itemDeleted.
  ///
  /// In en, this message translates to:
  /// **'Item deleted successfully!'**
  String get itemDeleted;

  /// No description provided for @ordersStatus.
  ///
  /// In en, this message translates to:
  /// **'Orders Status'**
  String get ordersStatus;

  /// No description provided for @orderMarkedServed.
  ///
  /// In en, this message translates to:
  /// **'Order marked as served'**
  String get orderMarkedServed;

  /// No description provided for @serveReverted.
  ///
  /// In en, this message translates to:
  /// **'Serve reverted'**
  String get serveReverted;

  /// No description provided for @orderMarkedPaid.
  ///
  /// In en, this message translates to:
  /// **'Order marked as paid'**
  String get orderMarkedPaid;

  /// No description provided for @paymentReverted.
  ///
  /// In en, this message translates to:
  /// **'Payment reverted'**
  String get paymentReverted;

  /// No description provided for @orderCancelled.
  ///
  /// In en, this message translates to:
  /// **'Order cancelled'**
  String get orderCancelled;

  /// No description provided for @orderRestored.
  ///
  /// In en, this message translates to:
  /// **'Order restored'**
  String get orderRestored;

  /// No description provided for @noActiveOrders.
  ///
  /// In en, this message translates to:
  /// **'No active orders'**
  String get noActiveOrders;

  /// No description provided for @noQrOrdersToday.
  ///
  /// In en, this message translates to:
  /// **'No QR orders today'**
  String get noQrOrdersToday;

  /// No description provided for @noManualOrdersToday.
  ///
  /// In en, this message translates to:
  /// **'No manual orders today'**
  String get noManualOrdersToday;

  /// No description provided for @noOrdersToday.
  ///
  /// In en, this message translates to:
  /// **'No orders today'**
  String get noOrdersToday;

  /// No description provided for @ordersTitle.
  ///
  /// In en, this message translates to:
  /// **'{tab, select, active{Active Orders} qr{QR Orders} manual{Manual Orders} other{All Orders}} ({count})'**
  String ordersTitle(String tab, int count);

  /// No description provided for @itemNameEmpty.
  ///
  /// In en, this message translates to:
  /// **'Item name cannot be empty'**
  String get itemNameEmpty;

  /// No description provided for @enterValidPrice.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid price'**
  String get enterValidPrice;

  /// No description provided for @itemUpdated.
  ///
  /// In en, this message translates to:
  /// **'Item updated successfully!'**
  String get itemUpdated;

  /// No description provided for @editItem.
  ///
  /// In en, this message translates to:
  /// **'Edit Item'**
  String get editItem;

  /// No description provided for @itemNameCaps.
  ///
  /// In en, this message translates to:
  /// **'ITEM NAME'**
  String get itemNameCaps;

  /// No description provided for @priceRupeeCaps.
  ///
  /// In en, this message translates to:
  /// **'PRICE (₹)'**
  String get priceRupeeCaps;

  /// No description provided for @itemPhotoCaps.
  ///
  /// In en, this message translates to:
  /// **'ITEM PHOTO'**
  String get itemPhotoCaps;

  /// No description provided for @updateItemCaps.
  ///
  /// In en, this message translates to:
  /// **'UPDATE ITEM'**
  String get updateItemCaps;

  /// No description provided for @uploadNewPhotoCaps.
  ///
  /// In en, this message translates to:
  /// **'UPLOAD NEW PHOTO'**
  String get uploadNewPhotoCaps;

  /// No description provided for @addItemPhoto.
  ///
  /// In en, this message translates to:
  /// **'Add Item Photo'**
  String get addItemPhoto;

  /// No description provided for @deleteOrder.
  ///
  /// In en, this message translates to:
  /// **'Delete Order'**
  String get deleteOrder;

  /// No description provided for @confirmDeleteOrder.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete this order?'**
  String get confirmDeleteOrder;

  /// No description provided for @markPaidCaps.
  ///
  /// In en, this message translates to:
  /// **'MARK PAID'**
  String get markPaidCaps;

  /// No description provided for @collectFromCustomer.
  ///
  /// In en, this message translates to:
  /// **'Collect ₹{amount} from customer'**
  String collectFromCustomer(String amount);

  /// No description provided for @returnToCustomer.
  ///
  /// In en, this message translates to:
  /// **'Return ₹{amount} to customer'**
  String returnToCustomer(String amount);

  /// No description provided for @moreItems.
  ///
  /// In en, this message translates to:
  /// **'+{count} more'**
  String moreItems(int count);

  /// No description provided for @parcelCharge.
  ///
  /// In en, this message translates to:
  /// **'Parcel Charge'**
  String get parcelCharge;

  /// No description provided for @paidAt.
  ///
  /// In en, this message translates to:
  /// **'Paid {time}'**
  String paidAt(String time);

  /// No description provided for @servedAt.
  ///
  /// In en, this message translates to:
  /// **'Served {time}'**
  String servedAt(String time);

  /// No description provided for @cartNotFound.
  ///
  /// In en, this message translates to:
  /// **'Unable to find the selected cart.'**
  String get cartNotFound;

  /// No description provided for @unableToStartPayment.
  ///
  /// In en, this message translates to:
  /// **'Unable to start payment. Please try again.'**
  String get unableToStartPayment;

  /// No description provided for @paymentReceivedUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Payment received. Your cart is unlocked.'**
  String get paymentReceivedUnlocked;

  /// No description provided for @unableToOpenGateway.
  ///
  /// In en, this message translates to:
  /// **'Unable to open payment gateway.'**
  String get unableToOpenGateway;

  /// No description provided for @paymentRecordNotFound.
  ///
  /// In en, this message translates to:
  /// **'Payment received, but the payment record could not be found.'**
  String get paymentRecordNotFound;

  /// No description provided for @paymentResponseIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Payment response was incomplete. Please check payment status.'**
  String get paymentResponseIncomplete;

  /// No description provided for @paymentVerifiedUnlocked.
  ///
  /// In en, this message translates to:
  /// **'Payment verified successfully. Your cart is unlocked.'**
  String get paymentVerifiedUnlocked;

  /// No description provided for @paymentVerificationPending.
  ///
  /// In en, this message translates to:
  /// **'Payment was received but verification is still pending.'**
  String get paymentVerificationPending;

  /// No description provided for @paymentFailedRetry.
  ///
  /// In en, this message translates to:
  /// **'Payment failed. You can retry using the same payment.'**
  String get paymentFailedRetry;

  /// No description provided for @salesOverview.
  ///
  /// In en, this message translates to:
  /// **'Sales Overview'**
  String get salesOverview;

  /// No description provided for @trackEarningsAndFees.
  ///
  /// In en, this message translates to:
  /// **'Track earnings & platform fees'**
  String get trackEarningsAndFees;

  /// No description provided for @openingGatewayCaps.
  ///
  /// In en, this message translates to:
  /// **'OPENING PAYMENT GATEWAY...'**
  String get openingGatewayCaps;

  /// No description provided for @paymentPendingCaps.
  ///
  /// In en, this message translates to:
  /// **'PAYMENT PENDING'**
  String get paymentPendingCaps;

  /// No description provided for @payAndUnlockNow.
  ///
  /// In en, this message translates to:
  /// **'PAY ₹{amount} & UNLOCK NOW'**
  String payAndUnlockNow(String amount);

  /// No description provided for @todaySummaryCaps.
  ///
  /// In en, this message translates to:
  /// **'TODAY SUMMARY'**
  String get todaySummaryCaps;

  /// No description provided for @ordersCompleted.
  ///
  /// In en, this message translates to:
  /// **'Orders Completed'**
  String get ordersCompleted;

  /// No description provided for @paymentStatus.
  ///
  /// In en, this message translates to:
  /// **'Payment Status'**
  String get paymentStatus;

  /// No description provided for @partiallyPaidCaps.
  ///
  /// In en, this message translates to:
  /// **'PARTIALLY PAID'**
  String get partiallyPaidCaps;

  /// No description provided for @platformFeePending.
  ///
  /// In en, this message translates to:
  /// **'Platform Fee Pending'**
  String get platformFeePending;

  /// No description provided for @storeLockedPayRazorpay.
  ///
  /// In en, this message translates to:
  /// **'Your store is locked. Pay securely using Razorpay to unlock it.'**
  String get storeLockedPayRazorpay;

  /// No description provided for @securePaymentsRazorpay.
  ///
  /// In en, this message translates to:
  /// **'Secure payments · Powered by Razorpay'**
  String get securePaymentsRazorpay;

  /// No description provided for @transactionHistory.
  ///
  /// In en, this message translates to:
  /// **'Transaction History'**
  String get transactionHistory;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get tryAgain;

  /// No description provided for @noTransactionsInPeriod.
  ///
  /// In en, this message translates to:
  /// **'No transactions in this period yet'**
  String get noTransactionsInPeriod;

  /// No description provided for @transactions.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get transactions;

  /// No description provided for @currentPendingTransactionCaps.
  ///
  /// In en, this message translates to:
  /// **'CURRENT PENDING TRANSACTION'**
  String get currentPendingTransactionCaps;

  /// No description provided for @payment.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get payment;

  /// No description provided for @billingDate.
  ///
  /// In en, this message translates to:
  /// **'Billing date'**
  String get billingDate;

  /// No description provided for @paidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid on'**
  String get paidOn;

  /// No description provided for @verifiedOn.
  ///
  /// In en, this message translates to:
  /// **'Verified on'**
  String get verifiedOn;

  /// No description provided for @noOrders.
  ///
  /// In en, this message translates to:
  /// **'No orders'**
  String get noOrders;

  /// No description provided for @orderCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 order} other{{count} orders}}'**
  String orderCount(int count);

  /// No description provided for @paymentVerified.
  ///
  /// In en, this message translates to:
  /// **'Payment Verified'**
  String get paymentVerified;

  /// No description provided for @paymentRejected.
  ///
  /// In en, this message translates to:
  /// **'Payment Rejected'**
  String get paymentRejected;

  /// No description provided for @paymentExpired.
  ///
  /// In en, this message translates to:
  /// **'Payment Expired'**
  String get paymentExpired;

  /// No description provided for @transactionReference.
  ///
  /// In en, this message translates to:
  /// **'Transaction reference'**
  String get transactionReference;

  /// No description provided for @cartLockedFeePending.
  ///
  /// In en, this message translates to:
  /// **'Your cart is currently locked because the platform payment is pending.'**
  String get cartLockedFeePending;

  /// No description provided for @amountDue.
  ///
  /// In en, this message translates to:
  /// **'Amount Due'**
  String get amountDue;

  /// No description provided for @payAndUnlock.
  ///
  /// In en, this message translates to:
  /// **'PAY ₹{amount} & UNLOCK'**
  String payAndUnlock(String amount);

  /// No description provided for @paymentSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Payment Submitted'**
  String get paymentSubmitted;

  /// No description provided for @paymentSubmittedWaiting.
  ///
  /// In en, this message translates to:
  /// **'Your payment has been submitted and is waiting for verification.'**
  String get paymentSubmittedWaiting;

  /// No description provided for @amount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get amount;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @checkPaymentStatusCaps.
  ///
  /// In en, this message translates to:
  /// **'CHECK PAYMENT STATUS'**
  String get checkPaymentStatusCaps;

  /// No description provided for @totalOrders.
  ///
  /// In en, this message translates to:
  /// **'Total Orders'**
  String get totalOrders;

  /// No description provided for @currentPinRequired.
  ///
  /// In en, this message translates to:
  /// **'Current PIN is required'**
  String get currentPinRequired;

  /// No description provided for @newPinRequired.
  ///
  /// In en, this message translates to:
  /// **'New PIN is required'**
  String get newPinRequired;

  /// No description provided for @pinMust4Digits.
  ///
  /// In en, this message translates to:
  /// **'PIN must be 4 digits'**
  String get pinMust4Digits;

  /// No description provided for @confirmYourPin.
  ///
  /// In en, this message translates to:
  /// **'Confirm your PIN'**
  String get confirmYourPin;

  /// No description provided for @pinMismatch.
  ///
  /// In en, this message translates to:
  /// **'PIN does not match'**
  String get pinMismatch;

  /// No description provided for @pinSameAsCurrent.
  ///
  /// In en, this message translates to:
  /// **'New PIN cannot be same as current PIN'**
  String get pinSameAsCurrent;

  /// No description provided for @pinUpdated.
  ///
  /// In en, this message translates to:
  /// **'PIN updated successfully'**
  String get pinUpdated;

  /// No description provided for @changePin.
  ///
  /// In en, this message translates to:
  /// **'Change PIN'**
  String get changePin;

  /// No description provided for @changePinSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Update your 4-digit login PIN securely.'**
  String get changePinSubtitle;

  /// No description provided for @currentPin.
  ///
  /// In en, this message translates to:
  /// **'Current PIN'**
  String get currentPin;

  /// No description provided for @newPin.
  ///
  /// In en, this message translates to:
  /// **'New PIN'**
  String get newPin;

  /// No description provided for @contactSupportToResetPin.
  ///
  /// In en, this message translates to:
  /// **'Please contact support at 9108735100 to reset your PIN'**
  String get contactSupportToResetPin;

  /// No description provided for @forgotCurrentPin.
  ///
  /// In en, this message translates to:
  /// **'Forgot current PIN?'**
  String get forgotCurrentPin;

  /// No description provided for @confirmNewPin.
  ///
  /// In en, this message translates to:
  /// **'Confirm New PIN'**
  String get confirmNewPin;

  /// No description provided for @pinHint.
  ///
  /// In en, this message translates to:
  /// **'PIN must be 4 digits. Do not share.'**
  String get pinHint;

  /// No description provided for @updatePinCaps.
  ///
  /// In en, this message translates to:
  /// **'UPDATE PIN'**
  String get updatePinCaps;

  /// No description provided for @chooseLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your preferred language for the app.'**
  String get chooseLanguageSubtitle;

  /// No description provided for @currentLanguage.
  ///
  /// In en, this message translates to:
  /// **'Current Language'**
  String get currentLanguage;

  /// No description provided for @supportedLanguages.
  ///
  /// In en, this message translates to:
  /// **'Supported: English, ಕನ್ನಡ, हिन्दी, தமிழ்'**
  String get supportedLanguages;

  /// No description provided for @selected.
  ///
  /// In en, this message translates to:
  /// **'✓ Selected'**
  String get selected;

  /// No description provided for @searchLanguage.
  ///
  /// In en, this message translates to:
  /// **'Search language...'**
  String get searchLanguage;

  /// No description provided for @availableLanguages.
  ///
  /// In en, this message translates to:
  /// **'Available Languages'**
  String get availableLanguages;

  /// No description provided for @menuItemsUnchanged.
  ///
  /// In en, this message translates to:
  /// **'Menu items will remain the same.'**
  String get menuItemsUnchanged;

  /// No description provided for @saveLanguageCaps.
  ///
  /// In en, this message translates to:
  /// **'SAVE LANGUAGE'**
  String get saveLanguageCaps;

  /// No description provided for @paymentsHistory.
  ///
  /// In en, this message translates to:
  /// **'Payments History'**
  String get paymentsHistory;

  /// No description provided for @trackPayments.
  ///
  /// In en, this message translates to:
  /// **'Track Payments'**
  String get trackPayments;

  /// No description provided for @menuManagement.
  ///
  /// In en, this message translates to:
  /// **'Menu Management'**
  String get menuManagement;

  /// No description provided for @staffManagement.
  ///
  /// In en, this message translates to:
  /// **'Staff Management'**
  String get staffManagement;

  /// No description provided for @editStaffDetails.
  ///
  /// In en, this message translates to:
  /// **'Edit Staff Details'**
  String get editStaffDetails;

  /// No description provided for @viewOrderDetails.
  ///
  /// In en, this message translates to:
  /// **'View Order Details'**
  String get viewOrderDetails;

  /// No description provided for @cartDetails.
  ///
  /// In en, this message translates to:
  /// **'Cart Details'**
  String get cartDetails;

  /// No description provided for @cartIdCaps.
  ///
  /// In en, this message translates to:
  /// **'CART ID'**
  String get cartIdCaps;

  /// No description provided for @viewQrCaps.
  ///
  /// In en, this message translates to:
  /// **'VIEW QR'**
  String get viewQrCaps;

  /// No description provided for @securityAndLogin.
  ///
  /// In en, this message translates to:
  /// **'Security & Login'**
  String get securityAndLogin;

  /// No description provided for @logOutCaps.
  ///
  /// In en, this message translates to:
  /// **'LOG OUT'**
  String get logOutCaps;

  /// No description provided for @qrCodePoster.
  ///
  /// In en, this message translates to:
  /// **'QR Code Poster'**
  String get qrCodePoster;

  /// No description provided for @qrPrintTip.
  ///
  /// In en, this message translates to:
  /// **'Tip: Print in A4 size and laminate for durability.'**
  String get qrPrintTip;

  /// No description provided for @shareQrCaps.
  ///
  /// In en, this message translates to:
  /// **'SHARE QR'**
  String get shareQrCaps;

  /// No description provided for @noCartSelected.
  ///
  /// In en, this message translates to:
  /// **'No cart selected'**
  String get noCartSelected;

  /// No description provided for @staffAdded.
  ///
  /// In en, this message translates to:
  /// **'Staff added successfully'**
  String get staffAdded;

  /// No description provided for @staffAddedNoSms.
  ///
  /// In en, this message translates to:
  /// **'Staff added, but couldn\'t open SMS app.'**
  String get staffAddedNoSms;

  /// No description provided for @staffMovedTo.
  ///
  /// In en, this message translates to:
  /// **'Staff moved to {cart}'**
  String staffMovedTo(String cart);

  /// No description provided for @yourStaff.
  ///
  /// In en, this message translates to:
  /// **'Your Staff'**
  String get yourStaff;

  /// No description provided for @searchStaff.
  ///
  /// In en, this message translates to:
  /// **'Search by name or number'**
  String get searchStaff;

  /// No description provided for @noStaffYet.
  ///
  /// In en, this message translates to:
  /// **'No staff added yet'**
  String get noStaffYet;

  /// No description provided for @noStaffMatch.
  ///
  /// In en, this message translates to:
  /// **'No staff match \"{query}\"'**
  String noStaffMatch(String query);

  /// No description provided for @staffSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Add helpers who can log in and run your cart.'**
  String get staffSubtitle;

  /// No description provided for @nameRequired.
  ///
  /// In en, this message translates to:
  /// **'Name is required'**
  String get nameRequired;

  /// No description provided for @enterValidName.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid name'**
  String get enterValidName;

  /// No description provided for @phoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Phone number is required'**
  String get phoneRequired;

  /// No description provided for @enterValid10DigitNumber.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit number'**
  String get enterValid10DigitNumber;

  /// No description provided for @addHelper.
  ///
  /// In en, this message translates to:
  /// **'Add Helper'**
  String get addHelper;

  /// No description provided for @staffName.
  ///
  /// In en, this message translates to:
  /// **'Staff Name'**
  String get staffName;

  /// No description provided for @enterHelperName.
  ///
  /// In en, this message translates to:
  /// **'Enter helper\'s name'**
  String get enterHelperName;

  /// No description provided for @staffMobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Staff Mobile Number'**
  String get staffMobileNumber;

  /// No description provided for @sendDetailsCaps.
  ///
  /// In en, this message translates to:
  /// **'SEND DETAILS'**
  String get sendDetailsCaps;

  /// No description provided for @removeStaffQuestion.
  ///
  /// In en, this message translates to:
  /// **'Remove Staff?'**
  String get removeStaffQuestion;

  /// No description provided for @moveStaffToCart.
  ///
  /// In en, this message translates to:
  /// **'Move {name} to a different cart'**
  String moveStaffToCart(String name);

  /// No description provided for @noCartsAvailable.
  ///
  /// In en, this message translates to:
  /// **'No carts available'**
  String get noCartsAvailable;

  /// No description provided for @confirmSwitchCaps.
  ///
  /// In en, this message translates to:
  /// **'CONFIRM SWITCH'**
  String get confirmSwitchCaps;

  /// No description provided for @findingBestBites.
  ///
  /// In en, this message translates to:
  /// **'Finding the best bites...'**
  String get findingBestBites;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get welcome;

  /// No description provided for @skip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get skip;

  /// No description provided for @undo.
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get undo;

  /// No description provided for @serve.
  ///
  /// In en, this message translates to:
  /// **'Serve'**
  String get serve;

  /// No description provided for @due.
  ///
  /// In en, this message translates to:
  /// **'Due'**
  String get due;

  /// No description provided for @notAvailable.
  ///
  /// In en, this message translates to:
  /// **'N/A'**
  String get notAvailable;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @current.
  ///
  /// In en, this message translates to:
  /// **'Current'**
  String get current;

  /// No description provided for @qrPosterSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Print and paste this on your cart.'**
  String get qrPosterSubtitle;

  /// No description provided for @couldntLoadMenu.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load the menu.'**
  String get couldntLoadMenu;

  /// No description provided for @couldntLoadOrders.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load orders.'**
  String get couldntLoadOrders;

  /// No description provided for @couldntLoadStaff.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load staff.'**
  String get couldntLoadStaff;

  /// No description provided for @couldntLoadCarts.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load your carts.'**
  String get couldntLoadCarts;

  /// No description provided for @couldntLoadPayments.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load payments.'**
  String get couldntLoadPayments;

  /// No description provided for @couldntLoadSales.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load sales.'**
  String get couldntLoadSales;

  /// No description provided for @staffWillLoseAccess.
  ///
  /// In en, this message translates to:
  /// **'{name} will lose access to this cart. This can\'t be undone.'**
  String staffWillLoseAccess(String name);

  /// No description provided for @ordersTimesFee.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 order} other{{count} orders}} × ₹{fee}'**
  String ordersTimesFee(int count, String fee);

  /// No description provided for @walletSelected.
  ///
  /// In en, this message translates to:
  /// **'{wallet} selected.'**
  String walletSelected(String wallet);

  /// No description provided for @externalWallet.
  ///
  /// In en, this message translates to:
  /// **'External wallet'**
  String get externalWallet;

  /// No description provided for @feeDueBanner.
  ///
  /// In en, this message translates to:
  /// **'Your cart locks at {time}. Pay ₹{amount} now to keep taking orders.'**
  String feeDueBanner(String time, String amount);

  /// No description provided for @payNowCaps.
  ///
  /// In en, this message translates to:
  /// **'PAY NOW'**
  String get payNowCaps;

  /// No description provided for @payEarlySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pay now to keep taking orders after the lock time.'**
  String get payEarlySubtitle;

  /// No description provided for @askOwnerToPay.
  ///
  /// In en, this message translates to:
  /// **'Ask the cart owner to pay the platform fee to unlock the cart.'**
  String get askOwnerToPay;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your login has expired. Please log in again.'**
  String get sessionExpired;

  /// No description provided for @checkInternet.
  ///
  /// In en, this message translates to:
  /// **'Check your internet connection'**
  String get checkInternet;

  /// No description provided for @requestTimedOut.
  ///
  /// In en, this message translates to:
  /// **'Request timed out. Try again'**
  String get requestTimedOut;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get somethingWentWrong;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi', 'kn', 'ta'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
    case 'kn':
      return AppLocalizationsKn();
    case 'ta':
      return AppLocalizationsTa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
