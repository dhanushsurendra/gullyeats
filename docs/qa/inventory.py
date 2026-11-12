"""Builds docs/qa/test-inventory.xlsx from the cases below.

Edit the cases (status, actual result) here, then run:  python docs/qa/inventory.py
"""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule

OUT = Path(__file__).with_name("test-inventory.xlsx")
RUN = "2026-11-10"  # retest after the fixes: same day

COLS = ["Test ID", "Application", "Module", "Feature", "Test Scenario", "Preconditions",
        "Execution Steps", "Test Data", "Expected Result", "Actual Result", "Priority",
        "Severity", "Execution Status", "Automation Status", "Related App / API"]

APPS = {
    "FLT-ONB": "Onboarding app (Flutter, frontend/)",
    "FLT-VEN": "Vendor ordering app (Flutter, ordering/)",
    "RCT": "Customer web app (React, customer-app/)",
    "ADM": "Admin dashboard (React, gullyeats-admin/)",
    "API": "Backend API (Express, backend/)",
    "E2E": "Cross-application",
}


def c(module, feature, scenario, steps, expected, *, pre="", data="", pri="P2", sev="Major",
      api="", auto="Not automated", status="Not Run", actual=""):
    return dict(module=module, feature=feature, scenario=scenario, pre=pre, steps=steps, data=data,
                expected=expected, actual=actual, pri=pri, sev=sev, status=status, auto=auto, api=api)


def ran(test_file, ok=True, note=""):
    """Status + actual result for a case an existing automated test executed on RUN."""
    return dict(status="Passed" if ok else "Failed", auto=f"Automated ({test_file})",
                actual=note or (f"{test_file} passed on {RUN}" if ok else f"{test_file} failed on {RUN}"))


ONB_T = "frontend/test"
VEN_T = "ordering/test"
BE_T = "backend/test"

CASES = {}

# ---------------------------------------------------------------- FLT-ONB
CASES["FLT-ONB"] = [
    c("Auth", "Send OTP", "Valid 10-digit vendor number gets an OTP", "Open app > enter phone > Send OTP",
      "OTP screen opens; OTP shown to staff (by design, sent from staff phone)", pre="Network up",
      data="QA phone 00000009xx", pri="P1", sev="Critical", api="POST /vendors/send-otp"),
    c("Auth", "Send OTP", "Invalid number shows an error and keeps the button usable",
      "Enter 5 digits > Send OTP", "Inline error; button still enabled", data="12345", pri="P2",
      api="POST /vendors/send-otp", **ran(f"{ONB_T}/signup_screen_test.dart")),
    c("Auth", "Send OTP", "Failed request stops the spinner", "Backend returns 500 > Send OTP",
      "Spinner stops, error shown", pri="P2", api="POST /vendors/send-otp",
      **ran(f"{ONB_T}/signup_screen_test.dart")),
    c("Auth", "Send OTP", "Staff/admin number is refused for vendor onboarding",
      "Enter a staff member's phone > Send OTP", "Error 'This number belongs to a staff or admin account'",
      pri="P1", sev="Major", api="POST /vendors/send-otp"),
    c("Auth", "Verify OTP", "Correct OTP logs in and lands on Your Carts", "Enter OTP shown > Verify",
      "Token saved; carts list opens", pri="P1", sev="Critical", api="POST /vendors/verify-otp"),
    c("Auth", "Verify OTP", "Wrong / expired OTP", "Enter wrong OTP; then wait past expiry and enter right one",
      "'Invalid OTP' then 'OTP expired'; stays on screen", pri="P1", api="POST /vendors/verify-otp"),
    c("Auth", "Verify OTP", "Disabled vendor cannot log in", "Admin disables vendor > verify OTP",
      "Disabled-account message", pri="P1", sev="Critical", api="POST /vendors/verify-otp"),
    c("Auth", "PIN login", "PIN login opens the vendor's carts", "Enter vendor ID + PIN", "Carts screen",
      pri="P1", api="POST /vendors/login", **ran(f"{ONB_T}/pin_login_test.dart")),
    c("Auth", "PIN login", "Wrong PIN shows the server message", "Enter wrong PIN", "Server message shown",
      pri="P2", api="POST /vendors/login", **ran(f"{ONB_T}/pin_login_test.dart")),
    c("Carts", "Your Carts", "Half-done cart resumes at its first unfinished step", "Open a cart with no photo",
      "Opens the photo step", pri="P1", api="GET /carts/get-all-carts/:userId",
      **ran(f"{ONB_T}/carts_screen_test.dart")),
    c("Carts", "Your Carts", "Onboarding is complete once the QR code exists", "Open a cart with QR",
      "Shown as complete", pri="P2", **ran(f"{ONB_T}/onboarding_progress_test.dart")),
    c("Cart details", "Create cart", "Create a cart with name + city", "New cart > fill > Continue",
      "Cart created; photo step opens", data="QA-Cart / Bengaluru", pri="P1", sev="Critical",
      api="POST /carts/create-basic-cart"),
    c("Cart details", "Create cart", "A one-letter cart name is refused on the phone (2+ characters, as the server)",
      "Name 'A' > pick city > Continue", "'Cart name must be at least 2 characters'; no request sent", pri="P2",
      api="none (client-side, same rule as POST /carts/create-basic-cart)"),
    c("Cart details", "Edit cart", "Opening an existing cart prefills it and updates on continue",
      "Open cart > change name > Continue", "Same cart updated, no duplicate", pri="P1",
      api="PUT /carts/update-cart/:cartId", **ran(f"{ONB_T}/cart_details_test.dart")),
    c("Cart details", "Edit cart", "Back from photo step then continue updates (not duplicates)",
      "Details > Photo > Back > Continue", "No second cart", pri="P1", sev="Major",
      **ran(f"{ONB_T}/cart_details_test.dart")),
    c("Cart details", "City", "CONTINUE needs a city picked from the dropdown", "Name only > Continue",
      "Nothing is sent until a city is chosen", pri="P3"),
    c("Photo", "Cart photo", "Upload a JPEG/PNG/WebP photo", "Pick photo > Continue",
      "Presigned upload succeeds; image saved on cart", pri="P2", api="POST /carts/generate-cart-image-url/:cartId"),
    c("Photo", "Cart photo", "Compressed copy never overwrites the source", "Compress image",
      "Different path", pri="P3", **ran(f"{ONB_T}/compress_image_test.dart")),
    c("Location", "Enable location", "Permission denied shows guidance, not a crash",
      "Deny location permission", "Explains and offers retry/settings", pri="P2", sev="Major"),
    c("Location", "Confirm location", "Saves address + coordinates", "Allow > confirm pin", "Location saved",
      pri="P1", api="POST /carts/update-location/:cartId"),
    c("Location", "Address", "Missing address parts are skipped, not 'null'", "Format address",
      "No 'null' text", pri="P3", **ran(f"{ONB_T}/address_test.dart")),
    c("Menu", "Add menu", "SAVE & CONTINUE disabled until an item is added", "Open Add Menu", "Button disabled",
      pri="P2", **ran(f"{ONB_T}/menu_flow_test.dart")),
    c("Menu", "Add menu", "Name suggestions from food-names", "Type 'pan'",
      "Prefix matches first; picking fills saved name", pri="P2", api="GET /carts/food-names",
      **ran(f"{ONB_T}/add_menu_suggest_test.dart")),
    c("Menu", "Add menu", "Suggestion ranking", "Type partial word", "Word-start matches before contains",
      pri="P3", **ran(f"{ONB_T}/food_name_suggest_test.dart")),
    c("Menu", "Menu review", "Deleting on review sticks after back arrow and system back",
      "Delete item > back", "Item stays deleted", pri="P2", **ran(f"{ONB_T}/menu_flow_test.dart")),
    c("Menu", "Price format", "Whole rupees drop .0; decimals kept", "formatPrice(20.0), (20.5)", "'20', '20.5'",
      pri="P3", **ran(f"{ONB_T}/format_price_test.dart")),
    c("Menu", "Create menu", "Empty menu / bad price refused by server", "POST empty list; price -1",
      "400 with message", pri="P2", api="POST /carts/create-menu/:cartId"),
    c("Staff", "Add staff", "Add staff with name + phone", "Staff step > add", "Staff listed", data="QA-Staff",
      pri="P2", api="POST /carts/add-staff/:cartId"),
    c("Staff", "Add staff", "Duplicate phone refused", "Add staff with an existing user's phone",
      "'User with this phone number already exists'", pri="P2", api="POST /carts/add-staff/:cartId"),
    c("Staff", "Send credentials", "Send Credentials asks first and does nothing on cancel", "Tap > Cancel",
      "No PIN issued", pri="P2", **ran(f"{ONB_T}/carts_screen_test.dart")),
    c("QR", "QR poster", "Generate QR and poster (always light theme)", "Finish > QR poster", "QR image shown",
      pri="P1", api="POST /carts/generate-cart-qr/:cartId"),
    c("QR", "QR poster", "Back before/after sharing goes to correct place", "Share > back", "Your Carts",
      pri="P2", **ran(f"{ONB_T}/qr_poster_test.dart")),
    c("UI", "Responsive", "Every screen at 6 sizes, 1.3x/1.5x text, landscape, keyboard: no layout errors",
      "flutter test test/responsive", "No overflow; goldens match", pri="P2",
      **ran(f"{ONB_T}/responsive")),
    c("UI", "Theme", "Dark/light toggle via sun/moon on every step screen", "Tap toggle on each step",
      "All text readable; QR poster stays light", pri="P3", sev="Minor"),
    c("Lifecycle", "Session", "Kill and reopen app keeps the session", "Login > kill > reopen", "Lands on carts",
      pri="P2"),
    c("Lifecycle", "Offline", "Airplane mode during Continue", "Enable airplane > Continue",
      "Error shown, no crash, retry works", pri="P2"),
    c("Menu", "Menu review", "Edit an item's price on review before saving", "Review > edit icon > price > UPDATE ITEM",
      "New price shown and saved", pri="P2", api="POST /carts/create-menu/:cartId"),
    c("Staff", "Delete staff", "Delete a staff member from Staff Management", "Tap delete on a staff card",
      "Card gone; staff removed on the server", pri="P2", api="DELETE /carts/delete-staff/:staffId"),
    c("OTP", "Change number", "Change on the OTP screen goes back with the number kept", "OTP screen > Change", "Sign-up with the number filled", pri="P3"),
    c("OTP", "Resend", "Resend unlocks after 2 minutes and sends a new code", "Wait 2 min > Resend", "Messages opens; countdown restarts", pri="P3"),
    c("OTP", "Rate limit", "11th SEND OTP for a number within 15 min is refused", "Send OTP 11 times", "Too many attempts. Please try again in 15 minutes.", pri="P3"),
    c("Photo", "Retake", "Retake clears the photo and the camera opens again", "Photo > retake > new photo", "New photo uploaded", pri="P3"),
    c("Photo", "Camera denied", "Denying camera permission shows guidance, no crash", "Open camera > Don't allow", "Camera permission is required.", pri="P3"),
    c("Location", "Services off", "Location services off: message and Settings", "Turn location off > Enable", "Location services are disabled...; Settings opens; back works", pri="P3"),
    c("Location", "Map offline", "Map fails to load without internet", "Internet off > location step", "Map unavailable + Tap to retry", pri="P3"),
    c("Location", "No address", "No address from the phone: the cart still saves (coordinates as address)", "Geocoder fails/times out", "Location saved; address = coordinates", pri="P3"),
    c("Menu", "Validation", "Empty name or price 0 refused on Add Menu", "Save with blank / 0", "Please fill all item details correctly.", pri="P3"),
    c("Menu", "Veg toggle", "Non-Veg choice is saved", "Pick Non-Veg > save", "isVeg false on the server", pri="P3"),
    c("Menu", "Suggestions", "Picking a suggested name on the phone", "Type mas > pick Masala Dosa", "Name filled from the list", pri="P3"),
    c("Staff", "Invalid phone", "Invalid staff phone refused in the form", "Phone 12345 > SEND DETAILS", "Enter a valid 10-digit number", pri="P3"),
    c("Carts", "Search", "Search filters outlets; no match message", "Type beta / zzz", "Filtered; No outlets found matching", pri="P3"),
    c("Carts", "Refresh", "Pull to refresh shows a new cart", "Add cart elsewhere > pull down", "New cart listed", pri="P3"),
    c("Carts", "Several carts", "A vendor with several carts sees them all", "Log in as vendor with 3 carts", "All listed with status", pri="P3"),
    c("Carts", "Finished cart", "Reopening a finished cart goes to its QR poster", "Tap ACTIVE cart > CONTINUE", "QR poster", pri="P3"),
    c("QR", "Share", "SHARE QR opens the share sheet; then BACK TO OUTLETS", "Share > back", "BACK TO OUTLETS > Your Carts", pri="P3"),
    c("Session", "Expired login", "An expired login on Your Carts", "Expired token > refresh", "Signed out to sign-up, or a clear message", pri="P3"),
    c("Device", "Large text", "Flows at 1.3x system text on a real phone", "font_scale 1.3 > run flows", "No clipped or broken screens", pri="P3"),
]

# ---------------------------------------------------------------- FLT-VEN
CASES["FLT-VEN"] = [
    c("Auth", "Login", "Owner logs in with vendor ID + PIN", "Enter VEN-ID + PIN", "Home with orders",
      data="VEN-Z00002 / test PIN", pri="P1", sev="Critical", api="POST /vendors/login"),
    c("Auth", "Login", "10 wrong attempts are rate-limited for 15 min", "Wrong PIN x11",
      "'Too many attempts...'", pri="P2", api="POST /vendors/login"),
    c("Auth", "Session", "A 401 with a saved session logs out to login", "Expire token > any call",
      "Login screen", pri="P1", **ran(f"{VEN_T}/session_test.dart")),
    c("Auth", "Session", "Failed login without session stays put", "Wrong PIN", "Stays on login", pri="P3",
      **ran(f"{VEN_T}/session_test.dart")),
    c("Auth", "Disabled", "Admin disables vendor while logged in", "Admin disables > vendor refreshes",
      "Next call 401 > logged out", pri="P1", sev="Critical", api="auth middleware"),
    c("Orders", "Live orders", "New QR order appears in real time", "Customer orders on web",
      "Order shows without refresh (socket new_order_received)", pri="P1", sev="Critical", api="Socket.IO <cartId>"),
    c("Orders", "Missed orders", "Orders missed while offline are added and highlighted", "Reconnect",
      "Missed orders added, newest alerted", pri="P1", **ran(f"{VEN_T}/order_provider_test.dart")),
    c("Orders", "Missed orders", "Result ignored after switching carts", "Switch cart mid-fetch",
      "No cross-cart orders", pri="P2", **ran(f"{VEN_T}/order_provider_test.dart")),
    c("Orders", "Paid toggle", "Mark PENDING order paid, then unpaid", "Toggle paid", "Status PAID / PENDING",
      pri="P1", api="PUT /orders/mark-order-paid|unpaid/:id"),
    c("Orders", "Serve", "Cannot serve an unpaid order", "Tap Serve on PENDING", "'Mark the order paid before serving it'",
      pri="P1", api="PUT /orders/serve-order/:id"),
    c("Orders", "Serve undo", "Undo serve returns to PAID", "Serve > Undo", "Status PAID", pri="P2",
      api="PUT /orders/serve-order-undo/:id"),
    c("Orders", "Preparing", "Mark paid order as preparing", "Tap Preparing", "preparingAt set; customer sees Preparing",
      pri="P2", api="PUT /orders/preparing/:id"),
    c("Orders", "Manual order", "Create manual order with parcel charge", "New order > items > parcel 10",
      "Total = items + parcel + Rs 2 fee", pri="P1", api="POST /orders/create-order"),
    c("Orders", "Manual order", "Parcel typed before items applies once items exist", "Type parcel first",
      "Applied once", pri="P3", **ran(f"{VEN_T}/order_provider_test.dart")),
    c("Orders", "Edit order", "Editing keeps ordered prices and dropped items", "Edit order after menu change",
      "Old prices kept", pri="P2", api="PUT /orders/update-order/:id", **ran(f"{VEN_T}/order_provider_test.dart")),
    c("Orders", "Cancel", "Cancel and undo cancel", "Cancel > Undo", "CANCELLED > back to previous", pri="P2",
      api="DELETE /orders/delete-order/:id, PUT /orders/delete-order-undo/:id"),
    c("Menu", "Add item", "Item can be added without a photo", "Add item no photo", "Saved", pri="P2",
      api="POST /carts/add-menu-item/:cartId", **ran(f"{VEN_T}/add_item_test.dart")),
    c("Menu", "Add item", "Suggestion fills English and local name", "Pick suggestion", "Both names filled",
      pri="P3", **ran(f"{VEN_T}/edit_item_suggest_test.dart")),
    c("Menu", "Suggest", "Suggest by any word, English or app language", "Type in Hindi", "Prefix first",
      pri="P3", **ran(f"{VEN_T}/food_name_suggest_test.dart")),
    c("Menu", "Stock", "Out-of-stock item cannot be ordered by customer", "Toggle stock off > customer orders",
      "'<item> is out of stock'", pri="P1", api="PATCH /carts/update-stock/:cartId/:itemId"),
    c("Cart", "Open/close", "Close cart stops customer orders", "Toggle closed > customer orders",
      "403 'not taking orders'", pri="P1", sev="Critical", api="PUT /carts/toggle-cart-status/:cartId"),
    c("Cart", "Switch cart", "Owner with 2 carts switches", "Switch cart", "Orders of new cart only", pri="P2"),
    c("Staff", "Access", "Staff cannot see Sales, menu edit, staff, fees", "Login as staff",
      "Handover tab instead of Sales; owner-only screens hidden; API 403 for owner routes", pri="P1",
      sev="Critical", api="findOwnedCart"),
    c("Staff", "Handover", "Handover counts collected, to collect, refunds today", "Open Handover",
      "Correct sums", pri="P2", **ran(f"{VEN_T}/handover_test.dart")),
    c("Sales", "Dashboard", "Sales totals match admin GMV for the cart", "Compare Sales with admin",
      "Same totals (PAID+SERVED)", pri="P1", api="GET /carts/sales-insights/:cartId"),
    c("Fees", "Warning", "Running fee shows no warning during the day", "Open home", "No warning", pri="P2",
      **ran(f"{VEN_T}/payment_lock_test.dart")),
    c("Fees", "Warning", "After midnight before lock: warning with Pay now", "Unpaid yesterday",
      "Warning + Pay now", pri="P1", **ran(f"{VEN_T}/payment_lock_test.dart")),
    c("Fees", "Lock", "Locked cart goes to lock screen on resume", "Lock while open > resume", "Lock screen",
      pri="P1", sev="Critical", **ran(f"{VEN_T}/payment_lock_test.dart")),
    c("Fees", "Lock", "Staff on lock screen are told to ask the owner", "Staff on locked cart", "No Pay button",
      pri="P2", **ran(f"{VEN_T}/payment_lock_test.dart")),
    c("Fees", "Razorpay", "Pay the open bill with Razorpay test card", "Pay now > test card",
      "Payment VERIFIED; cart unlocks", pri="P1", sev="Critical", api="POST /payments/* + webhook"),
    c("Profile", "Language", "Saving Hindi switches and persists", "Profile > Hindi > relaunch", "Hindi UI",
      pri="P2", **ran(f"{VEN_T}/language_test.dart", ok=False,
                      note="Failed: after SAVE LANGUAGE, text 'लॉगिन' not found (language_test.dart:59)")),
    c("Profile", "Language", "Every language has every translation", "Check ARB keys", "No missing key",
      pri="P2", **ran(f"{VEN_T}/language_test.dart")),
    c("Profile", "Change PIN", "Change PIN with wrong old PIN", "Enter wrong old PIN", "Error; PIN unchanged",
      pri="P2", api="POST /vendors/change-pin"),
    c("UI", "Responsive", "All screens at all sizes, en/kn/ta, no layout errors", "flutter test test/responsive",
      "No overflow; goldens match", pri="P2", **ran(f"{VEN_T}/responsive")),
    c("Lifecycle", "Background", "App backgrounded 10 min then resumed", "Background > resume",
      "Socket reconnects; missed orders fetched", pri="P1"),
    c("Cart", "Parcel charge", "Negative / non-numeric parcel charge refused (moved from FLT-ONB: only this app has it)",
      "Edit cart > parcel -5", "'Parcel charge must be a number of 0 or more'", pri="P3",
      api="PUT /carts/update-cart/:cartId"),
    c("Auth", "Login", "Log in with the Vendor ID instead of the phone", "Enter VEN-XXXXXX + PIN", "Logged in, cart picker", pri="P2", sev="Major", api="POST /vendors/login"),
    c("Auth", "Login", "Empty ID or PIN not 4 digits is caught on the phone", "Leave ID empty / PIN 12", "'Vendor ID required' / 'Enter 4-digit PIN', no request", pri="P2", sev="Minor"),
    c("Auth", "Login", "A disabled vendor sees the disabled message at login", "Admin disables > log in", "Account disabled message", pri="P1", sev="Major", api="POST /vendors/login"),
    c("Auth", "Login", "Staff login lands on the staff view", "Log in with a staff PIN", "Handover tab instead of Sales; owner screens hidden", pri="P1", sev="Critical", api="POST /vendors/login"),
    c("Auth", "Forgot PIN", "Forgot PIN / Contact support / New vendor links", "Tap each link", "Support call or contact opens; no crash", pri="P3", sev="Minor"),
    c("Auth", "Session", "Reopening the app keeps the login", "Log in > kill > reopen", "Straight to the cart (no login)", pri="P1", sev="Major"),
    c("Auth", "Session", "No internet at login", "Airplane mode > LOGIN", "'Check your internet' message; no crash", pri="P2", sev="Major"),
    c("Cart", "Cart picker", "Owner with several carts picks one", "Log in > list > tap cart", "Welcome > Orders of that cart", pri="P1", sev="Major", api="GET /carts/get-all-carts/:userId"),
    c("Cart", "Cart picker", "Search carts and empty states", "Search a name / nonsense; owner with no carts", "Filtered; 'No carts assigned'", pri="P3", sev="Minor"),
    c("Cart", "Welcome", "Payment status check fails on welcome", "Backend down during welcome", "'Unable to check payment status' with Retry, Switch cart, Logout", pri="P2", sev="Major", api="GET /payments/payment-status/:cartId"),
    c("Cart", "Switch cart", "Switching carts from the app later", "Profile > Switch cart > pick other", "Orders, menu, sales follow the new cart", pri="P2", sev="Major"),
    c("Orders", "Tabs", "All / QR / Manual tabs filter today's orders", "Have both kinds > switch tabs", "Right orders under each tab", pri="P2", sev="Minor", api="GET /orders/orders-today/:cartId"),
    c("Orders", "Empty states", "No orders today / no QR / no manual orders", "Fresh cart > each tab", "Matching empty message", pri="P3", sev="Minor"),
    c("Orders", "Errors", "Orders fail to load, then Retry", "Backend down > open Orders > Retry", "'Couldn't load orders' > list after retry", pri="P2", sev="Major"),
    c("Orders", "Live status", "Live indicator and reconnecting", "Kill backend socket > restore", "'Reconnecting' then live again; missed orders added", pri="P1", sev="Major", api="Socket.IO"),
    c("Orders", "Alert", "New order alert sound and vibration", "Customer orders while app open", "Cha-ching + buzz; card highlighted", pri="P2", sev="Minor"),
    c("Orders", "Order card", "Card shows items, '+N more', totals, time ago, paid/served times", "Order with many items, paid and served", "All fields right", pri="P2", sev="Minor"),
    c("Orders", "Delete order", "Delete asks first; cancel keeps it", "Delete > Cancel; Delete > Delete", "Kept / cancelled with Undo", pri="P1", sev="Major", api="DELETE /orders/delete-order/:id"),
    c("Orders", "Undo", "Undo after paid, served, cancel from the snackbar", "Act > Undo", "Back to the previous state on the server", pri="P2", sev="Major", api="PUT /orders/*-undo"),
    c("Orders", "Edited order", "After an edit: collect more / give back money shown", "Edit a paid order up / down", "'Collect ₹X from customer' / 'Return ₹X'", pri="P1", sev="Major", api="PUT /orders/update-order/:id"),
    c("Orders", "Partial payment", "Partially paid order", "Paid order edited to more", "'Partially paid' and amount due", pri="P2", sev="Major"),
    c("Orders", "Customer changes", "Customer adds items or cancels from the web", "Customer edits / cancels", "Vendor card updates / shows cancelled live", pri="P1", sev="Major", api="Socket.IO order_updated / order_cancelled"),
    c("Orders", "Two devices", "Owner and staff phones on the same cart stay in sync", "Mark paid on one", "Other updates without refresh", pri="P1", sev="Major", api="Socket.IO <cartId>"),
    c("Orders", "Overview", "Orders overview by date range", "Open overview > change range", "Counts and list for the range; empty message", pri="P2", sev="Minor", api="GET /orders/orders/:cartId"),
    c("New order", "Create", "Create a manual order as unpaid and as paid", "+ > items > Create / Mark paid", "PENDING / PAID order; 'Order created'", pri="P1", sev="Critical", api="POST /orders/create-order"),
    c("New order", "Search", "Search menu items in the new-order sheet", "Type part of a name / nonsense", "Filtered; 'No menu items found'", pri="P3", sev="Minor"),
    c("New order", "Out of stock", "Out-of-stock items can't be added to a manual order", "Mark OOS > new order", "Item disabled or refused", pri="P2", sev="Major"),
    c("New order", "Locked cart", "Creating an order on a fee-locked cart", "Lock cart > new order", "Lock message (403) not a generic error", pri="P1", sev="Major", api="POST /orders/create-order (403)"),
    c("New order", "Validation", "Create with no items is not allowed", "Open sheet > Create", "Button disabled / message", pri="P3", sev="Minor"),
    c("Menu", "Edit menu", "Menu list with search", "Edit menu > search", "Filtered items", pri="P3", sev="Minor", api="GET /carts/get-menu-items/:cartId"),
    c("Menu", "Add item", "Name and price validation", "Empty name / 1 letter / no price / -5", "'Item name required' / 'too short' / 'Price required' / 'Enter a valid price'", pri="P2", sev="Minor"),
    c("Menu", "Add item", "Name in my language", "Fill the local-language name", "Saved in names.<lang>; shown in that language", pri="P2", sev="Minor", api="POST /carts/add-menu-item/:cartId"),
    c("Menu", "Add item", "Category and veg / non-veg saved", "Pick category, Non-Veg > save", "Saved and shown", pri="P3", sev="Minor"),
    c("Menu", "Item photo", "Add a photo from camera and from gallery", "Camera / Gallery > pick > save", "Photo uploaded and shown", pri="P2", sev="Minor", api="POST /carts/generate-*-url"),
    c("Menu", "Item photo", "Camera permission denied for an item photo", "Deny camera", "'Camera permission required' + Open settings; no crash", pri="P3", sev="Minor"),
    c("Menu", "Edit item", "Edit name, price, local name, photo", "Edit dialog > change > Update", "Server updated; ordered prices unchanged", pri="P1", sev="Major", api="PUT /carts/update-menu-item/:cartId"),
    c("Menu", "Edit item", "Edit validation", "Empty name / bad price > Update", "'Item name empty' / 'Enter a valid price'", pri="P3", sev="Minor"),
    c("Menu", "Delete item", "Delete asks first", "Delete > confirm", "Item gone; old orders keep it", pri="P2", sev="Major", api="DELETE /carts/delete-menu-item"),
    c("Menu", "Staff", "Staff can't open menu editing", "Log in as staff", "Menu screens hidden; API 403", pri="P1", sev="Major", api="findOwnedCart"),
    c("Stock", "Toggle", "Mark items in and out of stock", "Stock > toggle", "Server isInStock; customer menu follows", pri="P1", sev="Major", api="PATCH /carts/update-stock"),
    c("Stock", "Filters", "All / In stock / Out of stock and search", "Switch filter, search", "Right items", pri="P3", sev="Minor"),
    c("Stock", "Staff", "Staff can change stock", "Staff > Stock > toggle", "Allowed (findManagedCart)", pri="P2", sev="Major"),
    c("Cart", "Edit cart", "Edit cart name / city with validation", "Empty name / city > Save", "'Cart name empty' / 'City empty'; valid saves", pri="P2", sev="Minor", api="PUT /carts/update-cart/:cartId"),
    c("Cart", "Edit cart", "Unsaved changes asks before leaving", "Change > back", "Discard / Keep editing dialog", pri="P3", sev="Minor"),
    c("Cart", "Cart photo", "Change cart photo from camera or gallery", "Change photo > pick", "Uploaded, shown everywhere", pri="P3", sev="Minor"),
    c("Cart", "Location", "Update GPS location", "Update GPS location", "New coordinates and address saved", pri="P2", sev="Minor", api="POST /carts/update-location"),
    c("Cart", "Location", "Location denied / services off / map unavailable", "Deny / turn off / no internet", "Matching messages; no crash", pri="P3", sev="Minor"),
    c("Cart", "Active", "Cart active switch hides the cart from customers", "Turn Active off > customer opens QR", "Customer sees it is unavailable", pri="P1", sev="Major", api="PUT /carts/update-cart"),
    c("Cart", "Suspended", "A cart suspended by admin can't be reopened", "Admin suspends > toggle open", "'Paused by GullyEats' message", pri="P1", sev="Major", api="PUT /carts/toggle-cart-status (403)"),
    c("Sales", "Range", "Date range changes every number", "Pick today / 7 days / custom", "All cards recompute", pri="P2", sev="Major", api="GET /carts/sales-insights/:cartId"),
    c("Sales", "Cards", "Revenue, net, average order, orders count, fee", "Compare with API for a range", "Same numbers", pri="P1", sev="Major"),
    c("Sales", "Compare", "Compared with the day / days before", "Range with earlier data", "Up / down shown right", pri="P3", sev="Minor"),
    c("Sales", "Charts", "Daily sales chart, busy hours, peak hour, best day / weekday", "Data over a week", "Charts and labels match data", pri="P3", sev="Minor"),
    c("Sales", "Items", "Top sellers and items not sold", "Mixed sales", "Correct lists; '+N more'", pri="P3", sev="Minor"),
    c("Sales", "Missed money", "Unpaid and cancelled money", "Unpaid + cancelled orders", "Amounts and hint correct", pri="P2", sev="Minor"),
    c("Sales", "Customers", "Customers, returning, ratings, recent feedback, average wait", "Served orders with ratings", "Counts and feedback shown", pri="P3", sev="Minor"),
    c("Sales", "Empty / error", "No sales in period; sales fail to load", "Empty range; backend down", "'No orders in period'; 'Couldn't load sales' + Retry", pri="P3", sev="Minor"),
    c("Sales", "Parcel / types", "QR vs manual summary, parcel orders and average parcel charge", "Mixed orders", "Right split", pri="P3", sev="Minor"),
    c("Handover", "Staff view", "Only staff see Handover; owners see Sales", "Log in as each", "Right tab", pri="P2", sev="Major"),
    c("Fees", "Pay early", "Pay before the lock time from the banner", "Fee due > Pay now", "Razorpay opens with the right amount", pri="P2", sev="Major", api="POST /payments/*"),
    c("Fees", "Razorpay", "Cancel or fail in Razorpay", "Open gateway > cancel / fail", "'Payment failed, retry'; still unlocked/locked as before", pri="P1", sev="Major"),
    c("Fees", "Razorpay", "Verification pending, then verified", "Pay > slow webhook", "'Verification pending' then unlocked", pri="P1", sev="Major", api="webhook"),
    c("Fees", "Razorpay", "External wallet selected", "Pick a wallet", "Wallet message; status checked", pri="P3", sev="Minor"),
    c("Fees", "Duplicate", "A second payment for the same bill is refunded", "Pay twice", "'Duplicate payment refunded'", pri="P1", sev="Major"),
    c("Fees", "Gateway", "Gateway can't open / payment can't start", "No internet / backend error", "Matching message; no crash", pri="P2", sev="Minor"),
    c("Fees", "Check status", "Check payment status button", "Pending payment > Check", "Status refreshed", pri="P2", sev="Minor", api="GET /payments/payment-status"),
    c("Payments", "History", "Payment history: list, empty period, details", "Profile > Payments", "Transactions with status, reference, dates", pri="P2", sev="Minor", api="GET /payments/payment-history/:cartId"),
    c("Payments", "Statuses", "Verified / pending / rejected / expired shown right", "Payments in each state", "Right label and colour", pri="P3", sev="Minor"),
    c("Profile", "Screen", "Profile shows cart details and menu entries for the role", "Open Profile as owner and staff", "Owner sees all; staff sees allowed ones", pri="P2", sev="Major"),
    c("Profile", "QR", "View and share the QR poster", "Profile > QR > Share", "Poster shown; share sheet opens", pri="P2", sev="Minor", api="GET /carts/get-qr-details"),
    c("Profile", "Change PIN", "Change PIN succeeds and new PIN logs in", "Current + new + confirm > Update", "'PIN updated'; new PIN works, old doesn't", pri="P1", sev="Major", api="POST /vendors/change-pin"),
    c("Profile", "Change PIN", "PIN rules: 4 digits, mismatch, same as current, empty", "Try each", "Matching message, no change", pri="P2", sev="Minor"),
    c("Profile", "Change PIN", "Forgot current PIN", "Tap Forgot current PIN", "Contact support to reset", pri="P3", sev="Minor"),
    c("Profile", "Language", "Kannada and Tamil switch and persist", "Pick each > reopen", "Whole app in that language", pri="P2", sev="Minor"),
    c("Profile", "Language", "Search languages", "Type 'Tamil' / 'தமிழ்'", "Filtered", pri="P3", sev="Minor"),
    c("Profile", "Language", "Menu names shown in the chosen script", "Switch to Hindi > Orders / menu", "displayName in Devanagari; English when missing", pri="P2", sev="Minor"),
    c("Profile", "Dark theme", "Dark / light switch persists", "Toggle > reopen", "Theme kept; all screens readable", pri="P3", sev="Minor"),
    c("Profile", "Terms", "Terms & privacy opens", "Tap Terms", "Page opens", pri="P3", sev="Minor"),
    c("Profile", "Logout", "Log out clears the session", "Log out > reopen", "Login screen; old token unused", pri="P1", sev="Major"),
    c("Staff mgmt", "Add staff", "Add staff with validation; SMS with their PIN", "Name/phone empty, invalid, valid", "Messages; staff added; SMS opens (or 'added, no SMS')", pri="P1", sev="Major", api="POST /carts/add-staff/:cartId"),
    c("Staff mgmt", "Duplicate", "A phone that already has an account is refused", "Add existing number", "'already exists' message", pri="P2", sev="Minor"),
    c("Staff mgmt", "Remove staff", "Remove asks first; removed staff lose access", "Remove > confirm > staff phone acts", "Staff signed out / refused", pri="P1", sev="Critical", api="DELETE /carts/delete-staff/:staffId"),
    c("Staff mgmt", "Move staff", "Move a staff member to another of my carts", "Move > pick cart > confirm", "'Moved to <cart>'; staff sees the new cart", pri="P2", sev="Major", api="PUT /carts/switch-staff-cart/:staffId"),
    c("Staff mgmt", "Search", "Search staff and empty states", "Search / no staff", "Filtered; 'No staff yet' / 'No staff match'", pri="P3", sev="Minor"),
    c("Device", "Large text", "Main flows at 1.3x and 1.5x system text on a phone", "Font size up > run flows", "No clipped or overlapping text", pri="P2", sev="Minor"),
    c("Device", "Offline", "Actions with no internet", "Airplane mode > mark paid / serve", "'Check your internet'; nothing half-saved", pri="P1", sev="Major"),
    c("Device", "Battery", "App stays idle when nothing happens (after BUG-007)", "Profile mode, leave on Orders", "No frames scheduled while idle", pri="P2", sev="Minor"),
    c("Device", "Statuses", "Status logic uses server codes in every language", "Hindi/Kannada/Tamil > paid/serve/cancel", "Same behaviour as English", pri="P1", sev="Major"),
]

# ---------------------------------------------------------------- RCT
PW = "Planned (Playwright)"
CASES["RCT"] = [
    c("Entry", "QR open", "Opening /c/:cartId shows Welcome with cart name", "Open cart URL",
      "Welcome page, cart name, How it works", pri="P1", sev="Critical", api="GET /carts/get-cart/:cartId", auto=PW),
    c("Entry", "Bad cart", "Unknown or malformed cart id", "Open /c/000000000000000000000000 and /c/abc",
      "'Couldn't open this cart' with Try again; no crash", pri="P2", api="GET /carts/get-cart", auto=PW),
    c("Entry", "404", "Unknown route shows NotFound", "Open /nope", "NotFound page", pri="P3", sev="Minor", auto=PW),
    c("Menu", "Browse", "Menu lists items with prices and veg marks", "Welcome > menu", "Items render",
      pri="P1", api="GET /carts/get-menu-items/:cartId", auto=PW),
    c("Menu", "Errors", "Menu API failure shows retry", "Block API > open menu", "'Couldn't load the menu' + Try again",
      pri="P2", auto=PW),
    c("Menu", "Stock", "Out-of-stock items cannot be added", "View OOS item", "Disabled / marked", pri="P2", auto=PW),
    c("Cart", "Basket", "Add, increase, decrease, remove items", "Use +/-", "Bill details totals = sum + Rs 2 fee",
      pri="P1", sev="Critical", auto=PW),
    c("Cart", "Persistence", "Basket survives reload (redux-persist)", "Add items > F5", "Items still there",
      pri="P2", auto=PW),
    c("Cart", "Empty", "Empty cart shows Browse the menu", "Open /cart with nothing", "Empty state", pri="P3", auto=PW),
    c("Checkout", "Phone", "Optional phone step validates digits", "Enter letters / 9 digits", "Validation message",
      pri="P2", auto=PW),
    c("Checkout", "Place order", "Place order returns token page", "Cart > Place order",
      "Token page with order number; Placed step active", pri="P1", sev="Critical",
      api="POST /orders/create-order", auto=PW),
    c("Checkout", "Duplicate", "Double-click Place order creates one order", "Double-click fast", "Exactly one order",
      pri="P1", sev="Critical", api="POST /orders/create-order", auto=PW),
    c("Checkout", "Closed cart", "Ordering from closed cart shows server message", "Vendor closes cart > place",
      "'This cart is not taking orders right now'", pri="P1", auto=PW),
    c("Token", "Live status", "Token page updates when vendor marks paid/served", "Vendor acts",
      "Paid > Preparing > Served without reload", pri="P1", sev="Critical", api="Socket.IO order:<id>", auto=PW),
    c("Token", "Queue", "Queue shows position and tokens of others only", "Several paid orders",
      "Ahead count; no other customer data", pri="P2", api="GET /orders/queue/:orderId", auto=PW),
    c("Token", "Back nav", "Back button and re-scan link back to open order", "Back > re-open cart",
      "Open-order link on welcome/menu", pri="P2", auto=PW),
    c("Token", "Add items", "Add items to a PENDING order", "Token > Add", "Order updated, total updated",
      pri="P2", api="PUT /orders/update-order/:id", auto=PW),
    c("Token", "Cancel", "Customer cancels unpaid order", "Cancel", "Cancelled page", pri="P2",
      api="DELETE /orders/delete-order/:id", auto=PW),
    c("Token", "Cancel paid", "Cannot cancel a paid order", "Vendor marks paid > cancel",
      "'already paid. Ask the cart to cancel it.'", pri="P2", auto=PW),
    c("Served", "Feedback", "Rate 1-5 stars and text after served", "Served page > rate", "Thank you page",
      pri="P2", api="PUT /orders/submit-feedback/:id", auto=PW),
    c("Security", "Order key", "Another browser cannot open someone's order", "Copy token URL to new profile",
      "Order not shown (404 without X-Gully-Order)", pri="P1", sev="Critical", auto=PW),
    c("Theme", "Dark/light", "Theme toggle on every top bar persists", "Toggle > reload", "Theme kept; readable",
      pri="P3", sev="Minor", auto=PW),
    c("Responsive", "Viewports", "No horizontal scroll at 320/375/768/1280px", "Visit main pages at each width",
      "scrollWidth <= clientWidth", pri="P2", auto=PW),
    c("A11y", "Keyboard", "Menu add and checkout reachable by keyboard", "Tab through", "Visible focus; Enter works",
      pri="P3", auto=PW),
    c("A11y", "Labels", "Icon-only buttons have accessible names", "Scan buttons", "Each has a name", pri="P3",
      auto=PW),
    c("Offline", "Network", "Offline place order shows offline message", "context.setOffline > place",
      "'No internet connection...'", pri="P2", auto=PW),
    c("GullyPulse", "Feed", "Feed loads; empty state", "Open /confessions", "Feed or 'No confessions yet'",
      pri="P3", api="GET /confessions/feed", auto=PW),
    c("GullyPulse", "Post", "Post needs an order key; blocked words refused", "Post with/without order",
      "Locked screen without order; BLOCK words refused", pri="P2", api="POST /confessions", auto=PW),
    c("GullyPlay", "Games", "Each game opens, plays, submits a score", "Token > Play > each game",
      "Results + leaderboard", pri="P3", api="POST /games/:game/scores", auto=PW),
    c("GullyPlay", "Rules", "Game engines are deterministic per IST day", "node --test src/game/*.test.js",
      "All pass", pri="P2", status="Passed", auto="Automated (customer-app/src/game/*.test.js)",
      actual=f"35/35 passed on {RUN}"),
]

# ---------------------------------------------------------------- ADM
CASES["ADM"] = [
    c("Auth", "Login", "Admin logs in with email + password", "Login page > submit", "Dashboard", pri="P1",
      sev="Critical", data="QA admin account", api="POST /admin/login", auto=PW),
    c("Auth", "Login", "Wrong password shows generic error", "Wrong password", "'Invalid email or password'",
      pri="P1", api="POST /admin/login", auto=PW),
    c("Auth", "Login", "Empty fields validated", "Submit empty", "Validation, no request or 400", pri="P3", auto=PW),
    c("Auth", "Rate limit", "Repeated failed logins are limited", "Wrong password many times", "429 message",
      pri="P2", api="POST /admin/login (loginLimit)", auto="Planned (API)"),
    c("Auth", "Guard", "Protected routes redirect to login when signed out", "Open /owners signed out",
      "Redirect to /login", pri="P1", sev="Critical", auto=PW),
    c("Auth", "Expiry", "Expired/cleared cookie on a page", "Delete cookie > navigate",
      "API 401 > back to login, no blank page", pri="P1", auto=PW),
    c("Auth", "Logout", "Logout clears session", "Log out > Back", "Login page; data not visible", pri="P1", auto=PW),
    c("RBAC", "Non-admin token", "Vendor JWT cannot call admin APIs", "Call /admin/overview with vendor token",
      "403", pri="P1", sev="Critical", api="adminOnly", auto="Planned (API)"),
    c("RBAC", "CSRF", "Cookie not accepted on writes from another origin", "POST suspend with cookie, foreign Origin",
      "401", pri="P1", sev="Critical", api="auth.js isAdminOrigin", auto="Planned (API)"),
    c("Dashboard", "KPIs", "Overview numbers match API and DB", "Open dashboard", "GMV = sum PAID+SERVED totalPrice",
      pri="P1", api="GET /admin/overview", auto=PW),
    c("Dashboard", "Charts", "Revenue and orders charts render with data", "Open dashboard", "Charts render",
      pri="P2", api="GET /admin/series", auto=PW),
    c("Owners", "List", "Owners list loads, search by name/phone/ID", "Owners > search", "Filtered rows",
      pri="P2", api="GET /admin/owners", auto=PW),
    c("Owners", "Disable", "Disable vendor then enable", "Disable > confirm dialog > enable", "Status flips; logged in AdminAction",
      pri="P1", sev="Critical", api="POST /admin/owners/:id/disable|enable", auto=PW),
    c("Owners", "Reset PIN", "Reset vendor PIN shows new PIN once", "Reset PIN", "New PIN; old one fails", pri="P2",
      api="POST /admin/vendors/:id/reset-pin", auto=PW),
    c("Carts", "List", "Restaurants list: LIVE/PAUSED/ATTENTION/OFFLINE badges", "Open Restaurants",
      "Badge matches README mapping", pri="P1", api="GET /admin/carts", auto=PW),
    c("Carts", "Suspend", "Suspend and resume a cart", "Suspend > resume", "Cart PAUSED > back", pri="P1",
      sev="Critical", api="POST /admin/carts/:id/suspend|resume", auto=PW),
    c("Carts", "Resume guard", "Resume refused when vendor disabled", "Disable vendor > resume cart",
      "'Enable the vendor first.'", pri="P2", auto=PW),
    c("Carts", "Map", "Map shows carts at correct [lat,lng]", "Open map", "Pins in India, not swapped", pri="P2",
      auto=PW),
    c("Orders", "List", "Orders filter by status and pagination (cursor)", "Filter SERVED > next page",
      "Correct rows; no duplicates across pages", pri="P2", api="GET /admin/orders", auto=PW),
    c("Orders", "Bad cursor", "Malformed cursor", "?cursor=bad", "400 'Invalid cursor'", pri="P3",
      auto="Planned (API)"),
    c("Payments", "List", "Platform fee payments list", "Open Payments", "Statuses shown", pri="P2",
      api="GET /admin/payments", auto=PW),
    c("Payments", "Mark paid", "Mark fee paid (manual)", "Mark paid on cart with due fee",
      "Payment VERIFIED MANUAL; cart unlocks", pri="P1", api="POST /admin/carts/:id/mark-fee-paid", auto=PW),
    c("Collections", "Overdue", "Overdue list and reminder log", "Collections > reminder", "Reminder logged",
      pri="P2", api="/admin/insights/collections, /carts/:id/reminder", auto=PW),
    c("Insights", "Tabs", "Leakage, vendors, growth, operations load", "Each tab", "No error, data shown",
      pri="P3", auto=PW),
    c("Moderation", "Queue", "Moderation queue and counts", "Open Moderation", "Counts match queue", pri="P2",
      api="/admin/moderation/*", auto=PW),
    c("Moderation", "Actions", "Hide/restore and suspend poster", "Act on item", "Status changes; AdminAction row",
      pri="P2", auto=PW),
    c("Actions", "Audit log", "Every admin action is logged", "Do an action > Actions page", "Row with admin, time",
      pri="P2", api="GET /admin/actions", auto=PW),
    c("Feedback", "List", "Ratings and text feedback listed", "Open Feedback", "Rows match served orders",
      pri="P3", api="GET /admin/feedback", auto=PW),
    c("Export", "CSV", "CSV export downloads with correct columns", "Export on a list page", "File; columns; escaped commas",
      pri="P2", auto=PW),
    c("Responsive", "Viewports", "Usable at 375/768/1280px", "Open main pages", "No horizontal page scroll",
      pri="P3", auto=PW),
    c("Dishes", "Review list", "A new dish name used by 3 different carts appears on the Dishes page", "3 vendors add the same new item > open Dishes",
      "Row with 'Used by 3 carts', suggested spellings, look-alike dish", pri="P2", api="GET /admin/dishes", auto=PW),
    c("Dishes", "Find images", "Find images shows up to 5 Pixabay photos (or a clear message)", "Dishes > Find images",
      "Thumbnails with Pixabay credit, or 'no photos'", pri="P3", api="GET /admin/dishes/:id/images", auto=PW),
    c("Dishes", "Approve", "Approve with corrected spellings adds it to the common list", "Edit Hindi > Approve",
      "Success note; dish suggested to every vendor with that spelling", pri="P2", api="POST /admin/dishes/:id/approve", auto=PW),
    c("Dishes", "Merge", "Merge a name into an existing dish", "Type Pani Puri > Merge > confirm",
      "Becomes an alias; not tracked again", pri="P3", api="POST /admin/dishes/:id/merge", auto=PW),
    c("Dishes", "Reject", "Reject a vendor-specific name", "Reject > confirm", "Gone from the list", pri="P3",
      api="POST /admin/dishes/:id/reject", auto=PW),
]

# ---------------------------------------------------------------- API
CASES["API"] = [
    c("Vendors", "OTP", "send-otp / verify-otp validation and expiry", "node --test", "400/404/410 as coded",
      pri="P1", api="/vendors/*", **ran(f"{BE_T}/vendor.test.js")),
    c("Vendors", "Rate limit", "send-otp limited to 10 per phone per 15 min", "11 calls same phone",
      "429 on 11th", pri="P2", api="POST /vendors/send-otp", auto="Planned (API)"),
    c("Vendors", "PIN reset", "Reset vendor PIN by admin/onboarding", "node --test", "New PIN works",
      pri="P2", **ran(f"{BE_T}/resetVendorPin.test.js")),
    c("Access", "Cart access", "Owner vs staff vs admin vs stranger on cart routes", "node --test",
      "findOwnedCart/findManagedCart enforced", pri="P1", sev="Critical", **ran(f"{BE_T}/access.test.js")),
    c("Access", "No token", "Every auth route returns 401 without token", "Call each auth route", "401",
      pri="P1", sev="Critical", auto="Planned (API)"),
    c("Access", "Bad id", "Malformed ObjectId in URL returns 400 not 500", "GET /orders/order/abc", "400 Invalid ID",
      pri="P2", auto="Planned (API)"),
    c("Orders", "Create", "Prices come from server; qty bounds; OOS; closed cart", "node --test",
      "Rules enforced", pri="P1", sev="Critical", **ran(f"{BE_T}/orders.test.js")),
    c("Orders", "Tamper", "Customer cannot set status PAID, parcel or price", "POST with status:'PAID', price:1",
      "Ignored: PENDING, menu price", pri="P1", sev="Critical", auto="Planned (API)"),
    c("Orders", "Order key", "Order read/feedback/queue need X-Gully-Order", "Call without/with wrong key", "404",
      pri="P1", sev="Critical", auto="Planned (API)"),
    c("Orders", "Concurrency", "10 parallel create-order get unique order numbers", "Promise.all x10",
      "10 distinct orderNumbers", pri="P1", sev="Critical", api="Counter", auto="Planned (API)"),
    c("Orders", "Queue", "Queue order, ahead count, 12h window", "node --test", "Correct", pri="P2",
      **ran(f"{BE_T}/queue.test.js")),
    c("Menu", "CRUD", "Add/update/delete item, stock, transliteration", "node --test", "Rules enforced", pri="P1",
      **ran(f"{BE_T}/menu.test.js")),
    c("Menu", "Transliterate", "Names filled from FoodName, cache, words", "node --test", "Correct scripts", pri="P3",
      **ran(f"{BE_T}/transliterate.test.js")),
    c("Billing", "Fee lock", "Daily fee, grace, open bill, checkout replace, refunds", "node --test",
      "All billing tests pass", pri="P1", sev="Critical",
      **ran(f"{BE_T}/billing.test.js", ok=False,
            note="27/28 passed. 'an abandoned checkout doesn't change the lock: it follows the bill' failed: "
                 "isLocked true, expected false (billing.test.js:294) on the uncommitted cartPaymentLock.js")),
    c("Billing", "Overdue", "Overdue fees across days", "node --test", "Pass", pri="P1",
      **ran(f"{BE_T}/overdueFees.test.js")),
    c("Billing", "Lock middleware", "create-order 403 when cart has unpaid fees", "node --test", "403 with status",
      pri="P1", sev="Critical", **ran(f"{BE_T}/paymentLock.test.js")),
    c("Billing", "Webhook", "Webhook rejects bad signature; accepts raw-body HMAC", "POST webhook bad sig",
      "400 'Invalid webhook signature'", pri="P1", sev="Critical", auto="Planned (API)"),
    c("Sales", "Report", "Vendor sales report rules match GMV", "node --test", "Pass", pri="P1",
      **ran(f"{BE_T}/sales.test.js")),
    c("Staff", "Switch cart", "Switch staff between owner's carts only", "node --test", "Pass", pri="P2",
      **ran(f"{BE_T}/switchStaffCart.test.js")),
    c("Admin", "Controls", "Suspend/resume/disable/enable, audit", "node --test", "Pass", pri="P1",
      **ran(f"{BE_T}/adminControls.test.js")),
    c("Admin", "Insights", "Insight aggregations", "node --test", "Pass", pri="P2", **ran(f"{BE_T}/insights.test.js")),
    c("Confessions", "GullyPulse", "Post, like, report, ban, privacy of public output", "node --test", "Pass",
      pri="P2", **ran(f"{BE_T}/confessions.test.js")),
    c("Confessions", "Word filter", "BLOCK/REVIEW/ALLOW", "node --test", "Pass", pri="P2",
      **ran(f"{BE_T}/wordFilter.test.js")),
    c("Games", "Scores", "Limits match engine LIMITS; best per day; phone link", "node --test", "Pass", pri="P2",
      **ran(f"{BE_T}/games.test.js")),
    c("Security", "CORS", "Unknown Origin refused; no-Origin allowed", "Request with Origin: evil.com",
      "CORS error", pri="P1", auto="Planned (API)"),
    c("Security", "Body limit", "JSON body > 10kb refused", "POST 20kb body", "413", pri="P2", auto="Planned (API)"),
    c("Security", "NoSQL injection", "Operator objects in login fields", "{vendorIdentifier:{$gt:''}}",
      "400/401, never a login", pri="P1", sev="Critical", auto="Planned (API)"),
    c("Security", "JWT", "Tampered/expired/alg-none JWT", "Send bad tokens", "401", pri="P1", sev="Critical",
      auto="Planned (API)"),
    c("Realtime", "Socket rooms", "join_order only gets that order's events", "Two sockets, two orders",
      "No cross-order events", pri="P1", auto="Planned (API)"),
    c("Health", "Live server", "Deployed backend responds", "GET /orders/get-truth-line", "200", pri="P2",
      auto="Planned (API)"),
    c("Dishes", "Tracking", "New dish names are counted once per cart; listed dishes and aliases are never tracked", "node --test",
      "Shown for review only at 3 carts; vendors' typed spellings win", pri="P2", **ran(f"{BE_T}/dishes.test.js")),
    c("Dishes", "Image to S3", "Approve copies the picked Pixabay photo to S3 dish-images/<slug>.jpg", "node --test (Pixabay and S3 stubbed)",
      "Key stored on the dish; search reused from cache", pri="P2", **ran(f"{BE_T}/dishes.test.js")),
    c("Dishes", "No arbitrary URLs", "Only an image from the server's own Pixabay search can be uploaded", "Approve with unknown id / a URL",
      "400; nothing uploaded", pri="P1", sev="Critical", **ran(f"{BE_T}/dishes.test.js")),
    c("Dishes", "Admins only", "Dishes routes refuse vendors and anonymous calls", "Call with no token / vendor token",
      "401 / 403", pri="P1", sev="Critical", **ran(f"{BE_T}/dishes.test.js")),
]

# ---------------------------------------------------------------- E2E
E = "Planned (Playwright + API)"
CASES["E2E"] = [
    c("Onboarding", "Onboard to QR", "Cart created in onboarding appears in admin and opens from QR",
      "API: OTP > create cart > location > menu > QR; admin Restaurants; open QR URL",
      "Admin lists cart; customer sees menu", pri="P1", sev="Critical",
      api="FLT-ONB > API > ADM > RCT", auto=E),
    c("Ordering", "Order lifecycle", "Customer order flows to vendor and back",
      "RCT place order > vendor marks paid > preparing > served", "Token page steps update live; vendor list updates",
      pri="P1", sev="Critical", api="RCT > API > FLT-VEN > RCT", auto=E),
    c("Ordering", "Admin sees order", "Placed and paid order shows in admin Orders and GMV", "After lifecycle",
      "Order row; GMV increases by totalPrice", pri="P1", api="RCT > ADM", auto=E),
    c("Ordering", "Duplicate submit", "Double place order creates one order everywhere", "Double-click > check vendor+admin",
      "One order", pri="P1", sev="Critical", auto=E),
    c("Ordering", "Stock", "Vendor marks item out of stock; customer can't order it", "FLT-VEN stock off > RCT",
      "Item disabled / 400 out of stock", pri="P1", auto=E),
    c("Ordering", "Price change", "Vendor changes price; open order keeps old price, new order uses new",
      "Change price mid-order", "Server prices consistent", pri="P2", auto=E),
    c("Admin control", "Suspend cart", "Admin suspends cart: customer and vendor orders refused; resume restores",
      "ADM suspend > RCT order > vendor manual order > resume", "403 both; then OK", pri="P1", sev="Critical", auto=E),
    c("Admin control", "Disable vendor", "Admin disables vendor: vendor and staff sessions cut off",
      "ADM disable > vendor/staff API call", "401 disabled; login refused", pri="P1", sev="Critical", auto=E),
    c("Admin control", "Reset PIN", "Admin reset PIN: old PIN fails, new PIN logs into vendor app", "ADM reset > login",
      "Works", pri="P2", auto=E),
    c("Billing", "Lock and pay", "Unpaid yesterday fee locks cart; admin mark-paid unlocks; customer can order",
      "Seed yesterday order > status > mark paid > order", "Locked > unlocked", pri="P1", sev="Critical", auto=E),
    c("Billing", "Fee totals", "Vendor Sales, admin Revenue and payment amount agree", "Compare 3 views",
      "Same fee total", pri="P1", auto=E),
    c("Staff", "Staff limits", "Staff can serve orders but not edit menu or see sales", "Staff token on routes",
      "Orders OK; owner routes 403", pri="P1", auto=E),
    c("Feedback", "Rating", "Customer rating appears in admin Feedback", "Serve > rate > admin", "Row shows stars + text",
      pri="P2", auto=E),
    c("Moderation", "Report hides", "4 unique reports hide a confession; admin restores", "Report x4 > feed > admin",
      "Hidden then visible", pri="P2", auto=E),
    c("Realtime", "Cross-app sync", "Vendor and customer see same status within 2 s", "Toggle on vendor",
      "Customer updates via socket", pri="P1", auto=E),
    c("Consistency", "Data parity", "Order totals equal across RCT, vendor API and admin API", "Fetch same order 3 ways",
      "Identical totals and items", pri="P1", auto=E),
]

# ---------------------------------------------------------------- results of the Playwright run
# customer-app/e2e (npx playwright test) on RUN: local backend on the live DB, Chromium.
PWR = "customer-app/e2e"
PASS = {
    "RCT": {1: "customer", 2: "customer", 3: "customer", 4: "customer", 5: "customer", 7: "customer",
            8: "customer", 9: "customer", 10: "customer", 12: "customer", 13: "customer", 14: "customer",
            17: "customer", 18: "customer", 19: "customer", 21: "customer", 22: "customer", 23: "customer",
            24: "customer", 25: "customer", 26: "customer", 27: "customer"},
    "ADM": {31: "admin", 32: "admin", 33: "admin", 34: "admin", 35: "admin", 1: "admin", 2: "admin", 3: "admin", 4: "api", 5: "admin", 7: "admin", 8: "api", 9: "api",
            11: "admin", 16: "admin", 20: "api", 24: "admin", 29: "admin"},
    "API": {2: "api", 5: "api", 6: "api", 8: "api", 9: "api", 10: "api", 17: "api", 25: "api", 26: "api",
            27: "api", 28: "api", 29: "api", 30: "z-deployed"},
    "E2E": {1: "cross-app", 2: "cross-app", 3: "cross-app", 4: "cross-app", 5: "cross-app", 6: "cross-app",
            7: "cross-app", 8: "cross-app", 9: "cross-app", 12: "api", 13: "cross-app", 15: "cross-app",
            16: "cross-app"},
}
NOTES = {
    ("RCT", 11): ("Failed", "Passed in 2 earlier runs; failed in the full run: order created, then loading it returned "
                            "500 'write ECONNABORTED' (backend lost its Atlas connection for a moment). Raw error shown "
                            "to the customer: BUG-006"),
    ("RCT", 13): ("Passed", "Server refuses with 'This cart is not taking orders right now'. The cart page still shows "
                            "Place order enabled from the cached open state: BUG-004"),
    ("ADM", 6): ("Failed", "After the cookie is gone, /orders shows 'Your session has expired. Please log in again.' "
                           "inline and stays on /orders; no logout, no redirect: BUG-002"),
    ("ADM", 30): ("Failed", "At 375px /orders scrolls sideways by 7px: the All/Pending/Preparing/Served/Cancelled "
                            "filter overflows its card: BUG-003"),
    ("ADM", 16): ("Passed", "Suspend/resume dialogs work; a customer order is refused with 403 while suspended"),
    ("E2E", 8): ("Passed", "Owner and staff sessions get 401 'account has been disabled' (was 403 before the BUG-005 "
                           "fix); PIN login 403; customer orders 403"),
    ("E2E", 12): ("Passed", "Staff: orders today, mark paid, serve OK; sales, menu add, cart edit, add staff 403. "
                            "Staff CAN list co-workers (GET get-all-staff, no PINs): NEEDS-DECISION-1"),
    ("E2E", 6): ("Passed", "Old price kept on edit, new price on new order. update-menu-item answers 201, not 200"),
    ("E2E", 15): ("Passed", "Customer token page showed Paid < 2 s after the vendor call"),
    ("E2E", 1): ("Passed", "Needed the carts.location 2dsphere index dropped first: BUG-001"),
    ("API", 14): ("Failed", "billing.test.js:289 'an abandoned checkout doesn't change the lock' (isLocked true, "
                            "expected false). Test defect TD-1: the lock is due 26h after yesterday began = 02:00 IST "
                            "today, so the test only passes between 00:00 and 02:00 IST"),
    ("FLT-VEN", 31): ("Failed", "language_test.dart:59: test defect TD-2. scrollUntilVisible leaves the Hindi tile "
                                "under the footer's Save button, so the tap hits the footer and nothing is selected"),
    ("FLT-VEN", 5): ("Not Run", "Not run on a device. BUG-005 fixed on the server (401 for disabled sessions); "
                                "the app's 401 logout is covered by session_test.dart"),
}

BUGS = [
    ("BUG-001", "API / deploy", "High", "P1",
     "Live DB still has the carts.location 2dsphere index, and the deployed backend (main) recreates it every time "
     "it starts. With it, this branch's create-basic-cart fails: 500 \"Can't extract geo keys ... unknown GeoJSON "
     "type: { coordinates: [] }\". Main itself still creates carts (checked: 201).",
     "Any vendor onboarding on this branch while the index exists",
     "Deploy the branch, then run `node -r dotenv/config scripts/drop-cart-geo-index.js` right after (not before: "
     "main rebuilds it on every cold start). E2E setup drops it before each run.", "E2E-001, setup"),
    ("BUG-002", "ADM", "Major", "P2",
     "Expired admin session does not log out: pages show 'Your session has expired' inline and the admin stays on "
     "the page with empty tables.", "ADM-006", "Make the 401 path dispatch logout (services/api.js says authSlice "
     "does this; it doesn't for page loads).", "ADM-006"),
    ("BUG-005", "FLT-VEN + API", "Major", "P2",
     "A vendor disabled by an admin while signed in stays signed in: every call fails with 403 'account has been "
     "disabled' but the app only logs out on 401.", "E2E-008 (API), code review",
     "Log out on 403 with the disabled message too (or have auth.js answer 401 for disabled sessions).", "FLT-VEN-005"),
    ("BUG-006", "API", "Major", "P2",
     "500 responses send the raw internal error text to clients: customers saw 'write ECONNABORTED'; the geo error "
     "returned the whole cart document (ids, userId).", "RCT-011, BUG-001",
     "errorHandler: for 500s send a generic message and log the real one.", "middlewares/errorHandler.js"),
    ("BUG-004", "RCT", "Minor", "P3",
     "The cart page uses the open/closed state cached from the menu: if the vendor closes the cart, Place order "
     "stays enabled and only the server's 403 stops it.", "RCT-013",
     "Refetch the cart on the cart page (or on Place order failure 403, refresh state).", "pages/CustomerCart.jsx"),
    ("BUG-003", "ADM", "Minor", "P3",
     "Orders page scrolls sideways at 375px (7px): the status filter is wider than its card.", "ADM-030",
     "Let the filter wrap or scroll inside the card.", "pages/Pages.jsx Orders"),
    ("BUG-007", "FLT-VEN", "Major", "P2",
     "After the first order alert, audioplayers' frame-based position updater kept scheduling frames after the "
     "sound ended, so the vendor app redrew every frame while open (battery drain on all-day phones).",
     "Device test on vivo I2219 (2 frame callbacks still live 20 s after the sound)",
     "Players are created with positionUpdater = null (nothing reads the position).",
     "ordering/lib/core/utils/order_alerts.dart"),
    ("BUG-008", "FLT-ONB", "Major", "P2",
     "ENABLE LOCATION could spin forever: the phone's reverse geocoder has no time limit; and with no address the "
     "server refuses the location, so onboarding could not continue.",
     "Device test on vivo I2219", "8 s limit on placemarkFromCoordinates; coordinates sent as the address when "
     "none is found.", "frontend enable_location_screen.dart, onboarding cart_service.dart"),
    ("TD-1", "API test", "Minor", "P2", "billing.test.js:289 is time-dependent (passes only 00:00-02:00 IST).",
     "API-014", "Freeze the clock or build the fixture relative to the 26h rule.", "backend/test/billing.test.js"),
    ("TD-2", "FLT-VEN test", "Minor", "P3", "language_test.dart taps a tile hidden under the footer.", "FLT-VEN-031",
     "Scroll a little further (or ensureVisible + alignment) before tapping.", "ordering/test/language_test.dart"),
    ("NEEDS-DECISION-1", "API", "-", "-", "Staff can list their cart's staff (names, phones; no PINs): get-all-staff "
     "uses findManagedCart. Fine if the Handover/staff view needs it; otherwise switch to findOwnedCart.",
     "E2E-012", "Your call", "cartController.getAllStaff"),
    ("NEEDS-DECISION-2", "FLT-ONB", "-", "-", "The onboarding app always opens on sign-up: a staff member who "
     "closes it mid-onboarding must log in again (the token is saved but never used at start). Fine if each "
     "session is one vendor; otherwise the splash should go to Your Carts when a token exists.", "FLT-ONB-035",
     "Your call", "splash_screen.dart"),
    ("BUG-009", "FLT-ONB", "Minor", "P3", "Saved addresses repeated parts (C8-810, C8-810, Gachibowli...) when the "
     "phone's geocoder returns the same name and street.", "Device run on the I2219", "buildAddress keeps each part once.",
     "frontend core/utils/build_address.dart"),
    ("OBS-2", "FLT-ONB", "Minor", "P3", "The onboarding app never handles a 401: an expired login shows errors or the "
     "old list instead of signing out (the vendor app signs out on 401).", "FLT-ONB-056",
     "Sign out to sign-up on a 401, like the vendor app.", "frontend core/error/app_exceptions.dart"),
    ("OBS-1", "FLT-ONB", "Minor", "P3", "A disabled vendor is still sent an OTP (send-otp doesn't check disabledAt); "
     "verify then refuses. Harmless, but wastes an SMS.", "FLT-ONB-007", "Check disabledAt in sendOtp too.",
     "vendorController.sendOtp"),
    ("BUG-010", "FLT-VEN", "Minor", "P3",
     "An undo confirmation ('Order restored', 'Payment reverted', 'Serve reverted') could vanish after about a second: "
     "each Undo snackbar started a 3 s timer that hid whatever snackbar was showing by then.",
     "Emulator run of vendor_orders_test.dart", "SnackBars get persist: false (an action made them stay up since "
     "Flutter 3.29, which is why the timers existed); the timers are gone.",
     "ordering core/widgets/app_snack_bar.dart, orders_screen.dart"),
    ("BUG-011", "FLT-VEN", "Minor", "P3",
     "Change PIN showed the wrong message: with every field empty, 'New PIN cannot be same as current PIN' "
     "replaced 'New PIN is required' (two empty strings compared equal); a filled new PIN with an empty "
     "confirm said 'PIN does not match' instead of 'Confirm your PIN'.",
     "Emulator run of vendor_profile_test.dart (code read first)",
     "Each field's checks run in order and stop at the first that fails.",
     "ordering profile/presentation/change_pin_screen.dart"),
    ("BUG-012", "FLT-VEN", "Minor", "P2",
     "Orders Overview labelled orders with the last 6 characters of the database id (#c86526) instead of the "
     "token number (#1) that the Orders page and the customer's token page show, so the vendor can't match them.",
     "Emulator run of vendor_profile_test.dart", "Show both: '#1 · 86526' (token numbers repeat across days, so "
     "the id's last 5 characters tell orders apart).",
     "ordering orders/widgets/orders_overview_card.dart"),
    ("BUG-013", "FLT-VEN", "Major", "P2",
     "The app never re-read the selected cart from the server: after an admin suspended (and so closed) a cart, "
     "Profile kept saying 'Cart Open' while customers were refused.",
     "Emulator run of vendor_cart_test.dart (FLT-VEN-085)",
     "CartProvider.refreshSelectedCart, called when the Profile tab opens and when the app comes back.",
     "ordering cart_provider.dart, home_screen.dart"),
    ("BUG-014", "FLT-VEN", "Major", "P2",
     "Sales: when loading a new date range failed (no internet), the screen kept the previous range's numbers "
     "under the new range's label (Yesterday's Rs0 shown as 'Last 7 Days'), with only a snackbar.",
     "Emulator run of vendor_misc_test.dart (FLT-VEN-093)",
     "CartProvider.loadSales drops the old numbers when a different range fails, so the screen shows "
     "'Couldn't load sales' + Retry; a failed refresh of the same range keeps them.",
     "ordering cart_provider.dart"),
    ("BUG-015", "FLT-VEN", "Major", "P2",
     "Battery: the green 'Live' dot on Orders pulsed forever (AnimationController.repeat()), so the app redrew "
     "the screen every frame all day while open (same class as BUG-007).",
     "Emulator run of vendor_edge_test.dart: frames scheduled 10/10 samples while idle",
     "Three pulses when it goes live, then a still dot; it pulses again after a reconnect.",
     "ordering orders_screen.dart (_LiveBadge)"),
    ("BUG-016", "FLT-VEN", "Minor", "P2",
     "After a successful fee payment the 'Payment done!' dialog closed itself with maybePop() on whatever route was "
     "on top; returning from Razorpay can rebuild the stack at that moment, so the pop hit a route being torn down "
     "(Flutter assertion 'scope != null'; it could also close the wrong screen).",
     "Emulator run of vendor_fees_test.dart", "The timer removes only the dialog's own route, if it is still active.",
     "ordering payment_lock_screen.dart (_showPaidDialog)"),
    ("OBS-5", "FLT-VEN", "Minor", "P3", "Plurals: Sales says '1 ratings' and 'QR · 1 orders' (the ARB strings "
     "have no plural form).", "vendor_sales_test.dart", "Use ICU plurals in ratingCount / qrOrdersSummary / "
     "manualOrdersSummary (all four languages).", "ordering lib/l10n/app_*.arb"),
    ("NEEDS-DECISION-3", "FLT-VEN + API", "-", "-", "A Rs0 menu item: Add Item and the server accept price 0, but "
     "the vendor app's Edit Item and the onboarding app refuse it ('Please enter a valid price'). Allow it "
     "everywhere (free add-ons) or refuse it everywhere (server: price > 0)?", "vendor_menu_test.dart, FLT-ONB-047",
     "Your call", "add_new_item.dart, edit_menu_dialog.dart, cartController menuItemFields"),
    ("OBS-3", "FLT-VEN", "Minor", "P3", "The fee lock screen titles the bill 'TODAY SUMMARY' even when it covers "
     "earlier days (seen with a bill from 2 days before).", "vendor_fees_test.dart", "Say 'Unpaid bill' or show the dates.",
     "payment_lock_screen.dart (todaySummaryCaps)"),
    ("OBS-4", "FLT-VEN", "Minor", "P3", "Razorpay checkout asks the vendor for their mobile number every time: "
     "the app sends no prefill.", "vendor_fees_test.dart", "Send prefill.contact = the vendor's phone in the checkout options.",
     "paymentController buildCheckoutPayload / payment_lock_screen.dart"),
    ("ENV-2", "Environment", "-", "-", "After hours of runs the emulator's GPU failed (Impeller: max texture size 0, "
     "SIGSEGV), then the app hit ANRs starting the geolocator service with the PC short of RAM; a cold restart "
     "with -gpu host crash-looped. Restart the PC/emulator before long runs.", "vendor_profile_test.dart", "-", "-"),
    ("ENV-1", "Environment", "-", "-", "Atlas (M0) connections take 10-50 s from this machine; one write dropped "
     "mid-run (RCT-011).", "all", "Expect occasional flakes on the free cluster.", "-"),
]

FIXED = {
    "BUG-001": "Fixed: Cart.location.coordinates has no default [], so new carts save no location and the old "
               "index skips them. Retest: 60/60 with the index present. Still drop it after deploy (NE India coords).",
    "BUG-002": "Fixed: every 401 fires admin:session-expired, store logs out. Retest: ADM-006 passed",
    "BUG-003": "Fixed: Seg scrolls inside its card; header wrappers capped at card width. Retest: ADM-030 passed",
    "BUG-004": "Fixed: cart page refetches the cart on open and after a 403. Retest: RCT-013 passed",
    "BUG-005": "Fixed: auth.js answers disabled/missing accounts with 401, so the apps sign out. Retest: E2E-008 "
               "passed; backend access test updated. Not checked on a device",
    "BUG-006": "Fixed: errorHandler sends a generic message for unexpected errors and logs the real one. "
               "backend/test/errorHandler.test.js",
    "TD-1": "Fixed: compares the status with and without the pending payment. backend 174/174",
    "TD-2": "Fixed: picks Hindi through the search box. language_test.dart passed",
    "BUG-007": "Fixed. Retest on I2219: audio frame callbacks stop after the sound; vendor device flow passed",
    "BUG-008": "Fixed. Retest on I2219: onboarding device flow passed (location saved)",
    "OBS-2": "Fixed: a 401 while logged in signs out to sign-up (core/utils/session.dart via AppExceptionHandler); a wrong PIN still just shows its message. unauthorized_test.dart; seen on the I2219",
    "BUG-009": "Fixed: repeats dropped; address_test.dart + location_address_test.dart; seen fixed on the I2219",
    "NEEDS-DECISION-2": "Decided 2026-11-10: a logged-in staff member goes straight to Your Carts; back from it logs out "
                        "(next vendor). Done: splash_screen.dart, carts_screen.dart, auth_provider.dart",
    "OBS-1": "Fixed: sendOtp refuses a disabled vendor (403) before making a code. vendor.test.js; device FLT-ONB-007",
    "NEEDS-DECISION-1": "Decided 2026-11-10: kept by design (staff may see their cart's staff list)",
    "BUG-010": "Fixed. Retest on the emulator: both confirmations shown in vendor_orders_test.dart",
    "BUG-011": "Fixed. Retest on the emulator: all three messages, then each rule, in vendor_profile_test.dart",
    "BUG-012": "Fixed: shows '#<token> · <last 5 of id>'. Retest on the emulator: vendor_profile_test.dart passed",
    "NEEDS-DECISION-3": "Decided 2026-11-12: Rs0 is allowed everywhere (free add-ons); a blank price is still refused. Done: both edit dialogs, onboarding add_menu_screen; device tests updated",
    "OBS-4": "Fixed: checkout sends prefill.contact = the vendor's phone. Retest on the emulator: checkout opens on Payment Options (no contact page). A number Razorpay finds invalid is ignored",
    "BUG-016": "Fixed. Retest on the emulator: vendor_fees_test.dart passed fully automated (fail + pay)",
    "OBS-5": "Fixed: ICU plurals for ratingCount / qrOrdersSummary / manualOrdersSummary in en, kn, ta (hi has one form)",
    "BUG-015": "Fixed. Retest on the emulator: no frames scheduled while idle after an order alert (vendor_edge_test.dart)",
    "BUG-014": "Fixed. Retest on the emulator: offline range change showed 'Couldn't load sales.', Retry loaded it (vendor_misc_test.dart)",
    "BUG-013": "Fixed. Retest on the emulator: after the suspend, Profile showed Closed and the switch said paused (vendor_cart_test.dart)",
}
BLOCKED = {
    ("FLT-VEN", 98): "Needs Razorpay's webhook to reach the backend; it can't reach localhost (test on the deployed backend)",
    ("FLT-VEN", 100): "Needs a second, real payment for a paid bill via the webhook; not reachable from localhost",
    ("FLT-VEN", 96): "Pay early only exists between 00:00 and 02:00 IST (yesterday's bill before the lock)",
}
RETEST = {("RCT", 11), ("ADM", 6), ("ADM", 30), ("API", 14), ("FLT-VEN", 31)}

DEV = "Automated (device: {}/integration_test, vivo I2219, Android 15)"
DEVICE = {
    ("FLT-VEN", 1): "Passed on the I2219: phone + PIN, cart picker, Orders tab",
    ("FLT-VEN", 5): "Passed on the I2219: admin disabled the vendor; the next tap signed the app out to Login",
    ("FLT-VEN", 6): "Passed on the I2219: a web QR order appeared over the socket with no refresh",
    ("FLT-VEN", 9): "Passed on the I2219 for MARK PAID (server PAID); unpaid toggle not run",
    ("FLT-VEN", 35): "Passed on the I2219: an order placed while paused showed after resume",
    ("FLT-ONB", 8): "Passed on the I2219: PIN login to Your Carts",
    ("FLT-ONB", 10): "Passed on the I2219: reopening a half-done cart and CONTINUE resumed at location",
    ("FLT-ONB", 12): "Passed on the I2219: + ADD NEW OUTLET, name, city, CONTINUE; cart on the server",
    ("FLT-ONB", 17): "Passed on the I2219 with a real camera photo taken by a person; uploaded to S3 and saved",
    ("FLT-ONB", 20): "Passed on the I2219: real GPS, confirm, location saved (after BUG-008 fix; permission pre-granted)",
    ("FLT-ONB", 27): "Passed on the I2219: item added in the UI, saved on the server",
    ("FLT-ONB", 31): "Passed on the I2219: poster generated the QR (qrImageUrl on the server)",
    ("FLT-ONB", 1): "Passed on the I2219 with a person: SEND OTP opened Messages with the code (an app chooser "
                    "first: Messages or vivo EasyShare); vendor created on the server",
    ("FLT-ONB", 2): "Passed on the I2219: '12345' refused with 'Please enter a valid 10-digit mobile number'",
    ("FLT-ONB", 5): "Passed on the I2219 with a person typing the real OTP; landed on Your Carts",
    ("FLT-ONB", 14): "Passed on the I2219: renamed an existing cart; server has the new name and still one cart",
    ("FLT-ONB", 25): "Passed on the I2219: deleted an item on review; not saved to the server",
    ("FLT-ONB", 28): "Passed on the I2219: two staff added; Messages opened with each PIN; both on the server",
    ("FLT-ONB", 29): "Passed on the I2219: duplicate number refused with 'User with this phone number already exists'",
    ("FLT-ONB", 30): "Passed on the I2219: asks first, issues a new PIN (old PIN then refused), opens Messages",
    ("FLT-ONB", 4): "Passed on the I2219: a staff member's number got 'This number belongs to a staff or admin account'",
    ("FLT-ONB", 7): "Passed on the I2219: admin-disabled vendor refused at SEND OTP (no code, no SMS) after the OBS-1 fix",
    ("FLT-ONB", 35): "Passed on the I2219 with real cold starts (normal debug build): logged in -> opens on Your Carts "
                     "and loads the cart; back -> sign-up and the saved login is cleared; reopening -> sign-up. "
                     "Also session_test.dart. One earlier cold start showed 'Couldn't load outlets' (Retry); not reproduced",
    ("FLT-ONB", 13): "Passed on the I2219 and in cart_details_test.dart (no request sent)",
    ("FLT-ONB", 19): "Passed on the I2219: 1st deny Location permission is required.; 2nd deny Permission permanently denied and app Settings opened; no crash",
    ("FLT-ONB", 34): "Passed on the I2219: sun/moon toggle flips the theme and the icon",
    ("FLT-ONB", 36): "Passed on the I2219: Check your internet connection shown, stayed on Cart Details, no duplicate cart, worked once back",
    ("FLT-ONB", 39): "Passed on the I2219: Change returned to sign-up with the number still filled",
    ("FLT-ONB", 40): "Passed on the I2219: Resend unlocked after 2 min, opened Messages, countdown restarted",
    ("FLT-ONB", 42): "Passed on the I2219 with a person: retake cleared the photo, second photo uploaded",
    ("FLT-ONB", 43): "Passed on the I2219: Camera permission is required.; then Allow worked",
    ("FLT-ONB", 44): "Passed on the I2219: Location services are disabled message, Settings opened, came back",
    ("FLT-ONB", 46): "Passed in location_address_test.dart (coordinates sent when no address). On the phone the geocoder answered from cache even offline",
    ("FLT-ONB", 47): "Passed on the I2219: blank and price 0 both refused",
    ("FLT-ONB", 48): "Passed on the I2219: server has isVeg=false",
    ("FLT-ONB", 49): "Passed on the I2219: mas suggested Masala Dosa, picked",
    ("FLT-ONB", 50): "Passed on the I2219: Enter a valid 10-digit number",
    ("FLT-ONB", 51): "Passed on the I2219: beta filtered; zzz showed No outlets found matching",
    ("FLT-ONB", 52): "Passed on the I2219: new cart appeared after pull-down",
    ("FLT-ONB", 53): "Passed on the I2219: three carts listed with ACTIVE / SETUP INCOMPLETE",
    ("FLT-ONB", 54): "Passed on the I2219: finished cart opened at SHARE QR",
    ("FLT-ONB", 55): "Passed on the I2219: share sheet opened; BACK TO OUTLETS returned to Your Carts",
    ("FLT-ONB", 57): "Passed on the I2219: the location-onward and camera runs used 1.3x system text with no layout errors",
    ("FLT-ONB", 6): "Passed on the I2219: wrong code Invalid OTP; a real code past its expiry OTP expired; then the right code signed in",
    ("FLT-ONB", 16): "Passed on the I2219: CONTINUE with no city stays on Cart Details and creates no cart",
    ("FLT-ONB", 41): "Passed on the I2219: after 10 codes, SEND OTP showed 'Too many attempts. Please try again in 15 minutes.'; no SMS opened",
    ("FLT-ONB", 45): "Passed on the I2219: internet off before the screen opened; after GPS found the cart, 'Map unavailable' + Tap to retry; back online, retry drew the map",
    ("FLT-ONB", 56): "Passed on the I2219 after the OBS-2 fix: cold start with an invalid saved login -> Your Carts got a 401 -> signed out to sign-up, saved login cleared. unauthorized_test.dart",
    ("FLT-ONB", 37): "Passed on the I2219: Pani Puri 30 -> 35 on review; server has 35",
    ("FLT-ONB", 38): "Passed on the I2219: card removed at once (no confirmation asked); server keeps only the other",
}

for key, idx in PASS.items():
    for i, spec in idx.items():
        CASES[key][i - 1].update(status="Passed", auto=f"Automated ({PWR}/{spec}.spec.js)",
                                 actual=f"Passed on {RUN}")
for (key, i), (status, note) in NOTES.items():
    case = CASES[key][i - 1]
    case.update(status=status, actual=note)
    if key in ("RCT", "ADM", "E2E", "API") and not case["auto"].startswith("Automated"):
        case["auto"] = f"Automated ({PWR})"
    if (key, i) in RETEST:
        case.update(status="Passed", actual=f"First run: {note} | Retest after fix: passed")

NOTRUN = {}
for (key, i), note in NOTRUN.items():
    CASES[key][i - 1].update(actual=note)
for (key, i), note in BLOCKED.items():
    CASES[key][i - 1].update(status="Blocked", actual=note)
for (key, i), note in DEVICE.items():
    CASES[key][i - 1].update(status="Passed", actual=note,
                             auto=DEV.format("ordering" if key == "FLT-VEN" else "frontend"))

EMU_RUN = "Automated (emulator: ordering/integration_test, Pixel 3a, Android 14)"
EMULATOR = {  # 2026-11-12, vendor_flow_test.dart + vendor_orders_test.dart
    4: "Passed on the emulator: wrong PIN stayed on login",
    9: "Passed on the emulator: MARK PAID (server PAID), Undo (server PENDING)",
    16: "Passed on the emulator: Delete > Order cancelled (server CANCELLED) > Undo > Order restored (PENDING)",
    20: "Passed on the emulator: Out on the Stock page; a customer order got 'is out of stock'",
    37: "Passed on the emulator: Vendor ID + PIN, cart picker, Orders",
    38: "Passed on the emulator: both messages on empty fields; PIN 12 refused",
    48: "Passed on the emulator: QR tab shows only the QR order, Manual only manual ones",
    49: "Passed on the emulator: Active / QR / Manual / All empty messages on a fresh cart",
    54: "Passed on the emulator: Cancel kept it PENDING; Delete cancelled it",
    55: "Passed on the emulator for paid and cancel (serve undo not run); after the BUG-010 fix",
    61: "Passed on the emulator: MARK AS PAID -> PAID, SKIP -> PENDING; total = 30 + platform fee",
    63: "Passed on the emulator: the new-order sheet shows Pani Puri as Out of Stock",
    76: "Passed on the emulator: server isInStock false after Out",
    # vendor_staff_test.dart
    40: "Passed on the emulator: staff phone + PIN, cart, Orders",
    59: "Passed on the emulator: owner marked paid by API; staff card switched to SERVE live",
    95: "Passed on the emulator: staff see Handover, no Sales",
    23: "Passed on the emulator: Handover, owner rows hidden; sales-insights, add-menu-item, add-staff 403 for staff",
    105: "Passed on the emulator as staff: only Orders Overview etc.; no Payments/Menu/Staff, no cart edit",
    75: "Passed on the emulator: Menu Management hidden; add-menu-item 403",
    78: "Passed on the emulator: staff marked Masala Dosa Out; server isInStock false",
    # vendor_profile_test.dart (every step passed across runs; the last one is unconfirmed, see ENV-2)
    25: "Passed on the emulator: Sales total = the served order; API revenue the same",
    87: "Passed on the emulator: Total Revenue = paid orders only",
    91: "Passed on the emulator: '1 unpaid · Rs32' and '1 cancelled · Rs62'",
    122: "Passed on the emulator: no backend on MARK PAID and on SAVE CHANGES: 'Check your internet connection', nothing changed, works once back",
    21: "Passed on the emulator: Profile switch closed the cart; customer order 403 'not taking orders'",
    79: "Passed on the emulator: empty name refused; name + parcel 5 saved on the server",
    80: "Passed on the emulator: back with changes asks; Keep Editing stays",
    116: "Passed on the emulator: required / invalid messages; staff added; Messages opened with the PIN",
    117: "Passed on the emulator: 'User with this phone number already exists'",
    118: "Passed on the emulator: Remove asks; removed on the server",
    60: "Passed on the emulator: today's orders with counts (label format changed after, see BUG-012)",
    103: "Passed on the emulator: 'No transactions in this period yet'",
    113: "Passed on the emulator: theme flips and darkTheme is saved",
    33: "Passed on the emulator: 'Incorrect current PIN'",
    108: "Passed on the emulator after the BUG-011 fix: required, 4 digits, mismatch, same as current",
    115: "Passed on the emulator: LOG OUT -> Login; token cleared",
    43: "Passed on the emulator: no backend at LOGIN: internet message, stayed on Login",
    107: "Passed on the emulator: old PIN refused at login (API 401), new PIN logs in",
    # vendor_cart_test.dart
    44: "Passed on the emulator: picker lists both carts; pick + SWITCH CART opens that cart",
    10: "Passed on the emulator: a PENDING card has no SERVE; API serve -> 400 'paid' message",
    58: "Passed on the emulator: customer added an item (card total updated live) and cancelled another (left Active live)",
    12: "Passed on the emulator: Start preparing set preparingAt; chip shows Preparing",
    56: "Passed on the emulator: edit paid order +Pani Puri: 'Customer needs to pay Rs30 more', card 'Collect Rs30 from customer'",
    57: "Passed on the emulator: edited paid order is PENDING (partly paid) until the rest is collected",
    11: "Passed on the emulator: SERVE then UNDO -> 'Serve reverted', server PAID",
    13: "Passed on the emulator: manual order with parcel 10: total = 60 + 10 + fee",
    84: "Passed on the emulator: Cart Active off + SAVE -> customer order 403",
    85: "Passed on the emulator after the BUG-013 fix: suspended cart shows Closed; open switch -> 'paused by GullyEats'",
    47: "Passed on the emulator: cart selector -> second cart -> SWITCH CART; first cart's orders not shown",
    22: "Passed on the emulator: switched to the second cart, empty orders",
    39: "Passed on the emulator: disabled vendor login shows the 'disabled' message, stays on Login",
    # vendor_fees_test.dart (Razorpay test mode, test cards from razorpay.com/docs/payments/payments/test-card-details)
    64: "Passed on the emulator: create-order on a fee-locked cart -> 403",
    97: "Passed on the emulator: card 4100 2800 0007 0002 + Failure -> 'Payment failed. You can retry...'; still locked",
    30: "Passed on the emulator: card 4100 2800 0000 1007 + Success -> 'Payment done!', unlocked, payment VERIFIED (by hand, then automated by watch.sh + razorpay.sh after the BUG-016 fix)",
    # vendor_menu_test.dart
    53: "Passed on the emulator for a 2-line order (items, total); '+N more' (4+ lines) not covered",
    62: "Passed on the emulator: 'dosa' filters the new-order sheet; 'zzz' -> 'No menu items found'",
    65: "Passed on the emulator: SKIP / MARK AS PAID with no items create nothing",
    66: "Passed on the emulator: Menu Management search 'puri' filters; 'zzz' -> 'No menu items found'",
    67: "Passed on the emulator: required / too short / price required; price field drops '-' (digits only). Price 0 is accepted by design (NEEDS-DECISION-3)",
    69: "Passed on the emulator: Non-Veg + Out of Stock saved (isVeg false, isInStock false)",
    72: "Passed on the emulator: name + price updated; the earlier order keeps Rs60",
    73: "Passed on the emulator: 'Item name cannot be empty' and 'Please enter a valid price' (blank; Rs0 allowed since NEEDS-DECISION-3)",
    74: "Passed on the emulator: CANCEL keeps it; DELETE removes it; the old order keeps the line",
    77: "Passed on the emulator: Out of Stock / In Stock / All Items filters and search",
    # vendor_misc_test.dart
    41: "Passed on the emulator: Forgot PIN? and Contact Support show the support sheet (text only, no dialer)",
    45: "Passed on the emulator with 4 carts: search filters; 'zzz' -> 'No carts available'",
    46: "Passed on the emulator: no backend on the welcome screen -> 'Check your internet connection' + RETRY; Retry worked once back",
    86: "Passed on the emulator: Today shows the paid order, Yesterday empty, Last 7 Days includes today",
    93: "Passed on the emulator after the BUG-014 fix: 'No orders in this period yet'; offline 'Couldn't load sales.' + Retry",
    106: "Passed on the emulator: VIEW QR opens the QR Code Poster (share not run)",
    109: "Passed on the emulator: 'Please contact support at ... to reset your PIN'",
    119: "Passed on the emulator: staff menu > Switch Cart > second cart > CONFIRM SWITCH; server has them on cart 2",
    120: "Passed on the emulator in part: with 4+ staff the search box shows and filters; the no-match message is not checked",
    114: "Passed on the emulator: Terms opened Chrome (ChromeTabbedActivity); Back returned to the app",
    110: "Passed on the emulator: Kannada and Tamil switch the UI and are saved (languageCode)",
    111: "Passed on the emulator: 'tam' shows Tamil only; 'kannada' finds Kannada",
    112: "Passed on the emulator: the order card shows Masala Dosa in Kannada script (names.kn)",
    124: "Passed on the emulator: in Kannada the SERVE button still served the order (server SERVED)",
    68: "Passed on the emulator: in Kannada, the 'name in your language' field saved names.kn",
    # vendor_edge_test.dart, vendor_sales_test.dart, font-scale runs, by hand on the emulator
    36: "Passed (API): update-cart refuses parcelCharge -5 and 'abc' with 400; the app's field takes digits only",
    51: "Passed on the emulator: Live; Wi-Fi + data off -> 'Reconnecting…'; back on -> Live; an order then arrived live",
    50: "Passed on the emulator in part: resuming while offline kept the list, no crash (the 'Couldn't load orders' + Retry state itself not reached)",
    123: "Passed on the emulator after the BUG-015 fix: no frames scheduled while idle after an order alert",
    121: "Passed on the emulator: flow, orders and cart tests at font_scale 1.3 and 1.5, no layout errors",
    88: "Passed on the emulator in part: 'Compared with the day before' + 'None before' (a paid day before would lock the cart)",
    89: "Passed on the emulator: Last 7 Days shows Daily sales, Busy Hours and 'Peak: 9PM'",
    90: "Passed on the emulator: Top Sellers 'Masala Dosa 2 sold'; Didn't sell lists Vada Pav",
    92: "Passed on the emulator: Customers 1, 'Overall rating 5.0/5', '1 ratings', latest feedback shown",
    94: "Passed on the emulator: 'QR · 1 orders · Rs122', 'Manual · 1 orders · Rs42', Avg Parcel Charge Rs10",
    101: "Passed on the emulator: no backend on PAY -> message, Razorpay did not open, still locked",
    42: "Passed on the emulator by hand: logged in, force-stopped, relaunched -> straight to Orders (Live)",
    2: "Passed on the emulator: 10 wrong PINs (API 401), then the right PIN in the app -> 'Too many attempts. Please try again in 15 minutes.'",
}
for i, note in EMULATOR.items():
    case = CASES["FLT-VEN"][i - 1]
    if case.get("status") != "Passed":
        case.update(status="Passed", actual=note, auto=EMU_RUN)

FILL = {"Passed": "C6EFCE", "Failed": "FFC7CE", "Blocked": "FFEB9C", "Not Run": "EDEDED"}
HDR = PatternFill("solid", fgColor="1F3864")
FONT = "Arial"


def build():
    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    for key, cases in CASES.items():
        ws = wb.create_sheet(key)
        ws.append(COLS)
        for i, x in enumerate(cases, 1):
            ws.append([f"{key}-{i:03d}", APPS[key], x["module"], x["feature"], x["scenario"], x["pre"],
                       x["steps"], x["data"], x["expected"], x["actual"], x["pri"], x["sev"], x["status"],
                       x["auto"], x["api"]])
        style(ws, len(cases))

    summary.append(["GullyEats ecosystem test inventory"])
    summary.append([f"Last execution: {RUN}. Only cases actually executed are marked Passed/Failed."])
    summary.append([])
    head = ["Sheet", "Application", "Total", "Executed", "Passed", "Failed", "Blocked", "Not Run",
            "Automated", "Automation %", "Critical open", "P1 open"]
    summary.append(head)
    start = summary.max_row + 1
    for r, key in enumerate(CASES, start):
        rng = lambda col: f"'{key}'!{col}2:{col}1000"
        summary.append([
            key, APPS[key],
            f"=COUNTA({rng('A')})",
            f"=E{r}+F{r}+G{r}",
            f'=COUNTIF({rng("M")},"Passed")',
            f'=COUNTIF({rng("M")},"Failed")',
            f'=COUNTIF({rng("M")},"Blocked")',
            f'=COUNTIF({rng("M")},"Not Run")',
            f'=COUNTIF({rng("N")},"Automated*")',
            f"=IF(C{r}=0,0,I{r}/C{r})",
            f'=COUNTIFS({rng("L")},"Critical",{rng("M")},"<>Passed")',
            f'=COUNTIFS({rng("K")},"P1",{rng("M")},"<>Passed")',
        ])
    end = summary.max_row
    t = end + 1
    summary.append(["Total", ""] + [f"=SUM({col}{start}:{col}{end})" for col in "CDEFGHI"]
                   + [f"=IF(C{t}=0,0,I{t}/C{t})", f"=SUM(K{start}:K{end})", f"=SUM(L{start}:L{end})"])
    bugs = wb.create_sheet("Bugs")
    bugs.append(["ID", "Area", "Severity", "Priority", "Defect", "Found by", "Suggested fix", "Where", "Status"])
    for b in BUGS:
        bugs.append(list(b) + [FIXED.get(b[0], "Open")])
    style_plain(bugs, [18, 14, 9, 8, 60, 22, 46, 26, 40])

    summary.append([])
    summary.append(["Legend: edit Actual Result, Execution Status (dropdown) and Automation Status on each sheet; "
                    "this summary recalculates. Regenerate from docs/qa/inventory.py."])
    for row in summary.iter_rows():
        for cell in row:
            cell.font = Font(name=FONT, bold=cell.row in (1, 4, t), size=14 if cell.row == 1 else 10,
                             color="FFFFFF" if cell.row == 4 else None)
            if cell.row == 4:
                cell.fill = HDR
            if cell.column == 10 and cell.row >= start:
                cell.number_format = "0%"
    for col, w in zip("ABCDEFGHIJKL", [10, 42, 8, 10, 8, 8, 9, 9, 11, 13, 13, 9]):
        summary.column_dimensions[col].width = w
    wb.save(OUT)
    print(f"wrote {OUT} ({sum(map(len, CASES.values()))} cases)")


def style_plain(ws, widths):
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    for row in ws.iter_rows():
        for cell in row:
            cell.font = Font(name=FONT, size=10, bold=cell.row == 1, color="FFFFFF" if cell.row == 1 else None)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if cell.row == 1:
                cell.fill = HDR
    ws.freeze_panes = "A2"


def style(ws, n):
    widths = [12, 22, 14, 18, 40, 24, 36, 18, 38, 38, 8, 10, 13, 26, 28]
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    for row in ws.iter_rows():
        for cell in row:
            cell.font = Font(name=FONT, size=10, bold=cell.row == 1, color="FFFFFF" if cell.row == 1 else None)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if cell.row == 1:
                cell.fill = HDR
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:O{n + 1}"
    dv = DataValidation(type="list", formula1='"Passed,Failed,Blocked,Not Run"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add(f"M2:M{n + 200}")
    for status, color in FILL.items():
        ws.conditional_formatting.add(f"M2:M{n + 200}", CellIsRule(operator="equal", formula=[f'"{status}"'],
                                                                     fill=PatternFill("solid", fgColor=color)))


if __name__ == "__main__":
    build()
