import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeRouter } from "../api/navigation";
import { usePathname } from "expo-router";

export default function AdminBottomNav() {
  const { push } = useSafeRouter();
  const pathname = usePathname();

  const navItem = (icon: any, label: string, route: string) => {
    const isActive = pathname.includes(route);

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => push(`/${route}`)}
      >
        <Ionicons
          name={icon}
          size={24}
          color={isActive ? "#2563eb" : "#64748b"}
        />
        <Text style={[styles.label, isActive && styles.active]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.nav}>
      {navItem("speedometer-outline", "Sensor", "admin_sensor_monitor")}
      {navItem("warning-outline", "Alerts", "admin_security_alerts")}
      {navItem("document-text-outline", "Logs", "admin_logs")}
      {navItem("settings-outline", "Control", "admin_control_panel")}
      {navItem("bar-chart-outline", "Analytics", "admin_analytics")}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    height: 65,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    justifyContent: "space-around",
    alignItems: "center",
  },
  item: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, color: "#64748b" },
  active: { color: "#2563eb", fontWeight: "600" },
});