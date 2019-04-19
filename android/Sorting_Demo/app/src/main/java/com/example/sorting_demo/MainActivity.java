package com.example.sorting_demo;

import android.content.Intent;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;

import com.example.sorting_demo.object_detection.BarChartActivity;
import com.example.sorting_demo.object_detection.DetectorActivity;
import com.example.sorting_demo.object_detection.LiveInferenceActivity;

public class MainActivity extends AppCompatActivity {
    public static final String TF_LITE_MODEL = "models_on_device.tflite";
    public static final int TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION = 224;
    public static final int NUM_RESULTS = 30; // How many results from Object Detection to get
    public static int gearindex = -1;
    public static float confidence = 0.0f;
    public static boolean valid = true;

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

        findViewById(R.id.button_barchart).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(v.getContext(), BarChartActivity.class);
                startActivity(intent);
            }
        });

        findViewById(R.id.button_liveinference).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(v.getContext(), LiveInferenceActivity.class);
                startActivity(intent);
            }
        });


    }
}
