import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const screenWidth = Dimensions.get("window").width;

export default function AdminHeader({
  user,
  showDropdown,
  setShowDropdown,
  handleLogout,
}: any) {
  return (
    <>
      {/* TOPBAR */}
      <View style={styles.topbar}>
        <Image
          source={require("../../assets/SecuTrack.png")} // ✅ FIXED PATH (ROOT assets)
          style={styles.logo}
        />

        <TouchableOpacity onPress={() => setShowDropdown(!showDropdown)}>
          <View style={styles.avatar}>
            {user?.profile_pic ? (
              <Image
                source={{
                  uri: `http://172.20.10.4/static/profile_pic/${user.profile_pic}`,
                }}
                style={styles.avatarImg}
              />
            ) : (
              <Text style={styles.avatarText}>
                {user?.username?.[0]?.toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* DROPDOWN */}
      {showDropdown && (
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.overlay}>
            <View style={styles.dropdown}>
              <Text style={styles.name}>{user?.full_name}</Text>
              <Text style={styles.role}>{user?.role}</Text>

              <TouchableOpacity>
                <Text style={styles.item}>
                  <Ionicons name="person-outline" size={16} /> Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity>
                <Text style={styles.item}>
                  <Ionicons name="key-outline" size={16} /> Change Password
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogout}>
                <Text style={[styles.item, { color: "red" }]}>
                  <Ionicons name="log-out-outline" size={16} /> Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topbar: {
    height: 65,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },

  logo: {
    width: 110,
    height: 40,
    resizeMode: "contain",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  avatarText: {
    color: "#fff",
    fontWeight: "bold",
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  dropdown: {
    position: "absolute",
    top: 65,
    right: 15,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    width: screenWidth * 0.45,
    elevation: 6,
  },

  name: {
    fontWeight: "700",
    marginBottom: 4,
  },

  role: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },

  item: {
    paddingVertical: 8,
  },
});