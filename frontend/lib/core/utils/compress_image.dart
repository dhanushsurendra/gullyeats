import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';

/// Where the compressed copy of [path] is written: same folder and name,
/// always a .jpg, and never the source path itself.
String compressedPath(String path) =>
    path.replaceFirst(RegExp(r'(\.\w+)?$'), '_compressed.jpg');

Future<File> compressImage(File file) async {
  final result = await FlutterImageCompress.compressAndGetFile(
    file.absolute.path,
    compressedPath(file.absolute.path),
    quality: 70,
    format: CompressFormat.jpeg,
  );

  // If the image can't be compressed, upload the original.
  return result == null ? file : File(result.path);
}
