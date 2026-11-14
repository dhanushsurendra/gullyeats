import 'package:flutter/widgets.dart';

/// Pixel width to decode a full-width photo preview at: phone photos and
/// uploads are larger than the screen, and decoding them whole costs memory.
int previewWidth(BuildContext context) =>
    (MediaQuery.sizeOf(context).width * MediaQuery.devicePixelRatioOf(context))
        .round();
