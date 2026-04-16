import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// A reusable signature pad widget.
///
/// Usage:
/// ```dart
/// final _sigKey = GlobalKey<SignaturePadState>();
///
/// SignaturePad(key: _sigKey, label: 'Customer Signature')
///
/// // Clear:
/// _sigKey.currentState?.clear();
///
/// // Export PNG:
/// final bytes = await _sigKey.currentState?.toImage();
/// ```
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    super.key,
    required this.label,
    this.height = 100,
  });

  final String label;

  /// Height of the drawable canvas area in logical pixels.
  final double height;

  @override
  State<SignaturePad> createState() => SignaturePadState();
}

class SignaturePadState extends State<SignaturePad> {
  // Each sub-list is one continuous stroke (pen-down → pen-up).
  final List<List<Offset>> _paths = [];
  List<Offset> _current = [];

  // Width is resolved from layout at paint time via a LayoutBuilder.
  double _canvasWidth = 0;

  /// True when at least one stroke has been drawn.
  bool get hasSignature => _paths.isNotEmpty;

  /// Erase all strokes and repaint.
  void clear() => setState(() {
        _paths.clear();
        _current = [];
      });

  /// Render the current paths to a PNG byte array.
  ///
  /// Returns `null` if nothing has been drawn yet.
  Future<Uint8List?> toImage() async {
    if (!hasSignature) return null;

    final double w = _canvasWidth > 0 ? _canvasWidth : 300;
    final double h = widget.height;

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, w, h),
    );

    // White background
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = Colors.white,
    );

    // Stroke paint — matches website spec
    final paint = Paint()
      ..color = const Color(0xFF111111)
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (final path in _paths) {
      if (path.isEmpty) continue;
      final linePath = Path()..moveTo(path.first.dx, path.first.dy);
      for (int i = 1; i < path.length; i++) {
        linePath.lineTo(path[i].dx, path[i].dy);
      }
      canvas.drawPath(linePath, paint);
    }

    final picture = recorder.endRecording();
    final image = await picture.toImage(w.toInt(), h.toInt());
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    return byteData?.buffer.asUint8List();
  }

  // ── gesture handlers ────────────────────────────────────────────────────────

  void _onPanStart(DragStartDetails d) {
    setState(() {
      _current = [d.localPosition];
    });
  }

  void _onPanUpdate(DragUpdateDetails d) {
    setState(() {
      _current = [..._current, d.localPosition];
    });
  }

  void _onPanEnd(DragEndDetails _) {
    if (_current.isNotEmpty) {
      setState(() {
        _paths.add(List.unmodifiable(_current));
        _current = [];
      });
    }
  }

  // ── build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Label
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            widget.label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.75),
              letterSpacing: 0.3,
            ),
          ),
        ),

        // Drawable canvas
        Container(
          height: widget.height,
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Colors.grey.shade400,
              width: 1,
              // Dashed borders require a custom painter; we approximate with a
              // solid grey border styled to look lightweight.
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(11),
            child: LayoutBuilder(
              builder: (context, constraints) {
                _canvasWidth = constraints.maxWidth;
                return GestureDetector(
                  onPanStart: _onPanStart,
                  onPanUpdate: _onPanUpdate,
                  onPanEnd: _onPanEnd,
                  child: RepaintBoundary(
                    child: CustomPaint(
                      size: Size(constraints.maxWidth, widget.height),
                      painter: _SignaturePainter(
                        paths: _paths,
                        current: _current,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),

        // Clear button — right-aligned, subtle
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: hasSignature ? clear : null,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              foregroundColor: theme.colorScheme.error,
            ),
            child: const Text(
              'Clear',
              style: TextStyle(fontSize: 12),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Painter ──────────────────────────────────────────────────────────────────

class _SignaturePainter extends CustomPainter {
  const _SignaturePainter({
    required this.paths,
    required this.current,
  });

  final List<List<Offset>> paths;
  final List<Offset> current;

  static final Paint _paint = Paint()
    ..color = const Color(0xFF111111)
    ..strokeWidth = 2.0
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..style = PaintingStyle.stroke;

  @override
  void paint(Canvas canvas, Size size) {
    // Draw completed strokes
    for (final stroke in paths) {
      _drawStroke(canvas, stroke);
    }
    // Draw the in-progress stroke
    if (current.isNotEmpty) {
      _drawStroke(canvas, current);
    }
  }

  void _drawStroke(Canvas canvas, List<Offset> points) {
    if (points.isEmpty) return;
    if (points.length == 1) {
      // Single tap → draw a small dot
      canvas.drawCircle(points.first, 1.0, _paint);
      return;
    }
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, _paint);
  }

  @override
  bool shouldRepaint(_SignaturePainter old) =>
      old.paths != paths || old.current != current;
}
