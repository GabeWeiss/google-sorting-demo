package com.example.sorting_demo;

import android.content.Intent;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.view.View;

import com.example.sorting_demo.object_detection.BarChartActivity;
import com.example.sorting_demo.object_detection.DetectorActivity;
import com.example.sorting_demo.object_detection.LiveInferenceActivity;

public class MainActivity extends AppCompatActivity {
    public static final String DIGI_TF_LITE_MODEL = "model_digit_bt_4_26_2019.tflite"; //"models_on_device.tflite";
    public static final String GEAR_TOOTH_TF_LITE_MODEL = "model_od_4_7_2019.tflite";
    public static final int TF_LITE_OBJECT_DETECTION_IMAGE_DIMENSION = 224;
    public static int gearindex = -1;
    public static float confidence = 0.0f;
    public static String valid = "unknown";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        findViewById(R.id.camera_button).setOnClickListener(new View.OnClickListener() {
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
