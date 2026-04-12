import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';

Future<File> compressImage(File file) async {
  final targetPath = file.path.replaceFirst('.jpg', '_compressed.jpg');

  final result = await FlutterImageCompress.compressAndGetFile(
    file.absolute.path,
    targetPath,
    quality: 70,
  );

  return File(result!.path);
}