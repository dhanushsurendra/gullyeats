import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

class QrService {
  static Future<Uint8List> generatePdfFromWidget(GlobalKey key) async {
    final boundary =
        key.currentContext!.findRenderObject() as RenderRepaintBoundary;

    final image = await boundary.toImage(pixelRatio: 3.0);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final pngBytes = byteData!.buffer.asUint8List();

    final renderBox = key.currentContext!.findRenderObject() as RenderBox;
    final size = renderBox.size;

    final pdf = pw.Document();
    final pdfImage = pw.MemoryImage(pngBytes);

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat(
          size.width * PdfPageFormat.point,
          size.height * PdfPageFormat.point,
          marginAll: 0,
        ),
        build: (pw.Context context) => pw.Padding(
          padding: const pw.EdgeInsets.all(16),
          child: pw.Image(pdfImage, fit: pw.BoxFit.contain),
        ),
      ),
    );

    return pdf.save();
  }

  static Future<String> saveAndSharePdf({
    required GlobalKey qrKey,
    required String cartName,
    required String cartId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 100));

    final pdfBytes = await generatePdfFromWidget(qrKey);

    final safeName = cartName
        .replaceAll(RegExp(r'[^\w\s-]'), '')
        .replaceAll(' ', '_');

    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/GullyEats_$safeName.pdf');

    await file.writeAsBytes(pdfBytes);
    await SharePlus.instance.share(
      ShareParams(text: "Scan this QR to order", files: [XFile(file.path)]),
    );

    return file.path;
  }
}
