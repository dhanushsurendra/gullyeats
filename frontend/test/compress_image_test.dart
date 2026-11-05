import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/core/utils/compress_image.dart';

void main() {
  test('compressedPath never equals the source, whatever the extension', () {
    expect(compressedPath('/cache/photo.jpg'), '/cache/photo_compressed.jpg');
    expect(compressedPath('/cache/photo.jpeg'), '/cache/photo_compressed.jpg');
    expect(compressedPath('/cache/photo.PNG'), '/cache/photo_compressed.jpg');
    expect(compressedPath('/data/com.example.app/cache/photo'),
        '/data/com.example.app/cache/photo_compressed.jpg');
  });
}
