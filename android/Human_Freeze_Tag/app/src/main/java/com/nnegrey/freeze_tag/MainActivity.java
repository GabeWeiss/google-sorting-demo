package com.nnegrey.freeze_tag;

import android.content.Intent;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;

import com.nnegrey.freeze_tag.object_detection.DetectorActivity;
import com.orbotix.ConvenienceRobot;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    public static List<ConvenienceRobot> spheroRobots = new ArrayList<>();

//    public static final String TF_LITE_MODEL = "detection_model.tflite"; //"tpu_detect_new_objects.tflite"; //"tpu_detect_7_12.tflite";
//    public static final int TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION = 300;
//    public static final int NUM_RESULTS = 10; // How many results from Object Detection to get

    public static final String TF_LITE_MODEL = "models_on_device.tflite";
    public static final int TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION = 224;
    public static final int NUM_RESULTS = 30; // How many results from Object Detection to get

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        findViewById(R.id.button).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(v.getContext(), DetectorActivity.class);
                startActivity(intent);
            }
        });
    }
}
