package com.nnegrey.freeze_tag.object_detection;

/*
 * Copyright 2016 The TensorFlow Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.media.ImageReader;
import android.os.SystemClock;
import android.util.Size;
import android.util.TypedValue;

import com.nnegrey.freeze_tag.MainActivity;
import com.nnegrey.freeze_tag.object_detection.OverlayView.DrawCallback;
import com.nnegrey.freeze_tag.object_detection.env.BorderedText;
import com.nnegrey.freeze_tag.object_detection.env.ImageUtils;

import java.util.Vector;

import com.nnegrey.freeze_tag.R;

/**
 * An activity that uses a TensorFlowMultiBoxDetector and ObjectTracker to detect and then track
 * objects.
 */
public class DetectorActivity extends CameraActivity implements ImageReader.OnImageAvailableListener {
    private static final Size DESIRED_PREVIEW_SIZE = new Size(448, 448);

    private static final float TEXT_SIZE_DIP = 10;

    private Integer sensorOrientation;

    private long lastProcessingTimeMs;
    private Bitmap rgbFrameBitmap = null;
    private Bitmap croppedBitmap = null;

    private boolean computingDetection = false;

    private Matrix frameToCropTransform;
    private Matrix cropToFrameTransform;

    private static final boolean MAINTAIN_ASPECT = true;

    private byte[] luminanceCopy;

    private BorderedText borderedText;
    OverlayView trackingOverlay;


    @Override
    protected void onDestroy() {
        super.onDestroy();
    }

    @Override
    public void onPreviewSizeChosen(final Size size, final int rotation) {
        final float textSizePx =
                TypedValue.applyDimension(
                        TypedValue.COMPLEX_UNIT_DIP, TEXT_SIZE_DIP, getResources().getDisplayMetrics());
        borderedText = new BorderedText(textSizePx);
        borderedText.setTypeface(Typeface.MONOSPACE);

        int cropSizex = MainActivity.TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION;
        int cropSizey = MainActivity.TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION;

        previewWidth = size.getWidth();
        previewHeight = size.getHeight();

        sensorOrientation = rotation - getScreenOrientation();

        rgbFrameBitmap = Bitmap.createBitmap(previewWidth, previewHeight, Bitmap.Config.ARGB_8888);
        croppedBitmap = Bitmap.createBitmap(cropSizex, cropSizey, Bitmap.Config.ARGB_8888);

        frameToCropTransform =
                ImageUtils.getTransformationMatrix(
                        previewWidth, previewHeight,
                        cropSizex, cropSizey,
                        sensorOrientation, MAINTAIN_ASPECT);

        cropToFrameTransform = new Matrix();
        frameToCropTransform.invert(cropToFrameTransform);

        trackingOverlay = findViewById(R.id.tracking_overlay);
        trackingOverlay.addCallback(
                new DrawCallback() {
                    @Override
                    public void drawCallback(final Canvas canvas) {
                        final Paint paint = new Paint();
                        paint.setColor(Color.RED);
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeWidth(12.0f);

                        // Draw the area the camera will actually detect
                        final float h1 = .11f * CANVAS_HEIGHT * CANVAS_HEIGHT_PERCENTAGE;
                        final float h2 = .75f * CANVAS_HEIGHT * CANVAS_HEIGHT_PERCENTAGE;
                        final RectF r = new RectF(0.0f * CANVAS_WIDTH,
                                h1,
                                1f * CANVAS_WIDTH,
                                h2);
                        canvas.drawRect(r, paint);
                        borderedText.drawText(canvas, r.left, r.bottom * (h2 - h1), "Camera Detection Area");

                        // Get the
                        borderedText.drawText(canvas, 0.25f, 0.75f * (h2 - h1) + h1,
                                String.format("#: %d - C: %.2f - V: %b",
                                        MainActivity.gearindex,
                                        MainActivity.confidence,
                                        MainActivity.valid));
                    }
                });

        addCallback(
                new DrawCallback() {
                    @Override
                    public void drawCallback(final Canvas canvas) {
                        if (!isDebug()) {
                            return;
                        }
                        final Bitmap copy = Bitmap.createBitmap(croppedBitmap);
                        final Paint paint = new Paint();
                        paint.setColor(Color.RED);
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeWidth(3.0f);

                        final Canvas canvas2 = new Canvas(copy);

                        if (copy == null) {
                            return;
                        }

                        final int backgroundColor = Color.argb(100, 0, 0, 0);
                        canvas.drawColor(backgroundColor);

                        final Matrix matrix = new Matrix();
                        final float scaleFactor = 2;
                        matrix.postScale(scaleFactor, scaleFactor);
                        matrix.postTranslate(
                                canvas.getWidth() - copy.getWidth() * scaleFactor,
                                canvas.getHeight() - copy.getHeight() * scaleFactor);
                        canvas.drawBitmap(copy, matrix, new Paint());

                        final Vector<String> lines = new Vector<String>();
                        lines.add("");

                        lines.add("Frame: " + previewWidth + "x" + previewHeight);
                        lines.add("Frame: " + canvas2.getWidth() + "x" + canvas2.getHeight());
                        lines.add("Crop: " + copy.getWidth() + "x" + copy.getHeight());
                        lines.add("View: " + canvas.getWidth() + "x" + canvas.getHeight());
                        lines.add(String.format("#: %d - C: %.2f - V: %b",
                                MainActivity.gearindex,
                                MainActivity.confidence,
                                MainActivity.valid));
                        lines.add("Rotation: " + sensorOrientation);
                        lines.add("Inference time: " + lastProcessingTimeMs + "ms");

                        borderedText.drawLines(canvas, 10, canvas.getHeight() - 10, lines);
                    }
                });
    }

    @Override
    protected void processImage() {
        byte[] originalLuminance = getLuminance();
        trackingOverlay.postInvalidate();

        // No mutex needed as this method is not reentrant.
        if (computingDetection) {
            readyForNextImage();
            return;
        }
        computingDetection = true;

        rgbFrameBitmap.setPixels(getRgbBytes(), 0, previewWidth, 0, 0, previewWidth, previewHeight);

        if (luminanceCopy == null) {
            luminanceCopy = new byte[originalLuminance.length];
        }
        System.arraycopy(originalLuminance, 0, luminanceCopy, 0, originalLuminance.length);
        readyForNextImage();

        final Canvas canvas = new Canvas(croppedBitmap);
        canvas.drawBitmap(rgbFrameBitmap, frameToCropTransform, null);

        runInBackground(
                new Runnable() {
                    @Override
                    public void run() {
                        final long startTime = SystemClock.uptimeMillis();
                        classifier.recognizeImage(croppedBitmap);
                        lastProcessingTimeMs = SystemClock.uptimeMillis() - startTime;
                        trackingOverlay.postInvalidate();
                        requestRender();
                        computingDetection = false;
                    }
                });
    }

    @Override
    protected int getLayoutId() {
        return R.layout.camera_connection_fragment_tracking;
    }

    @Override
    protected Size getDesiredPreviewFrameSize() {
        return DESIRED_PREVIEW_SIZE;
    }

    @Override
    public void onSetDebug(final boolean debug) {
//        detector.enableStatLogging(debug);
    }
}
