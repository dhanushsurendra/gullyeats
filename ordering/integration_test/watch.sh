#!/usr/bin/env bash
# Runs a device test and does what it asks on the PC side:
#   ">>> NET-OFF" removes the adb reverse (the app loses the backend; airplane
#                 mode would not, since it reaches the PC over adb),
#   ">>> NET-ON"  restores it,
#   ">>> RADIO-OFF" / ">>> RADIO-ON" turn the phone's Wi-Fi and mobile data off / on
#                 (the phone sees "no network"; open sockets over adb survive NET-OFF),
#   ">>> RAZORPAY FAIL" / ">>> RAZORPAY PAY" complete checkout with razorpay.sh (test cards),
#   ">>> KEY-BACK" logs the app in front (TOP ...), then presses Back once,
#   ">>> BACKDATE <cartId> [days]" moves that QA cart's orders back (an unpaid fee bill),
#   ">>> BACK"    presses Back until the Messages app the staff SMS opens is gone,
# and grants the notification permission when a test starts (the install
# resets it, and its prompt would sit over the app).
# Usage, from ordering/:  bash integration_test/watch.sh flutter test integration_test/<file> -d <device> ...
ADB=${ADB:-adb}
command -v "$ADB" >/dev/null || ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
set -o pipefail
"$@" 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  case "$line" in
    *">>> NET-OFF"*) "$ADB" reverse --remove tcp:5050 ;;
    *">>> NET-ON"*) "$ADB" reverse tcp:5050 tcp:5050 >/dev/null ;;
    *">>> RADIO-OFF"*) "$ADB" shell svc wifi disable; "$ADB" shell svc data disable ;;
    *">>> RADIO-ON"*) "$ADB" shell svc wifi enable; "$ADB" shell svc data enable ;;
    *">>> RAZORPAY FAIL"*) bash "$(dirname "$0")/razorpay.sh" 4100280000070002 failure ;;
    *">>> RAZORPAY PAY"*) bash "$(dirname "$0")/razorpay.sh" 4100280000001007 success ;;
    *">>> KEY-BACK"*)
      sleep 2; echo "TOP $("$ADB" shell dumpsys activity activities | grep -m1 topResumedActivity)"
      "$ADB" shell input keyevent 4 ;;
    *">>> BACKDATE "*)
      args=${line##*>>> BACKDATE }
      (cd "$(dirname "$0")/../../backend" && node scripts/qa.js backdate $args) ;;
    # After BACKDATE: ">>> BACK" would match it too.
    *">>> BACK"*)
      for _ in 1 2 3 4 5; do
        "$ADB" shell dumpsys activity activities | grep -m1 topResumedActivity | grep -q messaging || break
        "$ADB" shell input keyevent 4; sleep 1.5
      done ;;
    *": FLT-VEN"*) "$ADB" shell pm grant com.gullyeats.vendor android.permission.POST_NOTIFICATIONS 2>/dev/null ;;
  esac
done
status=$?
"$ADB" reverse tcp:5050 tcp:5050 >/dev/null # never leave the phone cut off
"$ADB" shell svc wifi enable; "$ADB" shell svc data enable
exit $status
