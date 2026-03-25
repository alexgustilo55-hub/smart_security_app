import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native"; 
import { useSafeRouter } from "./api/navigation";
import { usePathname } from "expo-router";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AdminHeader from "./components/AdminHeader";
import AdminBottomNav from "./components/AdminBottomNav"; 

type User = {
  username: string;
  full_name?: string;
  role?: string;
  profile_pic?: string | null;
};

type SensorState = {
  pirMotion: boolean;
  person: boolean;
  distance: number;
  alert: string;
  threat: string;
  lastUpdate: string;
  user: User;
};

const screenWidth = Dimensions.get("window").width;

export default function AdminSensorMonitor() {
  const { push, replace } = useSafeRouter();
  const pathname = usePathname();

  const [showDropdown, setShowDropdown] = useState(false);
  const [sensor, setSensor] = useState<SensorState>({
    pirMotion: false,
    person: false,
    distance: 0,
    alert: "System Normal",
    threat: "Low",
    lastUpdate: "--",
    user: { username: "User", full_name: "Alex G", role: "Admin", profile_pic: null },
  });

  // ================= FETCH SENSOR + SOCKET =================
  useEffect(() => {
    let socket: Socket;

    const fetchSensor = async () => {
      try {
        const res = await fetch("http://192.168.137.1:5000/api/sensor_monitor", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (data.success) {
          setSensor((prev) => ({
            ...prev,
            pirMotion: data.pir.motion,
            person: data.pir.person_detected,
            distance: data.ultrasonic.distance_cm,
            alert: data.alert,
            user: data.user || prev.user,
          }));
        }
      } catch (err) {
        console.log("Fetch sensor error:", err);
      }
    };

    fetchSensor();

    socket = io("http://192.168.137.1:5000");

    socket.on("update_overview", (data: any) => {
      setSensor((prev) => {
        const updated = { ...prev, lastUpdate: new Date().toLocaleTimeString() };
        if (data.type === "sensor") {
          if (data.sensor === "pir") {
            updated.pirMotion = data.data.pirMotion;
            updated.person = data.data.personDetected;
            updated.threat = data.data.pirMotion ? "Medium" : "Low";
          }
          if (data.sensor === "ultrasonic") updated.distance = data.data.distance_cm;
          if (data.data.alert) {
            updated.alert = data.data.alert !== "none" ? data.data.alert : "System Normal";
            updated.threat = data.data.alert !== "none" ? "High" : updated.threat;
          }
        }
        return updated;
      });
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // ================= HANDLE LOGOUT =================
  const handleLogout = async () => {
    try {
      await fetch("http://192.168.137.1:5000/api/logout", {
        method: "POST",
        credentials: "include",
      });
      await AsyncStorage.removeItem("isLoggedIn");
      await AsyncStorage.removeItem("user");
    } catch (err) {
      console.log("Logout error:", err);
    } finally {
      replace("/"); // Go back to login
    }
  };

  const threatLevelStyle = (threat: string) => {
    switch (threat) {
      case "High":
        return { borderLeftColor: "#e74c3c" };
      case "Medium":
        return { borderLeftColor: "#f1c40f" };
      default:
        return { borderLeftColor: "#2ecc71" };
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER */}
      <AdminHeader
        user={sensor.user}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        handleLogout={handleLogout}
      />

      {/* CONTENT */}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* STATUS PANEL */}
        <View style={styles.statusPanel}>
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>System Status</Text>
            <Text style={styles.statusValue}>System Active</Text>
          </View>
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Connected Sensors</Text>
            <Text style={styles.statusValue}>2 Devices</Text>
            <Text style={styles.statusSub}>PIR + Ultrasonic</Text>
          </View>
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Last Update</Text>
            <Text style={styles.statusValue}>{sensor.lastUpdate}</Text>
          </View>
          <View style={[styles.statusBox, styles.threatBox, threatLevelStyle(sensor.threat)]}>
            <Text style={styles.statusTitle}>Threat Level</Text>
            <Text style={styles.statusValue}>{sensor.threat}</Text>
          </View>
        </View>

        {/* SENSOR CARDS */}
        <View style={styles.dashboardGrid}>
          <View style={[styles.cardPanel, sensor.pirMotion ? styles.activePirMedium : styles.activePirLow]}>
            <Text style={styles.cardHeader}>PIR Motion Sensor</Text>
            <Text style={styles.deviceStatus}>{sensor.person ? "Yes" : "No"}</Text>
          </View>

          <View style={[styles.cardPanel, sensor.distance > 0 && sensor.distance < 50 ? styles.activeUltraWarning : styles.activeUltraSafe]}>
            <Text style={styles.cardHeader}>Ultrasonic Distance</Text>
            <Text style={styles.deviceStatus}>{sensor.distance > 0 ? `${sensor.distance} cm` : "-- cm"}</Text>
          </View>

          <View style={[styles.cardPanel, styles.threatBox, threatLevelStyle(sensor.threat)]}>
            <Text style={styles.cardHeader}>Security Alert</Text>
            <Text style={styles.deviceStatus}>{sensor.alert}</Text>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <AdminBottomNav />
    </View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f1f4f9" },
  statusPanel: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  statusBox: { flexBasis: "48%", backgroundColor: "#fff", borderRadius: 10, padding: 15, marginBottom: 10, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 3 },
  statusTitle: { fontSize: 15, color: "#444", fontWeight: "600", marginBottom: 4 },
  statusValue: { fontWeight: "700", fontSize: 16 },
  statusSub: { fontSize: 12, color: "#888" },
  threatBox: { borderLeftWidth: 5 },
  dashboardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardPanel: { flexBasis: "48%", backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 3 },
  cardHeader: { fontSize: 16, fontWeight: "600", marginBottom: 6, color: "#2c3e50" },
  deviceStatus: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  activePirLow: { borderLeftWidth: 5, borderLeftColor: "#2ecc71" },
  activePirMedium: { borderLeftWidth: 5, borderLeftColor: "#f1c40f" },
  activeUltraSafe: { borderLeftWidth: 5, borderLeftColor: "#2ecc71" },
  activeUltraWarning: { borderLeftWidth: 5, borderLeftColor: "#f1c40f" },
}); 