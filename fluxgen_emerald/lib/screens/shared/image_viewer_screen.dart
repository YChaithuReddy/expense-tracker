import 'dart:math' as math;
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:share_plus/share_plus.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// Full-screen image viewer with pinch-to-zoom, rotation, multi-image
/// navigation, download-to-gallery, and share.
///
/// Accepts either a single [imageUrl] or a list of [imageUrls] with an
/// optional [initialIndex] for gallery mode.
///
/// Uses `photo_view` for smooth zooming/panning and `PhotoViewGallery`
/// for multi-image swiping.
class ImageViewerScreen extends StatefulWidget {
  /// Single image URL (backwards-compatible).
  final String? imageUrl;

  /// Multiple image URLs for gallery mode.
  final List<String>? imageUrls;

  /// Starting index when using [imageUrls].
  final int initialIndex;

  /// Optional title shown in the AppBar.
  final String? title;

  const ImageViewerScreen({
    super.key,
    this.imageUrl,
    this.imageUrls,
    this.initialIndex = 0,
    this.title,
  }) : assert(imageUrl != null || imageUrls != null,
            'Either imageUrl or imageUrls must be provided');

  @override
  State<ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<ImageViewerScreen> {
  late final PageController _pageController;
  late int _currentIndex;
  double _rotation = 0; // in quarter turns (0, 1, 2, 3)
  bool _isSaving = false;

  /// Resolved list of all image URLs.
  late final List<String> _urls;

  @override
  void initState() {
    super.initState();
    _urls = widget.imageUrls ?? [widget.imageUrl!];
    _currentIndex = widget.initialIndex.clamp(0, _urls.length - 1);
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  String get _currentUrl => _urls[_currentIndex];

  bool get _isMultiImage => _urls.length > 1;

  void _rotateLeft() {
    setState(() {
      _rotation = (_rotation - 1) % 4;
    });
  }

  void _rotateRight() {
    setState(() {
      _rotation = (_rotation + 1) % 4;
    });
  }

  void _goToPrevious() {
    if (_currentIndex > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _goToNext() {
    if (_currentIndex < _urls.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _downloadImage() async {
    if (_isSaving) return;
    setState(() => _isSaving = true);

    try {
      final response = await http.get(Uri.parse(_currentUrl));
      if (response.statusCode != 200) {
        throw Exception('Failed to download image');
      }

      final bytes = response.bodyBytes;
      final dir = await getApplicationDocumentsDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      // Try to determine extension from URL
      String ext = 'jpg';
      final urlPath = Uri.parse(_currentUrl).path.toLowerCase();
      if (urlPath.endsWith('.png')) {
        ext = 'png';
      } else if (urlPath.endsWith('.webp')) {
        ext = 'webp';
      }
      final filePath = '${dir.path}/image_$timestamp.$ext';
      final file = File(filePath);
      await file.writeAsBytes(bytes);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Image saved to $filePath'),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          action: SnackBarAction(
            label: 'Share',
            textColor: Colors.white,
            onPressed: () {
              Share.shareXFiles([XFile(filePath)]);
            },
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Download failed: $e'),
          backgroundColor: const Color(0xFFBA1A1A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _shareImage() {
    Share.share(_currentUrl);
  }

  @override
  Widget build(BuildContext context) {
    final titleText = widget.title ??
        (_isMultiImage
            ? 'Image ${_currentIndex + 1} of ${_urls.length}'
            : 'Image');

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.8),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _isMultiImage
              ? '${widget.title ?? 'Image'} (${_currentIndex + 1}/${_urls.length})'
              : titleText,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        actions: [
          // Rotate left
          IconButton(
            icon: const Icon(Icons.rotate_left, size: 22),
            tooltip: 'Rotate left',
            onPressed: _rotateLeft,
          ),
          // Rotate right
          IconButton(
            icon: const Icon(Icons.rotate_right, size: 22),
            tooltip: 'Rotate right',
            onPressed: _rotateRight,
          ),
          // Download
          _isSaving
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                )
              : IconButton(
                  icon: const Icon(Icons.download_outlined, size: 22),
                  tooltip: 'Download',
                  onPressed: _downloadImage,
                ),
          // Share
          IconButton(
            icon: const Icon(Icons.share_outlined, size: 22),
            tooltip: 'Share',
            onPressed: _shareImage,
          ),
        ],
      ),
      body: Stack(
        children: [
          // Main image viewer
          Transform.rotate(
            angle: _rotation * math.pi / 2,
            child: _isMultiImage
                ? PhotoViewGallery.builder(
                    pageController: _pageController,
                    itemCount: _urls.length,
                    onPageChanged: (index) {
                      setState(() {
                        _currentIndex = index;
                        _rotation = 0; // Reset rotation on page change
                      });
                    },
                    builder: (context, index) {
                      return PhotoViewGalleryPageOptions(
                        imageProvider: NetworkImage(_urls[index]),
                        minScale: PhotoViewComputedScale.contained,
                        maxScale: PhotoViewComputedScale.covered * 3,
                        heroAttributes:
                            PhotoViewHeroAttributes(tag: 'image_$index'),
                      );
                    },
                    backgroundDecoration:
                        const BoxDecoration(color: Colors.black),
                    loadingBuilder: (context, event) {
                      return const Center(
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      );
                    },
                  )
                : PhotoView(
                    imageProvider: NetworkImage(_currentUrl),
                    minScale: PhotoViewComputedScale.contained,
                    maxScale: PhotoViewComputedScale.covered * 3,
                    backgroundDecoration:
                        const BoxDecoration(color: Colors.black),
                    loadingBuilder: (context, event) {
                      return const Center(
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      );
                    },
                    errorBuilder: (context, error, stackTrace) {
                      return Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.broken_image_outlined,
                              size: 64,
                              color: Colors.white.withValues(alpha: 0.5),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Failed to load image',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.7),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Check your connection and try again',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.white.withValues(alpha: 0.4),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),

          // Previous/Next navigation arrows for multi-image
          if (_isMultiImage) ...[
            // Previous arrow
            if (_currentIndex > 0)
              Positioned(
                left: 8,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    onTap: _goToPrevious,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.chevron_left,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),
            // Next arrow
            if (_currentIndex < _urls.length - 1)
              Positioned(
                right: 8,
                top: 0,
                bottom: 0,
                child: Center(
                  child: GestureDetector(
                    onTap: _goToNext,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.chevron_right,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),

            // Page indicator dots at the bottom
            Positioned(
              bottom: 24,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _urls.length,
                  (index) => Container(
                    width: index == _currentIndex ? 10 : 6,
                    height: index == _currentIndex ? 10 : 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: index == _currentIndex
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.4),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
