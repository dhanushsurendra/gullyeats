# GullyEats Flutter UI guidelines

These rules come from the responsive and consistency work on the onboarding app (`frontend/`). The vendor app (`ordering/`) should follow them too. Its core widgets and theme are copies of the onboarding app's, so most of this ports directly. See [Porting to `ordering/`](#porting-to-ordering) at the end.

## Tokens

Always use the theme classes in `lib/core/theme/` instead of raw values.

| What | Use | Notes |
|---|---|---|
| Colors | `AppColors` | `primary` #FE5200, greys `grey100`–`grey600`, `success`, `error`. No `Colors.orange.shade50`, `Colors.redAccent[700]` and the like for UI chrome. Veg is green and non-veg is red: those are the only raw colors allowed. |
| Text | `AppTextStyles` | `heading1` 24 (screen title), `heading2` 18 (section), `heading3` 16 (card title, field label), `body` 14, `caption` 12, `button` 16. All Poppins. |
| Spacing | `AppGaps` (`h4`…`h48`, `w4`…`w16`) | Screen padding is `AppPadding.screen` (24). |
| Corner radius | 26 (buttons, `AppButton`) · 24 (search bar) · **16 (cards, panels, sheets' inner cards)** · **12 (inputs, info boxes, chips, small buttons)** · 6–8 (tiny tags) | Fully round "pill" labels are fine. Printable graphics (the QR poster) are exempt. |
| Shadows | Cards: black 2%, blur 10, offset (0, 4). Footer: black 5%, blur 10, offset (0, −4). | Prefer a `grey200` border over a heavier shadow. |

## Screen layout

- **Every screen uses `BaseScreen`.** It provides the SafeArea, 24px padding, the 500px maximum content width (so tablets don't stretch), and the header: back button, `heading1` title, `body` grey400 subtitle, then a 32px gap.
- The back arrow runs the screen's `onBack`. Pass `onBack` whenever leaving must do something (e.g. return data). The arrow appears only when `onBack` is set.
- **`expandToFullHeight: true`** gives the child a bounded height. The child must scroll itself: a `ListView` or a `SingleChildScrollView`. Never use a bare `Column` with `Spacer`; it overflows on small phones.
- When a window is shorter than 480px (keyboard open on a small phone, split screen), `BaseScreen` scrolls the header away and gives the child the whole viewport. Don't fight this with fixed heights.
- The app is portrait-only, but layouts must still survive short and wide windows: Android split screen ignores the orientation lock.

## Actions (buttons)

- **Step screens put their main action in `AppFooter`**, passed as `BaseScreen.bottomNavigationBar`. Buttons then sit in the same place on every screen, stay visible while content scrolls, and snackbars float above them instead of covering them.
  - **Order:** the primary (filled) button goes last, at the bottom. Secondary actions (outlined or dotted) go above it.
  - **Helper text:** one helper line ("Your photo is used only for verification.") goes in `AppFooter(note: …)`, not in the body.
- **Exception:** on screens where the action comes right after typing (login, OTP, inline forms such as "Add Helper"), keep the button directly under the fields, because the footer is hidden behind the keyboard.
- **Labels:** `AppButton` labels are UPPERCASE ("SAVE & CONTINUE", "+ ADD ITEM").
- **Height:** `AppButton` has a *minimum* height of 52 and the label wraps. Never give a button a fixed height, because large system text must fit.
- **Loading:** show it on the button (`isLoading`), and always clear it in `finally`.

## Feedback

| Situation | Use |
|---|---|
| Result of an action, or a network error | `AppSnackBar.show(context, message:, isError:)`. Never use a raw `ScaffoldMessenger.showSnackBar`. |
| Hint or explanation on a screen | `InfoBox(lines: [...], icon: ...)`: grey box, an icon per line. One component for all hints. |
| Field validation | Red inline text under the field, or the `TextFormField` validator. |
| A destructive or irreversible action (e.g. issuing a new PIN) | A confirm `AlertDialog` with Cancel / action. |

**Lists need three states besides content**, each drawn as a 64px `grey300` icon plus a one-line message:
- Loading: spinner on the first load only.
- Empty: "No outlets yet…", or for a search, "No … matching '…'".
- Failed: "Couldn't load …", plus a **Retry** button.

Add pull-to-refresh where data can change elsewhere.

## Content

- **Prices:** `formatPrice()` gives "₹60", not "₹60.0". Fields prefilled with a price must use it too: digits-only input turns "60.0" plus a typed "5" into "6005".
- **Addresses:** `joinAddressParts()`. Never interpolate nullable fields straight into text; it prints "null".
- **Long names:** cap names with `maxLines` and an ellipsis. People's names get 2 lines. Cart or item names on cards wrap fully where the user needs to read them, and get 1 line on posters.
- **Currency inputs:** show an always-visible "₹" prefix (as a `prefixIcon`) with "0" as the hint.

## Responsive rules

- No fixed heights on anything that holds text. Use minimum heights, and let content decide the size.
- Rows of small items (chips, an ID next to a status, a price next to a veg tag) use `Wrap`, so the second item drops to a new line instead of overflowing.
- Illustrations: `illustrationHeight(context, max)`, which scales with screen height. A fixed 180px pushes forms off small phones.
- Text inside a `Row` gets `Expanded` or `Flexible`.
- Support system text scale up to at least 1.5×. Fixed-size graphics that get printed or shared (the QR poster) use `MediaQuery.withNoTextScaling`.
- Width-derived font sizes must be clamped (see the splash screen).

## Async UI

- Check `mounted` before every `setState` or use of `context` after an `await`.
- Every HTTP request has a `.timeout(...)`: 10s by default, 30s when the server does heavy work (QR generation), 60s for file uploads.
- Screens that save as you go must not create duplicates when the user goes back and continues again. Remember what was created, and update it instead.

## Testing

- `test/responsive/` renders every screen at 6 sizes, plus landscape, the keyboard open, and 1.3×/1.5× text, and fails on any layout error. It also compares reference images (goldens) for 4 configurations. Add each new screen to its `screens` list.
- After an intended visual change, run `flutter test test/responsive --update-goldens`, look at the changed images, and commit them.
- Behaviour tests stub the network with `http.runWithClient` and `MockClient` (see `test/cart_details_test.dart`).

## Porting to `ordering/`

`ordering/` has its own copies of `BaseScreen`, `AppButton`, `AppBackButton` and `AppSnackBar` (import paths use `package:ordering`). Its `AppColors` also has a `warning` color. Steps:

1. **`BaseScreen`:** the short-window fallback (`_buildExpanded`, the 480px threshold) and the 500px footer cap.
2. **`AppBackButton`:** the `onPressed` parameter. Then pass `onBack` from `BaseScreen`.
3. **`AppButton`:** minimum height instead of a fixed one, `Flexible` labels, and 14px vertical padding on the dotted variant.
4. **`AppSnackBar`:** use `AppColors.error` and `AppColors.success`.
5. **New widgets:** copy `AppFooter`, `InfoBox`, `formatPrice`, `joinAddressParts` and `illustrationHeight`. Check ordering's own `compress_image.dart` against the fixed version before replacing it.
6. **Tests:** copy `test/responsive/harness.dart` and build a `screens` list for the ordering app. Then fix what it reports, screen by screen, using the rules above.
