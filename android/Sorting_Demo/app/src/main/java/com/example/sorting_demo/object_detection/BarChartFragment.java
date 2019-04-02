package com.example.sorting_demo.object_detection;


import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v4.app.Fragment;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.example.sorting_demo.R;
import com.github.mikephil.charting.charts.BarChart;
import com.github.mikephil.charting.components.Legend;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.BarData;
import com.github.mikephil.charting.data.BarDataSet;
import com.github.mikephil.charting.data.BarEntry;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.formatter.IValueFormatter;
import com.github.mikephil.charting.formatter.IndexAxisValueFormatter;
import com.github.mikephil.charting.formatter.ValueFormatter;
import com.github.mikephil.charting.interfaces.datasets.IBarDataSet;
import com.github.mikephil.charting.utils.ColorTemplate;
import com.github.mikephil.charting.utils.ViewPortHandler;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.google.firebase.firestore.QuerySnapshot;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * A simple {@link Fragment} subclass.
 * create an instance of this fragment.
 */
public class BarChartFragment extends Fragment {

    private static final String TAG = "BarChartFragment";
    private static final String COLLECTION_NAME = "telemetry-live-count";
    private static final String DOCUMENT_ID = "gus-test";
    private BarChart chart;

    Map<String, Integer> mapLiteralToAlgarism = new HashMap<String, Integer>() {{
        put("zero", 0);
        put("one", 1);
        put("two", 2);
        put("three", 3);
        put("four", 4);
        put("five", 5);
        put("siz", 6);
        put("seven", 7);
        put("eight", 8);
        put("nine", 9);
    }};

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        View v = inflater.inflate(R.layout.fragment_bar_chart, container, false);

        // create a new chart object
        formatBarChart(v);

        loadDataFromDB();

        return v;
    }

    private void formatBarChart(View v) {
        chart = new BarChart(getActivity());
        chart.getDescription().setEnabled(false);
        chart.setDrawGridBackground(false);
        chart.setDrawBarShadow(false);


        chart.getLegend().setEnabled(false);
        YAxis leftAxis = chart.getAxisLeft();
        leftAxis.setAxisMinimum(0f); // this replaces setStartAtZero(true)
        leftAxis.setValueFormatter(new MyValueFormatter());
        chart.getAxisRight().setEnabled(false);
        XAxis xAxis = chart.getXAxis();
        xAxis.setEnabled(true);
        xAxis.setDrawAxisLine(true);
        xAxis.setDrawGridLines(false);
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setValueFormatter(new IndexAxisValueFormatter(mLabels));
        xAxis.setLabelCount(mLabels.length);
        xAxis.setTextSize(10);
        // programmatically add the chart
        FrameLayout parent = v.findViewById(R.id.parentLayout);
        parent.addView(chart);
    }


    private void loadDataFromDB() {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        db.collection(COLLECTION_NAME)
                .document(DOCUMENT_ID)
                .addSnapshotListener(new EventListener<DocumentSnapshot>() {
                    @Override
                    public void onEvent(@Nullable DocumentSnapshot snapshot,
                                        @Nullable FirebaseFirestoreException e) {
                        if (e != null) {
                            Log.w(TAG, "Listen failed.", e);
                            return;
                        }

                        if (snapshot != null && snapshot.exists()) {
                            Log.d(TAG, "Current data: " + snapshot.getData());
                            ArrayList<IBarDataSet> sets = new ArrayList<>();
                            ArrayList<BarEntry> entries = new ArrayList<>();
                            for (String key : snapshot.getData().keySet()) {
                                try {
                                    entries.add(new BarEntry(Integer.parseInt(key), (Long) snapshot.get(key)));
//                                    if (mapLiteralToAlgarism.containsKey(key)) {
//                                        int intValue = mapLiteralToAlgarism.get(key);
//                                        entries.add(new BarEntry(intValue, (Long) snapshot.get(key)));
//                                    }
                                } catch (Exception exp) {
                                    Log.d(TAG, "Key is not an integer:" + key);
                                }
                            }

                            BarDataSet ds = new BarDataSet(entries, "Numbers");
                            ds.setColors(Color.rgb(42, 85, 244));// 4285f4
                            ds.setValueTextSize(16);
                            ds.setValueFormatter(new MyValueFormatter());
                            sets.add(ds);
                            BarData d = new BarData(sets);
                            chart.setData(d);
                            chart.invalidate();
                        } else {
                            Log.d(TAG, "Current data: null");
                        }
                    }
                });
    }

    private final String[] mLabels = new String[]{"0", "1", "2", "3", "4", "5", "6", "7", "8", "9"};

    public class MyValueFormatter extends ValueFormatter {

        public MyValueFormatter() {
        }

        @Override
        public String getFormattedValue(float value) {
            return String.format("%d", (int) value);
        }
    }
}
