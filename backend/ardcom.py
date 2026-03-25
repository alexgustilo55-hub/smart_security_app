import serial
import time
import requests
import threading
import json

# ================= CONFIG =================
SERIAL_PORT = "COM5"
BAUD_RATE = 9600
BACKEND_URL = "http://localhost:5000/api/ard_event"
BACKEND_STATE_URL = "http://localhost:5000/device_state"  

# ================= SERIAL =================
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
time.sleep(2)

print("Arduino listening...")

# ================= LAST STATE MEMORY =================
last_device_state = {
    "doorOpen": None,
    "buzzer": None,
    "rgb": {"red": None, "green": None, "blue": None}
}

# ================= LAST SENT TO ARDUINO =================
last_sent_to_arduino = {
    "door": None,
    "buzzer": None,
    "rgb": None,
    "sensors": None
}

# ================= SEND TO BACKEND =================
def send_to_backend(data):
    try:
        r = requests.post(BACKEND_URL, json=data, timeout=2)
        print("SERVER:", r.text)
    except Exception as e:
        print("Send error:", e)

# ================= SEND COMMANDS TO ARDUINO =================
def send_command_to_arduino(cmd):
    try:
        ser.write((cmd + "\n").encode())
        print("Sent to Arduino:", cmd)
    except Exception as e:
        print("Arduino send error:", e)

# ================= POLL BACKEND DEVICE STATE =================
def poll_backend():
    while True:
        try:
            r = requests.get(BACKEND_STATE_URL, timeout=2)
            if r.status_code == 200:
                devices = r.json()  
                
                # Door
                if devices.get("door") != last_sent_to_arduino.get("door"):
                    cmd = "DOOR:OPEN" if devices["door"]=="OPEN" else "DOOR:CLOSE"
                    send_command_to_arduino(cmd)
                    last_sent_to_arduino["door"] = devices["door"]

                # Buzzer
                if devices.get("buzzer") != last_sent_to_arduino.get("buzzer"):
                    cmd = "BUZZER:ON" if devices["buzzer"]=="ON" else "BUZZER:OFF"
                    send_command_to_arduino(cmd)
                    last_sent_to_arduino["buzzer"] = devices["buzzer"]

                # RGB
                if devices.get("rgb") != last_sent_to_arduino.get("rgb"):
                    cmd = "RGB:ON" if devices["rgb"]=="ON" else "RGB:OFF"
                    send_command_to_arduino(cmd)
                    last_sent_to_arduino["rgb"] = devices["rgb"]

                # Sensors
                if devices.get("sensors") != last_sent_to_arduino.get("sensors"):
                    cmd = "SENSORS:ARM" if devices["sensors"]=="ARMED" else "SENSORS:DISARM"
                    send_command_to_arduino(cmd)
                    last_sent_to_arduino["sensors"] = devices["sensors"]

            time.sleep(0.2)
        except Exception as e:
            print("Backend poll error:", e)
            time.sleep(1)

# ================= START POLLING THREAD =================
threading.Thread(target=poll_backend, daemon=True).start()

while True:
    try:
        line = ser.readline().decode(errors="ignore").strip()
        if not line:
            continue

        print("SERIAL:", line)

        # ================= RFID ACCESS GRANTED =================
        if line.startswith("ACCESS_GRANTED:"):
            parts = line.split(":")
            payload = {
                "type": "rfid",
                "uid": "",
                "name": parts[1],
                "role": parts[2],
                "status": "granted"
            }
            threading.Thread(target=send_to_backend, args=(payload,)).start()
            continue

        # ================= RFID ACCESS DENIED =================
        if line.startswith("ACCESS_DENIED"):
            payload = {
                "type": "rfid",
                "uid": "",
                "name": "Unknown",
                "role": "",
                "status": "denied"
            }
            threading.Thread(target=send_to_backend, args=(payload,)).start()
            continue

        # ================= JSON SENSOR / DEVICE DATA =================
        try:
            data = json.loads(line)
        except:
            continue

        # ---------------- PIR SENSOR ----------------
        if data.get("pirMotion") is not None or data.get("personDetected") is not None:
            payload = {
                "type": "sensor",
                "sensor": "pir",
                "distance_cm": 0,
                "pirMotion": data.get("pirMotion", False),
                "personDetected": data.get("personDetected", False),
                "alert": data.get("alert")
            }
            threading.Thread(target=send_to_backend, args=(payload,)).start()

        # ---------------- ULTRASONIC SENSOR ----------------
        if data.get("distance_cm") is not None:
            payload = {
                "type": "sensor",
                "sensor": "ultrasonic",
                "distance_cm": data.get("distance_cm", 0),
                "pirMotion": False,
                "personDetected": False,
                "alert": data.get("alert")
            }
            threading.Thread(target=send_to_backend, args=(payload,)).start()

        # ---------------- DEVICE UPDATES ----------------
        # Door
        if "doorOpen" in data and data["doorOpen"] != last_device_state["doorOpen"]:
            device_payload = {
                "type": "device",
                "device": "door",
                "status": "OPEN" if data["doorOpen"] else "CLOSED"
            }
            last_device_state["doorOpen"] = data["doorOpen"]
            threading.Thread(target=send_to_backend, args=(device_payload,)).start()

        # Buzzer
        if "buzzer" in data and data["buzzer"] != last_device_state["buzzer"]:
            buzzer_status = "ON" if data["buzzer"] else "OFF"
            device_payload = {
                "type": "device",
                "device": "buzzer",
                "status": buzzer_status
            }
            last_device_state["buzzer"] = data["buzzer"]
            threading.Thread(target=send_to_backend, args=(device_payload,)).start()

        # RGB
        if "rgb" in data:
            rgb = data["rgb"]
            if (
                rgb["red"] != last_device_state["rgb"]["red"] or
                rgb["green"] != last_device_state["rgb"]["green"] or
                rgb["blue"] != last_device_state["rgb"]["blue"]
            ):
                device_payload = {
                    "type": "device",
                    "device": "rgb",
                    "status": rgb
                }
                last_device_state["rgb"] = rgb.copy()
                threading.Thread(target=send_to_backend, args=(device_payload,)).start()

        # ---------------- ALERTS ----------------
        if data.get("alert") == "warning":
            alert_payload = {
                "type": "warning",
                "alert_type": "motion_detection",
                "description": "Person detected but no RFID"
            }
            threading.Thread(target=send_to_backend, args=(alert_payload,)).start()

        if data.get("alert") == "intrusion_alert":
            alert_payload = {
                "type": "intrusion",
                "alert_type": "intrusion_alert",
                "description": "Unauthorized person detected"
            }
            threading.Thread(target=send_to_backend, args=(alert_payload,)).start()

    except Exception as e:
        print("Serial error:", e)