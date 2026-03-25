import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import io from "socket.io-client";
import AdminHeader from "./components/AdminHeader";
import AdminBottomNav from "./components/AdminBottomNav"; 

const BASE_URL = "http://192.168.137.1:5000";

export default function AdminControlPanel() {
  const [devices, setDevices] = useState<any>({
    door: false,
    buzzer: false,
    rgb: false,
    sensors: false,
  });

  const [showDropdown, setShowDropdown] = useState(false);

  const user = {
    username: "admin",
    full_name: "Alex Gustilo",
    role: "Admin",
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/control_status`);
      const data = await res.json();

      if (data.success) {
        setDevices({
          door: data.doorOpen,
          buzzer: data.buzzer,
          rgb: data.rgb.red,
          sensors: data.sensors,
        });
      }
    } catch (err) {
      console.log("Fetch error:", err);
    }
  };

  const controlDevice = async (device: string, action: string) => {
    try {
      await fetch(`${BASE_URL}/api/device_control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ device, action }),
      });
    } catch (err) {
      console.log("Control error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();

    const socket = io(BASE_URL);

    socket.on("device_update", (data: any) => {
      setDevices((prev: any) => ({
        ...prev,
        [data.device]:
          data.status === "ON" ||
          data.status === "OPEN" ||
          data.status === "ARMED",
      }));
    });

    return () => socket.disconnect();
  }, []);

  const handleLogout = () => {
    console.log("logout");
  };

  return (
    <SafeAreaView style={styles.container}>
      <AdminHeader
        user={user}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        handleLogout={handleLogout}
      />

      <ScrollView style={styles.content}>
        <Text style={styles.title}>Control Panel</Text>

        {/* DOOR */}
        <View style={styles.card}>
          <Text style={styles.label}>Door</Text>
          <Text>Status: {devices.door ? "OPEN" : "CLOSED"}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("door", "open")}
            >
              <Text style={styles.btnText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("door", "close")}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BUZZER */}
        <View style={styles.card}>
          <Text style={styles.label}>Buzzer</Text>
          <Text>Status: {devices.buzzer ? "ON" : "OFF"}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("buzzer", "on")}
            >
              <Text style={styles.btnText}>ON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("buzzer", "off")}
            >
              <Text style={styles.btnText}>OFF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RGB */}
        <View style={styles.card}>
          <Text style={styles.label}>RGB Light</Text>
          <Text>Status: {devices.rgb ? "ON" : "OFF"}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("rgb", "on")}
            >
              <Text style={styles.btnText}>ON</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("rgb", "off")}
            >
              <Text style={styles.btnText}>OFF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SENSORS */}
        <View style={styles.card}>
          <Text style={styles.label}>Sensors</Text>
          <Text>Status: {devices.sensors ? "ARMED" : "DISARMED"}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("sensors", "arm")}
            >
              <Text style={styles.btnText}>ARM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => controlDevice("sensors", "disarm")}
            >
              <Text style={styles.btnText}>DISARM</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ✅ BOTTOM NAV */}
      <AdminBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  content: { padding: 15 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  label: { fontWeight: "bold", marginBottom: 5 },
  row: { flexDirection: "row", marginTop: 10 },
  btn: { backgroundColor: "#2563eb", padding: 10, borderRadius: 8, marginRight: 10 },
  btnText: { color: "#fff" },
});