package com.nnegrey.freeze_tag.object_detection;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
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
public class Classifier {

    // Only return this many results.
    private static final int NUM_DETECTIONS = 30;

    // Config values.
    private int inputSize = 224;

    // Pre-allocated buffers.
    private static int[] intValues;
    private static byte[][] outputScores;

    protected ByteBuffer imgData = null;
    private Interpreter tfLite;

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
            final int inputSize) {
        final Classifier d = new Classifier();


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
        d.outputScores = new byte[1][NUM_DETECTIONS];
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

        // Copy the input data into TensorFlow.
        Trace.beginSection("feed");
        outputScores = new byte[1][NUM_DETECTIONS];

        // Run the inference call.
        Trace.beginSection("run");
        tfLite.run(imgData, outputScores);
        Trace.endSection();

        Trace.endSection();

        byte max = 0;
        int maxIndex = 0;
        for (int i = 0; i < MainActivity.NUM_RESULTS; i++) {
            byte confidence = outputScores[0][i];
            if (confidence > max) {
                max = confidence;
                maxIndex = i;
            }
        }

        MainActivity.gearindex = maxIndex % 10;
        MainActivity.confidence = max;
        MainActivity.valid = maxIndex < 10;
    }
}