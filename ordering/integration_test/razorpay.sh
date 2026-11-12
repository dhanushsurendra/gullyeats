#!/usr/bin/env bash
# Completes Razorpay's TEST checkout on the Pixel 3a emulator (990x2200 screen;
# the checkout is a WebView with no accessibility nodes, so this taps fixed
# points). Test cards: razorpay.com/docs/payments/payments/test-card-details
#   bash razorpay.sh <card number> success|failure [cards_y]
# The app prefills the vendor's phone, so checkout opens on Payment Options.
# Cards is the first row there (y 630); if Razorpay adds a "Recommended" block
# above it, pass 1162.
# shortcut: fixed coordinates for this emulator only; on another screen size, drive checkout by hand.
ADB=${ADB:-adb}
command -v "$ADB" >/dev/null || ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
tap() { "$ADB" shell input tap "$1" "$2"; sleep "${3:-1.5}"; }
type_() { "$ADB" shell input text "$1"; sleep 1; }

sleep 8 # checkout loads
tap 495 "${3:-630}" 3       # Cards
tap 495 602 1; type_ "$1"
tap 275 720 1; type_ 1230   # expiry 12/30
tap 714 720 1; type_ 123    # CVV
tap 124 2133 1.5            # hide the keyboard
tap 624 2040 6              # Continue
tap 495 1875 10             # "Maybe later" (don't save the card)
if [ "$2" = success ]; then
  tap 495 1015 10           # demo bank: Success
else
  tap 495 1180 10           # demo bank: Failure
  tap 923 866 2             # close "Payment could not be completed"
  "$ADB" shell input keyevent 4   # leave checkout: the app gets the error
fi
