import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import io, { Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AdminHeader from "./components/AdminHeader";
import AdminBottomNav from "./components/AdminBottomNav";

type User = { username: string; full_name?: string; role?: string; profile_pic?: string | null; };
type RfidLog = { name: string; role: string; status: string; time: string; };

export default function AdminLogs() {
  // ================= STATE =================
  const [rfidLogs, setRfidLogs] = useState<RfidLog[]>([]);
  const [rfidGrantedCount, setRfidGrantedCount] = useState(0);
  const [rfidDeniedCount, setRfidDeniedCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "granted" | "denied">("all");
  const [showDropdown, setShowDropdown] = useState(false);

  // ✅ User as state, default full_name ensures “A” in topbar
  const [user, setUser] = useState<User>({
    username: "admin",
    full_name: "Alex Gustilo",
    role: "Admin",
    profile_pic: null,
  });

  // ================= LOAD USER FROM STORAGE =================
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        if (storedUser) {
          const parsedUser: User = JSON.parse(storedUser);
          setUser({
            ...parsedUser,
            full_name: parsedUser.full_name || "Administrator", // fallback to show “A”
          });
        }
      } catch (err) {
        console.log("Failed to load user:", err);
      }
    };
    loadUser();
  }, []);

  // ================= ADD RFID ROW =================
  const addRfidRow = (data: any) => {
    const status = (data.status || "-").toLowerCase();
    const newLog: RfidLog = {
      name: data.name || "Unknown",
      role: data.role || "-",
      status,
      time: data.time || new Date().toLocaleString(),
    };
    setRfidLogs(prev => [newLog, ...prev].slice(0, 20));
    if (status === "granted" || status === "authorized") setRfidGrantedCount(prev => prev + 1);
    else if (status === "denied") setRfidDeniedCount(prev => prev + 1);
  };

  // ================= SOCKET.IO =================
  useEffect(() => {
    const socket: Socket = io("http://192.168.137.1:5000");

    socket.on("update_overview", (data: any) => {
      if (data.type === "rfid") addRfidRow(data);
    });

    return () => socket.disconnect();
  }, []);

  // ================= HANDLE LOGOUT =================
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("isLoggedIn");
      await AsyncStorage.removeItem("user");
    } catch (err) {
      console.log("Logout error:", err);
    }
  };

  // ================= FILTER LOGS =================
  const filteredLogs = rfidLogs.filter(log => {
    const textMatch = (log.name + log.role + log.status).toLowerCase().includes(searchText.toLowerCase());
    const statusMatch = statusFilter === "all" ||
      (statusFilter === "granted" && (log.status === "granted" || log.status === "authorized")) ||
      (statusFilter === "denied" && log.status === "denied");
    return textMatch && statusMatch;
  });

  return (
    <View style={{ flex: 1 }}>
      {/* HEADER */}
      <AdminHeader
        user={user}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        handleLogout={handleLogout}
      />

      {/* MAIN CONTENT */}
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Summary */}
        <View style={styles.accessSummary}>
          <View style={[styles.accessBox, styles.grantedBox]}>
            <Text>Granted: {rfidGrantedCount}</Text>
          </View>
          <View style={[styles.accessBox, styles.deniedBox]}>
            <Text>Denied: {rfidDeniedCount}</Text>
          </View>
        </View>

        {/* Search / Filter */}
        <View style={styles.toolbar}>
          <TextInput
            placeholder="Search..."
            style={styles.searchBox}
            value={searchText}
            onChangeText={setSearchText}
          />
          <View style={styles.filterBox}>
            <TouchableOpacity
              onPress={() => setStatusFilter("all")}
              style={[styles.filterButton, statusFilter === "all" && styles.activeFilter]}>
              <Text>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter("granted")}
              style={[styles.filterButton, statusFilter === "granted" && styles.activeFilter]}>
              <Text>Granted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter("denied")}
              style={[styles.filterButton, statusFilter === "denied" && styles.activeFilter]}>
              <Text>Denied</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logs */}
        {filteredLogs.map((log, i) => (
          <View key={i} style={styles.card}>
            <Text>{log.name} - {log.role}</Text>
            <Text style={{ color: log.status === "granted" ? "green" : log.status === "denied" ? "red" : "gray" }}>{log.status}</Text>
            <Text>{log.time}</Text>
          </View>
        ))}
      </ScrollView>

      <AdminBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#f1f4f9" },
  accessSummary: { flexDirection: "row", justifyContent: "space-around", marginVertical: 10 },
  accessBox: { flex: 1, padding: 10, marginHorizontal: 5, borderRadius: 8, alignItems: "center" },
  grantedBox: { backgroundColor: "#16a34a" },
  deniedBox: { backgroundColor: "#dc2626" },
  toolbar: { flexDirection: "row", marginVertical: 10 },
  searchBox: { flex: 1, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10 },
  filterBox: { flexDirection: "row", marginLeft: 10 },
  filterButton: { padding: 8, backgroundColor: "#e5e7eb", borderRadius: 8, marginHorizontal: 2 },
  activeFilter: { backgroundColor: "#2563eb", color: "#fff" },
  card: { backgroundColor: "#fff", padding: 10, borderRadius: 8, marginVertical: 5 },
});