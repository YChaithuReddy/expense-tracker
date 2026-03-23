package com.expensetracker.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class ShakeService extends Service implements SensorEventListener {

    private static final String TAG = "ShakeService";
    private static final String CHANNEL_ID = "shake_service_channel";
    private static final int NOTIFICATION_ID = 1001;

    private SensorManager sensorManager;
    private Sensor accelerometer;

    private float lastX = 0, lastY = 0, lastZ = 0;
    private long lastUpdate = 0;
    private long lastShakeTime = 0;

    private static final float SHAKE_THRESHOLD = 35f;
    private static final long SHAKE_COOLDOWN = 2000; // 2 seconds between shakes
    private static final long THROTTLE_MS = 100; // 10hz sampling

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "ShakeService created");

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "ShakeService started");

        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());

        // Register accelerometer listener
        if (sensorManager != null && accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
            Log.d(TAG, "Accelerometer listener registered");
        }

        return START_STICKY; // Restart if killed
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER) return;

        long now = System.currentTimeMillis();
        if (now - lastUpdate < THROTTLE_MS) return;

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        float deltaX = Math.abs(x - lastX);
        float deltaY = Math.abs(y - lastY);
        float deltaZ = Math.abs(z - lastZ);

        lastX = x;
        lastY = y;
        lastZ = z;
        lastUpdate = now;

        float totalDelta = deltaX + deltaY + deltaZ;

        if (totalDelta > SHAKE_THRESHOLD) {
            if (now - lastShakeTime > SHAKE_COOLDOWN) {
                lastShakeTime = now;
                Log.d(TAG, "Shake detected! Delta: " + totalDelta + " — launching Quick Add");
                launchQuickAdd();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not needed
    }

    private void launchQuickAdd() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction("com.expensetracker.QUICK_ADD");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // Wake the screen and bring app to front
        android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            android.os.PowerManager.WakeLock wakeLock = pm.newWakeLock(
                android.os.PowerManager.FULL_WAKE_LOCK |
                android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP |
                android.os.PowerManager.ON_AFTER_RELEASE,
                "expensetracker:shake_wake"
            );
            wakeLock.acquire(3000); // hold for 3 seconds
        }

        startActivity(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Shake to Add",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shake your phone to quickly add an expense");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        // Tap notification → open Quick Add
        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.setAction("com.expensetracker.QUICK_ADD");
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Expense Tracker")
            .setContentText("Shake phone to quick-add expense")
            .setSmallIcon(android.R.drawable.ic_input_add)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        Log.d(TAG, "ShakeService destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
