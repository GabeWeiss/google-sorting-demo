package com.example.sorting_demo.object_detection;

import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v4.app.Fragment;
import android.text.Html;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.example.sorting_demo.R;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.remoteconfig.FirebaseRemoteConfig;

import java.util.Map;


public class LiveInferenceFragment extends Fragment {
    private static final String TAG = "LiveInferenceFragment";
    private static final String COLLECTION_NAME = "telemetry-live-count";
    private static final String SUMMARIES_DOCUMENT_ID = "firestore_live_inference_id";
    private String summariesDocumentId = "model-inference"; // this value is updated form Remote Config
    private static final String TABLE_DESCRIPTION = "number: 0-7 == valid\n" +
            "number: 10-17 == 1 tooth missing\n" +
            "number: 20-27 == 2 teeth missing\n" +
            "number: 8, 18, 28 == invalid";


    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        View v = inflater.inflate(R.layout.fragment_live_inference, container, false);

        loadRemoteConfig(v);

        ((TextView) v.findViewById(R.id.textview_logs_table_description)).setText(TABLE_DESCRIPTION);

        return v;
    }

    private void loadRemoteConfig(final View v) {
        final FirebaseRemoteConfig mFirebaseRemoteConfig = FirebaseRemoteConfig.getInstance();

        mFirebaseRemoteConfig.fetch(00)
                .addOnCompleteListener(getActivity(), new OnCompleteListener<Void>() {
                    @Override
                    public void onComplete(@NonNull Task<Void> task) {
                        if (task.isSuccessful()) {
                            String docId = mFirebaseRemoteConfig.getString(SUMMARIES_DOCUMENT_ID);
                            Log.d(TAG, "Current docId: " + docId);
                            if(!docId.isEmpty())
                                summariesDocumentId = docId;
                            mFirebaseRemoteConfig.activateFetched();
                        }
                        loadDataFromDB(v);
                    }
                });
    }

    private void loadDataFromDB(final View v) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();
        db.collection(COLLECTION_NAME)
                .document(summariesDocumentId)
                .addSnapshotListener(new EventListener<DocumentSnapshot>() {
                    @Override
                    public void onEvent(@Nullable DocumentSnapshot snapshot,
                                        @Nullable FirebaseFirestoreException e) {
                        if (e != null) {
                            Log.w(TAG, "Listen failed.", e);
                            return;
                        }

                        if (snapshot != null && snapshot.exists()) {
                            Map<String, Object> data = snapshot.getData();
                            Log.d(TAG, "Current data: " + data);

                            long throwawayCount = (long) data.get("throwaway_count");
                            long keepCount = (long) data.get("keep_count");

                            String throwawayLogs = "";
                            String keepLogs = "";
                            for (int i = 0; i < throwawayCount + keepCount; i++) {
                                if (i < throwawayCount) {
                                    throwawayLogs += String.format("%s<br>",
                                                                   data.get(String.valueOf(i)));
                                } else {
                                    keepLogs += String.format("%s<br>",
                                                              data.get(String.valueOf(i)));
                                }
                            }


                            String formattedText = String.format(
                                    "<h3>Model Output:</h3><font color='red'>%s</font><font color='black'>%s</font>",
                                    throwawayLogs,
                                    keepLogs);

                            ((TextView) v.findViewById(R.id.textview_live_inference_logs)).setText(
                                    Html.fromHtml(formattedText));
                        } else {
                            Log.d(TAG, "Current data: null");
                        }
                    }
                });
    }
}
