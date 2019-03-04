package com.nnegrey.freeze_tag.object_detection;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.RectF;
import android.os.Trace;

import com.nnegrey.freeze_tag.MainActivity;

import org.tensorflow.lite.Interpreter;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;

/**
 * Wrapper for frozen detection models trained using the Tensorflow Object Detection API:
 * github.com/tensorflow/models/tree/master/research/object_detection
 */
public class TfLiteObjectDetection implements Classifier {

    // Only return this many results.
//    private static final int NUM_DETECTIONS = 10;
    private static final int NUM_DETECTIONS = 30;

    // Config values.
//    private int inputSize = 300;
    private int inputSize = 224;

    // Pre-allocated buffers.
    private static int[] intValues;
//    private static float[][][] outputLocations;
//    private static float[][] outputClasses;
    private static byte[][] outputScores;
//    private static float[] numDetections;

    protected ByteBuffer imgData = null;

    private Interpreter tfLite;

    private boolean found0 = false;
    private boolean found1 = false;
    private boolean found2 = false;
    private boolean found3 = false;
    private boolean found4 = false;
    private boolean found5 = false;
    private boolean found6 = false;
    private boolean found7 = false;
    private boolean found8 = false;
    private boolean found9 = false;


    private static final float MIN_CONFIDENCE = 0.8f;

    /**
     * Memory-map the model file in Assets.
     */
    private static MappedByteBuffer loadModelFile(AssetManager assets, String modelFilename)
            throws IOException {
        AssetFileDescriptor fileDescriptor = assets.openFd(modelFilename);
        FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
        FileChannel fileChannel = inputStream.getChannel();
        long startOffset = fileDescriptor.getStartOffset();
        long declaredLength = fileDescriptor.getDeclaredLength();
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
    }

    /**
     * Initializes a native TensorFlow session for classifying images.
     *
     * @param assetManager  The asset manager to be used to load assets.
     * @param modelFilename The filepath of the model GraphDef protocol buffer.
     */
    public static Classifier create(
            final AssetManager assetManager,
            final String modelFilename,
            final int inputSize) throws IOException {
        final TfLiteObjectDetection d = new TfLiteObjectDetection();


        d.inputSize = inputSize;

        try {
            d.tfLite = new Interpreter(loadModelFile(assetManager, modelFilename));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        // Pre-allocate buffers.
        d.imgData =
                ByteBuffer.allocateDirect(1 * d.inputSize * d.inputSize * 3 * 1);
        d.imgData.order(ByteOrder.nativeOrder());
        d.intValues = new int[d.inputSize * d.inputSize];
//        d.outputLocations = new float[1][NUM_DETECTIONS][4];
//        d.outputClasses = new float[1][NUM_DETECTIONS];
        d.outputScores = new byte[1][NUM_DETECTIONS];
//        d.numDetections = new float[1];
        return d;
    }

    private TfLiteObjectDetection() {
    }

    @Override
    public void recognizeImage(final Bitmap bitmap) {
        // Log this method so that it can be analyzed with systrace.
        Trace.beginSection("recognizeImage");

        Trace.beginSection("preprocessBitmap");
        // Preprocess the image data from 0-255 int to normalized float based
        // on the provided parameters.
        bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());

        imgData.rewind();
        for (int i = 0; i < inputSize; ++i) {
            for (int j = 0; j < inputSize; ++j) {
                int pixelValue = intValues[i * inputSize + j];
                imgData.put((byte) ((pixelValue >> 16) & 0xFF));
                imgData.put((byte) ((pixelValue >> 8) & 0xFF));
                imgData.put((byte) (pixelValue & 0xFF));
            }
        }
        Trace.endSection(); // preprocessBitmap

        // Copy the input data into TensorFlow.
        Trace.beginSection("feed");
//        outputLocations = new float[1][NUM_DETECTIONS][4];
//        outputClasses = new float[1][NUM_DETECTIONS];
        outputScores = new byte[1][NUM_DETECTIONS];
//        numDetections = new float[1];

//        Object[] inputArray = {imgData};
//        Map<Integer, Object> outputMap = new HashMap<>();
//        outputMap.put(0, outputLocations);
//        outputMap.put(1, outputClasses);
//        outputMap.put(2, outputScores);
//        outputMap.put(3, numDetections);

        // Run the inference call.
        Trace.beginSection("run");
        tfLite.run(imgData, outputScores);
//        tfLite.runForMultipleInputsOutputs(inputArray, outputMap);
        Trace.endSection();

        // There's an off by 1 error in the post processing op
//        for (int k = 0; k < NUM_DETECTIONS; ++k) {
//            outputClasses[0][k] += 1;
//        }

        Trace.endSection();

        found0 = false;
        found1 = false;
        found2 = false;
        found3 = false;
        found4 = false;
        found5 = false;
        found6 = false;
        found7 = false;
        found8 = false;
        found9 = false;

        byte max = 0;
        int maxIndex = 0;
        for (int i = 0; i < MainActivity.NUM_RESULTS; i++) {
            byte confidence = outputScores[0][i];
            if (confidence > max) {
                max = confidence;
                maxIndex = i;
            }
        }

        float left = 0.4f;
        float top = 0.4f;
        float right = 0.6f;
        float bottom = 0.6f;
        int color = Color.BLACK;
        DetectedGear detectedGear = CameraActivity.detectedSpheroBalls.get(color);
        RectF location = new RectF(left, top, right, bottom);
        Classifier.Recognition recognition = new Classifier.Recognition("Top", "Top", max, location, color);
        detectedGear.setRecognition(recognition);
        detectedGear.setDetectedOnce();
        detectedGear.index =maxIndex;




//        for (int i = 0; i < MainActivity.NUM_RESULTS; i++) {
//            byte confidence = outputScores[0][i];
//            System.out.format("Output: %d: %d\n", i, confidence);
//            int color = getNumber(i);
////
////            float left = outputLocations[0][i][1];
////            float top = outputLocations[0][i][0];
////            float right = outputLocations[0][i][3];
////            float bottom = outputLocations[0][i][2];
//            float left = 0.4f;
//            float top = 0.4f;
//            float right = 0.6f;
//            float bottom = 0.6f;
//
//            if (confidence > MIN_CONFIDENCE) {
//                DetectedGear detectedGear = CameraActivity.detectedSpheroBalls.get(color);
//                if (detectedGear.isDetectedOnce()) {
//                    Classifier.Recognition recognition = detectedGear.getRecognition();
//                    recognition.setConfidence(confidence);
//                    RectF rectF = recognition.getLocation();
//                    rectF.set(left, top, right, bottom);
//                } else {
//                    RectF location = new RectF(left, top, right, bottom);
//                    Classifier.Recognition recognition = new Classifier.Recognition("Top", "Top", confidence, location, color);
//                    detectedGear.setRecognition(recognition);
//                    detectedGear.setDetectedOnce();
//                }
//
//                if (color == Color.BLACK) {
////                    detectedGear.index = (int) outputClasses[0][i];
//                }
//            }
//        }
    }

    private int getNumber(int number) {
        if (number == 1 && !found0) {
            found0 = true;
            return Color.BLUE;
        } else if (number == 2 && !found1) {
            found1 = true;
            return Color.GREEN;
        } else if (number == 3 && !found2) {
            found2 = true;
            return Color.MAGENTA;
        } else if (number == 4 && !found3) {
            found3 = true;
            return Color.RED;
        } else if (number == 5 && !found4) {
            found4 = true;
            return Color.YELLOW;
        } else if (number == 6 && !found5) {
            found5 = true;
            return Color.WHITE;
        } else if (number == 7 && !found6) {
            found6 = true;
            return Color.DKGRAY;
        } else if (number == 8 && !found7) {
            found7 = true;
            return Color.LTGRAY;
        } else if (number == 9 && !found8) {
            found8 = true;
            return Color.CYAN;
        } else if (number == 10 && !found9) {
            found9 = true;
            return Color.GRAY;
        } else {
            return Color.BLACK;
        }
    }

    @Override
    public void enableStatLogging(boolean debug) {

    }

    @Override
    public String getStatString() {
        return null;
    }

    @Override
    public void close() {

    }
}