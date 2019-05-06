package com.example.sorting_demo.object_detection;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.os.Trace;
import android.util.Log;

import com.example.sorting_demo.MainActivity;

import org.tensorflow.lite.Interpreter;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;

/**
 * Wrapper for frozen detection models trained using the Tensorflow Object Detection API:
 * github.com/tensorflow/models/tree/master/research/object_detection
 */
public class Classifier {

    // Only return this many results.
    private static final int NUM_DETECTIONS = 10; // 30

    // Config values.
    private int inputSize = 224;

    // Pre-allocated buffers.
    private static int[] intValues;
    private static byte[][] outputDigitScores;

    private float[][][] outputGearToothLocations;
    private float[][] outputGearToothClasses;
    private float[][] outputGearToothScores;
    private float[] numGearToothDetections;

    protected ByteBuffer imgData = null;
    private Interpreter tfLiteDigitClassifier;
    private Interpreter tfLiteGearToothDetector;

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
     * @param digitModelFilename The filepath of the model GraphDef protocol buffer.
     */
    public static Classifier create(
            final AssetManager assetManager,
            final String digitModelFilename,
            final String gearToothModelFilename,
            final int inputSize) {
        final Classifier d = new Classifier();


        d.inputSize = inputSize;

        try {
            d.tfLiteDigitClassifier = new Interpreter(
                    loadModelFile(assetManager, digitModelFilename));
            d.tfLiteGearToothDetector = new Interpreter(
                    loadModelFile(assetManager, gearToothModelFilename));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        // Pre-allocate buffers.
        d.imgData =
                ByteBuffer.allocateDirect(1 * d.inputSize * d.inputSize * 3 * 1);
        d.imgData.order(ByteOrder.nativeOrder());
        d.intValues = new int[d.inputSize * d.inputSize];
        d.outputDigitScores = new byte[1][NUM_DETECTIONS];
        return d;
    }

    private Classifier() {
    }

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

        // Run the inference call.
        classifyGearDigit();
        imgData.rewind();
        detectMissingGearTeeth();
        Trace.endSection();
    }

    private void classifyGearDigit() {
        // Copy the input data into TensorFlow.
        outputDigitScores = new byte[1][NUM_DETECTIONS];

        // Run the inference call.
        tfLiteDigitClassifier.run(imgData, outputDigitScores);

        int max = 0;
        int maxIndex = 0;
        for (int i = 0; i < NUM_DETECTIONS; i++) {
            int confidence = outputDigitScores[0][i] & 0xFF;
            if (confidence > max) {
                max = confidence;
                maxIndex = i;
            }
        }

        MainActivity.gearindex = maxIndex % 10;
        if (MainActivity.gearindex == 9) {
            MainActivity.gearindex = 6;
        }

        MainActivity.confidence = max / 255.0;
    }

    private void detectMissingGearTeeth() {
            outputGearToothLocations = new float[1][NUM_DETECTIONS][4];
            outputGearToothClasses = new float[1][NUM_DETECTIONS];
            outputGearToothScores = new float[1][NUM_DETECTIONS];
            numGearToothDetections = new float[1];

            Object[] inputArray = {imgData};
            Map<Integer, Object> outputMap = new HashMap<>();
            outputMap.put(0, outputGearToothLocations);
            outputMap.put(1, outputGearToothClasses);
            outputMap.put(2, outputGearToothScores);
            outputMap.put(3, numGearToothDetections);

            tfLiteGearToothDetector.runForMultipleInputsOutputs(inputArray, outputMap);

            float max = 0;
            int maxIndex = 0;
            int secondIndex = 0;
            float secondMax = 0;
            for (int i = 0; i < NUM_DETECTIONS; i++) {
                float confidence = outputGearToothScores[0][i];
                if (confidence > max) {
                    secondMax = max;
                    max = confidence;
                    secondIndex = maxIndex;
                    maxIndex = i;
                }
            }

            // Get Locations
            for (int i = 0; i < 4; i++) {
                CameraActivity.firstBoundingBox[i] = outputGearToothLocations[0][maxIndex][i];
                CameraActivity.secondBoundingBox[i] = outputGearToothLocations[0][secondIndex][i];
            }
            CameraActivity.firstBoundingBoxConfidence = max;
            CameraActivity.secondBoundingBoxConfidence = secondMax;



            // The object detection model has two labels:
            // 0: missing tooth
            // 1: gear
            MainActivity.valid = "unknown";
            if (max > 0.6) {
                if (outputGearToothClasses[0][maxIndex] == 0) {
                    MainActivity.valid = "false";
                } else {
                    MainActivity.valid = "true";
                }
            }
    }
}