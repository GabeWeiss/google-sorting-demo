package com.nnegrey.freeze_tag.object_detection;




/**
 * Created by nnegrey on 5/31/18.
 */

public class DetectedGear {
    private boolean detectedOnce = false;
    public boolean bot = false;

    private Classifier.Recognition recognition;

    public int index = -1;

    public static final float NORMALIZED_SHRINK_AMOUNT = 0.016f; // 0.025 0.008

    public String username = "";


    public DetectedGear() {
        username = "__reserved__";
    }

    public boolean isDetectedOnce() {
        return detectedOnce;
    }

    public void setDetectedOnce() {
        this.detectedOnce = true;
    }

    public Classifier.Recognition getRecognition() {
        return recognition;
    }

    public void setRecognition(Classifier.Recognition recognition) {
        this.recognition = recognition;
    }

}
