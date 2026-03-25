// AdminAnalytics.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Dimensions, StyleSheet, SafeAreaView } from "react-native";
import { PieChart, BarChart } from "react-native-chart-kit";
import AdminHeader from "./components/AdminHeader";
import AdminBottomNav from "./components/AdminBottomNav";

const screenWidth = Dimensions.get("window").width - 20;
const BACKEND_URL = "http://192.168.137.1:5000";

interface DeviceData {
  device_type: string;
  total: number;
}

export default function AdminAnalytics() {
  const [granted, setGranted] = useState(0);
  const [denied, setDenied] = useState(0);
  const [intrusion, setIntrusion] = useState(0);
  const [motion, setMotion] = useState(0);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // User object
  const user = {
    username: "admin",
    full_name: "Alex Gustilo",
    role: "Admin",
  };

  const handleLogout = () => {
    console.log("logout");
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/admin/analytics/data`);
      const data = await res.json();

      if (data.success) {
        setGranted(data.granted);
        setDenied(data.denied);
        setIntrusion(data.intrusion);
        setMotion(data.motion);
        setDevices(data.devices);
      }
    } catch (err) {
      console.log("Fetch analytics error:", err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  const rfidData = [
    { name: "Granted", population: granted, color: "#27ae60", legendFontColor: "#333", legendFontSize: 14 },
    { name: "Denied", population: denied, color: "#e74c3c", legendFontColor: "#333", legendFontSize: 14 },
  ];

  const deviceLabels = devices.map((d) => d.device_type);
  const deviceValues = devices.map((d) => d.total);

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* ================= TOPBAR ================= */}
      <AdminHeader
        user={user}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        handleLogout={handleLogout}
      />

      {/* ================= MAIN CONTENT ================= */}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        <Text style={styles.header}>Analytics Summary</Text>
        <Text style={styles.description}>
          Monitor and analyze real-time system activity, including RFID access attempts, motion events, and device distribution.
        </Text>

        {/* RFID Pie Chart */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>RFID Access</Text>
          <PieChart
            data={rfidData}
            width={screenWidth}
            height={220}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        {/* Intrusion & Motion */}
        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Text style={styles.cardHeader}>Intrusions</Text>
            <Text style={styles.bigNumber}>{intrusion}</Text>
            <Text style={styles.smallText}>Total detected intrusions</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.cardHeader}>Motion Events</Text>
            <Text style={styles.bigNumber}>{motion}</Text>
            <Text style={styles.smallText}>Total motion triggers</Text>
          </View>
        </View>

        {/* Device Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Device Distribution</Text>
          {devices.length > 0 ? (
            <BarChart
              data={{
                labels: deviceLabels,
                datasets: [{ data: deviceValues }],
              }}
              width={screenWidth}
              height={220}
              chartConfig={chartConfig}
              verticalLabelRotation={30}
            />
          ) : (
            <Text style={{ textAlign: "center", padding: 20 }}>No device data</Text>
          )}
        </View>
      </ScrollView>

      {/* ================= BOTTOM NAV ================= */}
      <AdminBottomNav />
    </SafeAreaView>
  );
}

const chartConfig = {
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.7,
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#f5f6fa" },
  container: { flex: 1, padding: 10 },
  header: { fontSize: 22, fontWeight: "bold", marginBottom: 5 },
  description: { fontSize: 14, color: "#555", marginBottom: 15 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginBottom: 15, elevation: 2 },
  cardHeader: { fontWeight: "bold", marginBottom: 5, fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  smallCard: { flex: 0.48, backgroundColor: "#fff", borderRadius: 10, padding: 10, elevation: 2, marginBottom: 15 },
  bigNumber: { fontSize: 28, fontWeight: "bold", marginVertical: 5, textAlign: "center" },
  smallText: { fontSize: 12, color: "#555", textAlign: "center" },
});