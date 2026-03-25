import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AdminHeader from "./components/AdminHeader";
import AdminBottomNav from "./components/AdminBottomNav";

type User = {
  username: string;
  full_name?: string;
  role?: string;
  profile_pic?: string | null;
};

type AlertItem = {
  alert_type: string;
  details: string;
  created_at: string;
};

export default function AdminSecurityAlerts() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState({ active_alarms: 0, warnings: 0, info: 0 });
  const [user, setUser] = useState<User>({
    username: "admin",
    full_name: "Alex Gustilo",
    role: "Admin",
    profile_pic: null,
  });

  // ================= FETCH ALERTS =================
  const fetchAlerts = async () => {
    try {
      const res = await fetch("http://192.168.137.1:5000/api/security_alerts", {
        method: "GET",
        credentials: "include", // important for session
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setCounts(data.counts);
        // ✅ set the correct logged-in user from backend
        if (data.user) setUser(data.user);
      }
    } catch (err) {
      console.log("Fetch alerts error:", err);
    }
  };

  // ================= SOCKET.IO =================
  useEffect(() => {
    fetchAlerts();
    const socket = io("http://192.168.137.1:5000", { transports: ["websocket"] });

    socket.on("update_overview", (data: any) => {
      const timestamp = new Date().toISOString();
      let newAlert: AlertItem | null = null;

      if (data.type === "sensor") {
        const dist = data.data?.distance_cm || 0;
        const pir = data.data?.pirMotion || false;

        if (pir && dist <= 0)
          newAlert = { alert_type: "PIR Alert", details: "Motion detected", created_at: timestamp };
        else if (!pir && dist > 0 && dist <= 3)
          newAlert = { alert_type: "Ultrasonic Alert", details: `Distance: ${dist}cm`, created_at: timestamp };
        else if (pir && dist > 0 && dist <= 3)
          newAlert = { alert_type: "Alarm Trigger", details: "PIR + Ultrasonic detected", created_at: timestamp };
      }

      if (data.type === "rfid" && data.status === "denied")
        newAlert = { alert_type: "Unauthorized RFID", details: `UID: ${data.uid || "Unknown"}`, created_at: timestamp };

      if (data.type === "intrusion" || data.type === "warning")
        newAlert = { alert_type: data.type === "intrusion" ? "Alarm Trigger" : "Warning", details: data.description || data.alert_type, created_at: timestamp };

      if (newAlert) {
        setAlerts((prev) => [newAlert!, ...prev]);
        setCounts((prev) => ({
          active_alarms: newAlert!.alert_type.includes("Alarm") || newAlert!.alert_type.includes("Unauthorized")
            ? prev.active_alarms + 1
            : prev.active_alarms,
          warnings: newAlert!.alert_type.includes("Warning") ? prev.warnings + 1 : prev.warnings,
          info: newAlert!.alert_type.includes("Ultrasonic") || newAlert!.alert_type.includes("PIR") ? prev.info + 1 : prev.info,
        }));
      }
    });

    return () => socket.disconnect();
  }, []);

  // ================= LOGOUT =================
  const handleLogout = async () => {
    try {
      await fetch("http://192.168.137.1:5000/api/logout", { method: "POST", credentials: "include" });
      await AsyncStorage.removeItem("isLoggedIn");
      await AsyncStorage.removeItem("user");
    } catch (err) {
      console.log(err);
    }
  };

  const getBadgeColor = (type: string) => {
    if (type.includes("Ultrasonic")) return "#f87171";
    if (type.includes("PIR")) return "#60a5fa";
    if (type.includes("RFID")) return "#fbbf24";
    if (type.includes("Alarm")) return "#dc2626";
    return "#6b7280";
  };

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER with correct user info */}
      <AdminHeader
        user={user}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        handleLogout={handleLogout}
      />

      {/* CONTENT */}
      <ScrollView style={styles.container}>
        <Text style={styles.pageHeader}>Security Alerts</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: "#b91c1c" }]}>
            <Text style={styles.summaryText}>Alarms: {counts.active_alarms}</Text>
          </View>
          <View style={[styles.summaryBox, { backgroundColor: "#1e3a8a" }]}>
            <Text style={styles.summaryText}>Info: {counts.info}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={() => setAlerts([])}>
          <Text style={{ color: "#fff" }}>Reset Alerts</Text>
        </TouchableOpacity>

        <View style={styles.tableHeader}>
          <Text style={styles.th}>Type</Text>
          <Text style={styles.th}>Details</Text>
          <Text style={styles.th}>Time</Text>
        </View>

        {alerts.map((alert, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.badge, { backgroundColor: getBadgeColor(alert.alert_type) }]}>{alert.alert_type}</Text>
            <Text style={styles.td}>{alert.details}</Text>
            <Text style={styles.td}>{new Date(alert.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>

      {/* BOTTOM NAV */}
      <AdminBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f1f4f9" },
  pageHeader: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  summaryRow: { flexDirection: "row", gap: 10, marginVertical: 15 },
  summaryBox: { flex: 1, padding: 12, borderRadius: 10 },
  summaryText: { color: "#fff", fontWeight: "bold" },
  resetBtn: { backgroundColor: "#ef4444", padding: 10, borderRadius: 8, alignSelf: "flex-end", marginBottom: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e5e7eb", padding: 10, borderRadius: 6 },
  th: { flex: 1, fontWeight: "bold", fontSize: 12 },
  tableRow: { flexDirection: "row", padding: 10, borderBottomWidth: 1, borderColor: "#eee" },
  td: { flex: 1, fontSize: 12 },
  badge: { flex: 1, color: "#fff", padding: 5, borderRadius: 5, fontSize: 11, textAlign: "center" },
});