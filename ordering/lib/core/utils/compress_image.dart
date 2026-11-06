import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';

Future<File> compressImage(File file) async {
  final directory = file.parent.path;
  final fileName =
      '${DateTime.now().millisecondsSinceEpoch}_compressed.jpg';

  final targetPath = '$directory/$fileName';

  final result = await FlutterImageCompress.compressAndGetFile(
    file.absolute.path,
    targetPath,
    minWidth: 1600,
    minHeight: 1600,
    quality: 85,
    format: CompressFormat.jpeg,
  );

  // If the image can't be compressed, upload the original.
  return result == null ? file : File(result.path);
}