// import 'package:flutter/material.dart';
// import 'package:gullyeats/features/cart/data/camera_service.dart';

// class CameraPreview extends StatefulWidget {
//   const CameraPreview({super.key});

//   @override
//   _CameraPreviewState createState() => _CameraPreviewState();
// }

// class _CameraPreviewState extends State<CameraPreview> {
//   final CameraService _cameraService = CameraService();
//   late Future<void> _initializeControllerFuture;

//   @override
//   void initState() {
//     super.initState();
//     _initializeControllerFuture = _cameraService.initializeCamera();
//   }

//   @override
//   void dispose() {
//     _cameraService.dispose();
//     super.dispose();
//   }

//   @override
//   Widget build(BuildContext context) {
//     return FutureBuilder<void>(
//       future: _initializeControllerFuture,
//       builder: (context, snapshot) {
//         if (snapshot.connectionState == ConnectionState.done) {
//           // Camera is ready
//           return CameraPreview(_cameraService.controller);
//         } else {
//           // Loading state
//           return const Center(child: CircularProgressIndicator());
//         }
//       },
//     );
//   }
// }