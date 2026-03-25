from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import os, uuid, json
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO
from db import get_db_connection

app = Flask(__name__)
app.secret_key = "supersecretkey"
app.config["UPLOAD_FOLDER"] = "static/profile_pic/"
socketio = SocketIO(app, cors_allowed_origins="*")


#_________________DEVICE STATE MEMORY_________________
device_state = {
    "door": "CLOSED",
    "buzzer": "OFF",
    "rgb": "OFF",
    "sensors": "DISARMED"
}

#_________________DEVICE STATE API____________________
@app.route("/device_state", methods=["GET"])
def device_state_api():
    """
    Returns the current device state for Arduino polling
    Format expected by ardcom.py:
    {
        "door": "OPEN"/"CLOSED",
        "buzzer": "ON"/"OFF",
        "rgb": "ON"/"OFF",
        "sensors": "ARMED"/"DISARMED"
    }
    """
    return jsonify(device_state)

@app.route("/api/control_status", methods=["GET"])
def api_control_status():
    return jsonify({
        "success": True,
        "doorOpen": device_state["door"]=="OPEN",
        "buzzer": device_state["buzzer"]=="ON",
        "rgb": {
            "red": device_state["rgb"]=="ON",
            "green": device_state["rgb"]=="ON",
            "blue": device_state["rgb"]=="ON"
        },
        "sensors": device_state["sensors"]=="ARMED"

    })


#__________________________________________ADMIN_LOGIN_______________________________________________#``

@app.route("/", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        role = "admin"

        print("Username entered:", username)
        print("Password entered:", password)

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = "SELECT * FROM users WHERE username=%s AND password=%s AND role=%s"
        cursor.execute(sql, (username, password, role))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user:
            session["user_id"] = user["user_id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            flash("Login successful!", "success")  
            return redirect(url_for("admin_sensor_monitor"))
        else:
            flash("Invalid username or password", "error")  
    return render_template("admin_login.html")

#_______________________ARDUINO EVENT API___________________________#

@app.route("/api/ard_event", methods=["POST"])
def ard_event():
    """
    Receives JSON data from Arduino via POST.
    Supports: rfid, intrusion, warning, sensor, device
    """
    conn = None
    cursor = None

    try:
        data = request.get_json(force=True)
        if not data:
            return {"success": False, "error": "No JSON received"}

        print("📡 DATA RECEIVED FROM ARDUINO:", data)

        event_type = data.get("type")
        conn = get_db_connection()
        cursor = conn.cursor()

        #__________RFID___________
        if event_type == "rfid":
            uid = data.get("uid")
            name = data.get("name")
            role = data.get("role")
            status = data.get("status")

            cursor.execute("""
                INSERT INTO security_events 
                (event_type, uid, name, role, status, created_at)
                VALUES (%s,%s,%s,%s,%s,NOW())
            """, ("rfid", uid, name, role, status))

            socketio.emit("update_overview", {
                "type": "rfid",
                "name": name,
                "role": role,
                "status": status
                
            })

        #__________INTRUSION / WARNING___________
        elif event_type in ["intrusion", "warning"]:
            alert_type = data.get("alert_type", "")
            description = data.get("description", "")

            cursor.execute("""
                INSERT INTO security_events 
                (event_type, alert_type, description, created_at)
                VALUES (%s,%s,%s,NOW())
            """, (event_type, alert_type, description))

            socketio.emit("update_overview", {
                "type": event_type,
                "alert_type": alert_type,
                "description": description
            })

        #____________SENSOR______________
        elif event_type == "sensor":
            sensor_type = data.get("sensor")  # "pir" or "ultrasonic"
            distance = float(data.get("distance_cm", 0))
            pir_motion = bool(data.get("pirMotion", False))
            person_detected = bool(data.get("personDetected", False))
            alert = data.get("alert")

            cursor.execute("""
                INSERT INTO sensors 
                (sensor_type, distance_cm, motion, person_detected, alert, created_at)
                VALUES (%s,%s,%s,%s,%s,NOW())
            """, (sensor_type, distance, pir_motion, person_detected, alert))

            socketio.emit("update_overview", {
                "type": "sensor",
                "sensor": sensor_type,
                "data": {
                    "distance_cm": distance,
                    "pirMotion": pir_motion,
                    "personDetected": person_detected,
                    "alert": alert
                }
            })

        #____________DEVICE________________
        elif event_type == "device":
            device_type = data.get("device")
            status = data.get("status")

            if not device_type:
                return {"success": False, "error": "Device type missing"}

            if isinstance(status, (dict, list)):
                status_json = json.dumps(status)
                status_str = None
            else:
                status_json = None
                status_str = str(status)

            cursor.execute("""
                INSERT INTO devices (device_type, status_str, status_json, created_at)
                VALUES (%s,%s,%s,NOW())
            """, (device_type, status_str, status_json))

            socketio.emit("update_overview", {
                "type": "device",
                "device": device_type,
                "status": status
            })

        else:
            print("⚠️ UNKNOWN EVENT TYPE:", event_type)

        conn.commit()
        return {"success": True}

    except Exception as e:
        print("❌ ARDUINO EVENT ERROR:", e)
        if conn:
            conn.rollback()
        return {"success": False, "error": str(e)}

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

#________________________________________ADMIN_SECURITY_ALERTS_____________________________________#

@app.route("/admin/security_alerts")
def admin_security_alerts():
    if "username" not in session:
        return redirect(url_for("admin_login"))

    alerts = []
    counts = {"active_alarms": 0, "warnings": 0, "info": 0}
    user = None
    

    try:
        
        conn = get_db_connection()
        cursor = conn.cursor()

        #_________ALERT FETCHING___________
        #______Unauthorized Access (RFID)_____
        cursor.execute("""
            SELECT 'Unauthorized Access' AS alert_type, name AS details, created_at
            FROM security_events
            WHERE event_type='rfid' AND status='unauthorized'
        """)

        unauthorized = cursor.fetchall()
        counts["warnings"] += len(unauthorized)

        #_________Intrusion / Warning_________
        cursor.execute("""
            SELECT 'Intrusion/Warning' AS alert_type, CONCAT(alert_type, ': ', description) AS details, created_at
            FROM security_events
            WHERE event_type IN ('intrusion','warning')
        """)
        intrusion = cursor.fetchall()
        for i in intrusion:
            if "intrusion" in i["alert_type"].lower():
                counts["active_alarms"] += 1
            else:
                counts["warnings"] += 1

        #_________Motion Alerts (PIR)___________
        cursor.execute("""
            SELECT 'Motion Detected' AS alert_type, CONCAT(sensor_type,' sensor') AS details, created_at
            FROM sensors
            WHERE motion=1
        """)
        motion = cursor.fetchall()
        counts["info"] += len(motion)

        #__________Ultrasonic Alerts______________
        cursor.execute("""
            SELECT 'Ultrasonic Alert' AS alert_type, CONCAT(sensor_type,' distance: ', distance_cm,'cm') AS details, created_at
            FROM sensors
            WHERE distance_cm < 50
        """)
        ultrasonic = cursor.fetchall()
        counts["info"] += len(ultrasonic)

        #__________Alarm Triggered________________
        cursor.execute("""
            SELECT 'Alarm Triggered' AS alert_type, device_type AS details, created_at
            FROM devices
            WHERE device_type='alarm' AND status='on'
        """)
        alarm = cursor.fetchall()
        counts["active_alarms"] += len(alarm)

        #_________Combine alerts_________________
        alerts = sorted(unauthorized + intrusion + motion + ultrasonic + alarm,
                        key=lambda x: x["created_at"], reverse=True)

        #___________USER FETCH _____________
        cursor.execute("""
            SELECT username, full_name, profile_pic, role
            FROM users
            WHERE LOWER(username) = LOWER(%s)
        """, (session["username"],))
        user = cursor.fetchone()

       
        if not user:
            user = {
                "username": "admin",
                "full_name": "Admin",
                "profile_pic": None,
                "role": "admin"
            }

    except Exception as e:
        print("DB ERROR (Security Alerts):", e)
        alerts = []
        counts = {"active_alarms": 0, "warnings": 0, "info": 0}

        user = {"username": "admin", "full_name": "Admin", "profile_pic": None, "role": "admin"}

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

    return render_template("admin_security_alerts.html", alerts=alerts, counts=counts, user=user)


#_______________________________________ADMIN_LOGS___________________________________________#
@app.route("/admin/logs")
def admin_logs():
    if "username" not in session:
        return redirect(url_for("admin_login"))

    rfid_logs = []
    motion_logs = []
    device_status = []
    user = None
    rfid_granted_count = 0
    rfid_denied_count = 0

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        #____________RFID LOGS______________
        # Removed LIMIT 100 to show all logs on reload
        cursor.execute("""
            SELECT s.id, s.name, u.role, s.status, s.created_at AS time
            FROM security_events s
            LEFT JOIN users u ON u.username = s.name
            WHERE s.event_type='rfid'
            ORDER BY s.created_at DESC
        """)
        rfid_logs = cursor.fetchall()

        #____________RFID COUNTS_____________
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status='granted' THEN 1 ELSE 0 END) AS granted_count,
                SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) AS denied_count
            FROM security_events
            WHERE event_type='rfid'
        """)
        counts = cursor.fetchone()
        rfid_granted_count = counts["granted_count"] or 0
        rfid_denied_count = counts["denied_count"] or 0

        #____________MOTION LOGS_____________
        cursor.execute("""
            SELECT id, sensor_type, motion, person_detected, alert, created_at
            FROM sensors
            WHERE sensor_type='pir'
            ORDER BY created_at DESC
            LIMIT 100
        """)
        motion_logs = cursor.fetchall()

        #___________DEVICE STATUS_____________
        cursor.execute("""
            SELECT device_type, status, created_at
            FROM devices
            ORDER BY created_at DESC
            LIMIT 50
        """)
        device_status = cursor.fetchall()

        #______________USER INFO______________
        cursor.execute("""
            SELECT username, full_name, profile_pic, role
            FROM users
            WHERE username=%s
        """, (session["username"],))
        user = cursor.fetchone()
        if not user:
            user = {"username":"admin","full_name":"Admin","profile_pic":None,"role":"admin"}


    except Exception as e:
        print("DB ERROR (RFID + Motion Logs):", e)
        rfid_logs = []
        motion_logs = []
        device_status = []
        user = {"username":"admin","full_name":"Admin","profile_pic":None,"role":"admin"}
        rfid_granted_count = 0
        rfid_denied_count = 0

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

    return render_template(
        "admin_logs.html",
        rfid_logs=rfid_logs,
        motion_logs=motion_logs,
        device_status=device_status,
        user=user,
        rfid_granted_count=rfid_granted_count,
        rfid_denied_count=rfid_denied_count
    )


#__________________ADMIN_DELETE_LOGS_______________#
@app.route("/admin/delete_log/<int:log_id>", methods=["POST"])
def delete_log(log_id):
    if "username" not in session:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM security_events WHERE id=%s", (log_id,))
        conn.commit()

        if cursor.rowcount > 0:
            return jsonify({"success": True})
        else:
            return jsonify({"success": False, "message": "Log not found"}), 404

    except Exception as e:
        print("DELETE ERROR:", e)
        return jsonify({"success": False, "message": "Server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()



#__________________ADMIN_DELETE_ALL_LOGS_______________#
@app.route("/admin/delete_all_logs", methods=["POST"])
def delete_all_logs():
    if "username" not in session:
        return {"success": False, "message": "Unauthorized"}

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM security_events WHERE event_type='rfid'")
        conn.commit()

        return {"success": True}

    except Exception as e:
        print("DELETE ALL ERROR:", e)
        return {"success": False, "message": "Server error"}

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

#____________________________________ADMIN_SENSOR_MONITOR____________________________________________#

@app.route("/admin/sensor_monitor")
def admin_sensor_monitor():

    if "username" not in session:
        return redirect(url_for("admin_login"))

    pir_status = None
    ultrasonic_status = None
    alert_status = None
    user = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        #________________PIR SENSOR__________________
        cursor.execute("""
            SELECT motion, person_detected, created_at
            FROM sensors
            WHERE sensor_type='pir'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        pir_status = cursor.fetchone()

        #________________ULTRASONIC SENSOR_____________
        cursor.execute("""
            SELECT distance_cm, alert, created_at
            FROM sensors
            WHERE sensor_type='ultrasonic'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        ultrasonic_status = cursor.fetchone()

        #_______________LAST SENSOR ALERT_______________
        cursor.execute("""
            SELECT alert
            FROM sensors
            WHERE alert IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """)
        alert_status = cursor.fetchone()

        #___________________USER INFO________________
        cursor.execute("""
            SELECT username, full_name, profile_pic, role
            FROM users
            WHERE username=%s
        """, (session["username"],))

        user = cursor.fetchone()

        if not user:
            user = {
                "username": "admin",
                "full_name": "Admin",
                "profile_pic": None,
                "role": "admin"
            }

    except Exception as e:
        print("DB ERROR (Sensor Monitor):", e)

        pir_status = None
        ultrasonic_status = None
        alert_status = None

        user = {
            "username": "admin",
            "full_name": "Admin",
            "profile_pic": None,
            "role": "admin"
        }

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

    return render_template(
        "admin_sensor_monitor.html",
        pir_status=pir_status,
        ultrasonic_status=ultrasonic_status,
        alert_status=alert_status,
        user=user
    )

#______________________________________ADMIN_CONTROL_PANEL____________________________________________#

@app.route("/admin/control_panel")
def admin_control_panel():
    if "username" not in session:
        return redirect(url_for("admin_login"))

    user = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT username, full_name, profile_pic, role FROM users WHERE username=%s", (session["username"],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
    except:
        user = {"username":"admin","full_name":"Admin","profile_pic":None,"role":"admin"}

    return render_template("admin_control_panel.html", devices=device_state, user=user)

#____________DEVICE CONTROL API_____________

@app.route("/api/device_control", methods=["POST"])
def api_device_control():
    if "username" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json()
    device = data.get("device")
    action = data.get("action")

    if device not in device_state:
        return jsonify({"success": False, "message": "Invalid device"})

    #_______UPDATE STATE_______
    if device == "door":
        if action.lower() in ["unlock","open"]:
            device_state["door"] = "OPEN"
        elif action.lower() in ["lock","close"]:
            device_state["door"] = "CLOSED"
    elif device == "buzzer":
        device_state["buzzer"] = "ON" if action.lower()=="on" else "OFF"
    elif device == "rgb":
        device_state["rgb"] = "ON" if action.lower()=="on" else "OFF"
    elif device == "sensors":
        device_state["sensors"] = "ARMED" if action.lower()=="arm" else "DISARMED"

    #_______REALTIME_______
    socketio.emit("device_update", {"device": device, "status": device_state[device]})

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO devices (device_type, status_str, created_at) VALUES (%s,%s,NOW())", (device, device_state[device]))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print("DB Error (device_control):", e)

    return jsonify({"success": True, "status": device_state[device]})

#______________________________________________ADMIN_ANALYTICS_________________________________________________#

@app.route("/admin/analytics")
def admin_analytics():
    if "username" not in session:
        return redirect(url_for("admin_login"))

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        #_____________RFID_______________
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status='granted' THEN 1 ELSE 0 END) AS granted,
                SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) AS denied
            FROM security_events
            WHERE event_type='rfid'
        """)
        rfid = cursor.fetchone()

        #____________INTRUSION______________
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM security_events
            WHERE event_type='intrusion'
        """)
        intrusion = cursor.fetchone()

        #_____________SENSOR________________
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN motion=1 THEN 1 ELSE 0 END) AS motion
            FROM sensors
        """)
        sensor = cursor.fetchone()

        #______________DEVICE________________
        cursor.execute("""
            SELECT device_type, COUNT(*) as total
            FROM devices
            GROUP BY device_type
        """)
        devices = cursor.fetchall()

        #______________USER_________________
        cursor.execute("""
            SELECT username, full_name, profile_pic, role
            FROM users
            WHERE username=%s
        """, (session["username"],))
        user = cursor.fetchone()

        return render_template(
            "admin_analytics.html",
            user=user,
            granted=rfid["granted"] or 0,
            denied=rfid["denied"] or 0,
            intrusion=intrusion["total"] or 0,
            motion=sensor["motion"] or 0,
            devices=devices
        )

    except Exception as e:
        print("Analytics Error:", e)
        return "Error loading analytics"

    finally:
        cursor.close()
        conn.close()


#______________________________________________API ADMIN_ANALYTICS_________________________________________________#

@app.route("/admin/analytics/data")
def admin_analytics_data():
    if "username" not in session:
        return {"success": False, "error": "Not logged in"}, 401

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        #________________RFID__________________
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status='granted' THEN 1 ELSE 0 END) AS granted,
                SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) AS denied
            FROM security_events
            WHERE event_type='rfid'
        """)
        rfid = cursor.fetchone()

        #_____________INTRUSION_________________
        cursor.execute("""
            SELECT COUNT(*) as total
            FROM security_events
            WHERE event_type='intrusion'
        """)
        intrusion = cursor.fetchone()

        #_______________SENSOR__________________
        cursor.execute("""
            SELECT SUM(CASE WHEN motion=1 THEN 1 ELSE 0 END) AS motion
            FROM sensors
        """)
        sensor = cursor.fetchone()

        #_______________DEVICES_________________
        cursor.execute("""
            SELECT device_type, COUNT(*) as total
            FROM devices
            GROUP BY device_type
        """)
        devices = cursor.fetchall()

        #________________USER____________________
        cursor.execute("""
            SELECT username, full_name, role, profile_pic
            FROM users
            WHERE username=%s
        """, (session["username"],))
        user = cursor.fetchone()
        if not user:
            user = {"username": session["username"], "full_name": "Unknown", "role": "admin", "profile_pic": None}

        #_______________RESPONSE_________________
        return {
            "success": True,
            "user": user,
            "granted": rfid["granted"] or 0,
            "denied": rfid["denied"] or 0,
            "intrusion": intrusion["total"] or 0,
            "motion": sensor["motion"] or 0,
            "devices": devices
        }

    except Exception as e:
        print("Live Analytics Error:", e)
        return {"success": False, "error": str(e)}

    finally:
        cursor.close()
        conn.close()

#____________________________________ADMIN_PROFILE_____________________________________________#

@app.route("/admin/profile", methods=["GET", "POST"])
def admin_profile():

    if "username" not in session:
        return redirect(url_for("admin_login"))

    
    if request.method == "POST":

        file = request.files.get("profile_pic")

        if not file or file.filename == "":
            return jsonify({"success": False})

        filename = secure_filename(file.filename)
        unique_name = str(uuid.uuid4()) + "_" + filename

        upload_folder = os.path.join(app.root_path, "static", "profile_pic")
        os.makedirs(upload_folder, exist_ok=True)

        file_path = os.path.join(upload_folder, unique_name)
        file.save(file_path)

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT profile_pic FROM users WHERE username=%s",
            (session["username"],)
        )
        old_user = cursor.fetchone()

        if old_user and old_user["profile_pic"]:
            old_path = os.path.join(upload_folder, old_user["profile_pic"])
            if os.path.exists(old_path):
                os.remove(old_path)

        cursor.execute(
            "UPDATE users SET profile_pic=%s WHERE username=%s",
            (unique_name, session["username"])
        )
        conn.commit()
        cursor.close()
        conn.close()

        image_url = url_for("static", filename="profile_pic/" + unique_name)

        return jsonify({
            "success": True,
            "image_url": image_url
        })

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username=%s",
        (session["username"],)
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    return render_template("admin_profile.html", user=user)

#_______________________LOGOUT___________________________#
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("admin_login"))



#_________________________________API___________________________________#
#_______________________ API ADMIN_LOGIN MOBILE___________________________#
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    role = "admin"

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
      
        sql = "SELECT * FROM users WHERE username=%s AND password=%s AND role=%s"
        cursor.execute(sql, (username, password, role))
        user = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if user:
        
        session["user_id"] = user["user_id"]
        session["username"] = user["username"]
        session["role"] = user["role"]

        return jsonify({"success": True, "message": "Login successful!"})
    else:
        return jsonify({"success": False, "message": "Invalid username or password"}), 401
    

#_______________________ API ADMIN_SENSOR_MONITOR MOBILE___________________________#

@app.route("/api/sensor_monitor", methods=["GET"])
def api_sensor_monitor():
    """
    Returns the latest sensor states and logged-in user info for mobile/react-native app.
    Structure:
    {
        "success": True,
        "pir": { "motion": bool, "person_detected": bool },
        "ultrasonic": { "distance_cm": float },
        "alert": str,
        "user": { "username": str, "full_name": str, "role": str }
    }
    """
    pir = None
    ultra = None
    alert = None
    user = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        #____________________PIR______________________
        cursor.execute("""
            SELECT motion, person_detected, created_at
            FROM sensors
            WHERE sensor_type='pir'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        pir = cursor.fetchone()

        #_________________ULTRASONIC__________________
        cursor.execute("""
            SELECT distance_cm, alert, created_at
            FROM sensors
            WHERE sensor_type='ultrasonic'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        ultra = cursor.fetchone()

        #___________________ALERT___________________
        cursor.execute("""
            SELECT alert
            FROM sensors
            WHERE alert IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        """)
        alert = cursor.fetchone()

        #___________________USER_____________________
        if "username" in session:
            cursor.execute("""
                SELECT username, full_name, role
                FROM users
                WHERE username=%s
            """, (session["username"],))
            user = cursor.fetchone()

        if not user:
            user = {"username": "admin", "full_name": "Admin", "role": "admin"}

        # _________________RESPONSE___________________
        response = {
            "success": True,
            "pir": {
                "motion": bool(pir["motion"]) if pir else False,
                "person_detected": bool(pir["person_detected"]) if pir else False
            },
            "ultrasonic": {
                "distance_cm": float(ultra["distance_cm"]) if ultra else 0
            },
            "alert": alert["alert"] if alert else "System Normal",
            "user": {
                "username": user["username"],
                "full_name": user["full_name"],
                "role": user["role"]
            }
        }

        return jsonify(response)

    except Exception as e:
        print("API ERROR (sensor_monitor):", e)

        return jsonify({
            "success": False,
            "pir": {"motion": False, "person_detected": False},
            "ultrasonic": {"distance_cm": 0},
            "alert": "System Normal",
            "user": {"username": "admin", "full_name": "Admin", "role": "admin"}
        })

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

#_______________________ API ADMIN_SECURITY_ALERT MOBILE___________________________#
@app.route("/api/security_alerts", methods=["GET"])
def api_security_alerts():
    if "username" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    alerts = []
    counts = {"active_alarms": 0, "warnings": 0, "info": 0}
    user = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        #______________________FETCH ALERTS_________________________

        #_____________Unauthorized Access______________
        cursor.execute("""
            SELECT 'Unauthorized Access' AS alert_type, name AS details, created_at
            FROM security_events
            WHERE event_type='rfid' AND status='unauthorized'
        """)
        unauthorized = cursor.fetchall()
        counts["warnings"] += len(unauthorized)

        #_____________Intrusion / Warning_______________
        cursor.execute("""
            SELECT 'Intrusion/Warning' AS alert_type, CONCAT(alert_type, ': ', description) AS details, created_at
            FROM security_events
            WHERE event_type IN ('intrusion','warning')
        """)
        intrusion = cursor.fetchall()
        for i in intrusion:
            counts["active_alarms"] += 1 if "intrusion" in i["alert_type"].lower() else 0
            counts["warnings"] += 1 if "warning" in i["alert_type"].lower() else 0

        #______________Motion Alerts________________
        cursor.execute("""
            SELECT 'Motion Detected' AS alert_type, CONCAT(sensor_type,' sensor') AS details, created_at
            FROM sensors
            WHERE motion=1
        """)
        motion = cursor.fetchall()
        counts["info"] += len(motion)

        #____________Ultrasonic Alerts______________
        cursor.execute("""
            SELECT 'Ultrasonic Alert' AS alert_type, CONCAT(sensor_type,' distance: ', distance_cm,'cm') AS details, created_at
            FROM sensors
            WHERE distance_cm < 50
        """)
        ultrasonic = cursor.fetchall()
        counts["info"] += len(ultrasonic)

        #____________Alarm triggered______________
        cursor.execute("""
            SELECT 'Alarm Triggered' AS alert_type, device_type AS details, created_at
            FROM devices
            WHERE device_type='alarm' AND status='ON'
        """)
        alarm = cursor.fetchall()
        counts["active_alarms"] += len(alarm)

        #Combine all alerts, newest first
        alerts = sorted(unauthorized + intrusion + motion + ultrasonic + alarm,
                        key=lambda x: x["created_at"], reverse=True)

        #_____________USER_______________
        cursor.execute("""
            SELECT username, full_name, role, profile_pic
            FROM users
            WHERE username=%s
        """, (session["username"],))
        user = cursor.fetchone()

        if not user:
            user = {"username": session["username"], "full_name": "Unknown", "role": "User", "profile_pic": None}
         
        return jsonify({
            "success": True,
            "alerts": alerts,
            "counts": counts,
            "user": user
        })

    except Exception as e:
        print("API Security Alerts Error:", e)
        
        return jsonify({
            "success": False,
            "alerts": [],
            "counts": counts,
            "user": {"username": session.get("username", "admin"), "full_name": "Unknown", "role": "User", "profile_pic": None}
        })

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

#_______________________ API ACCESS LOGS (MATCHED WITH WEB) ___________________________#
@app.route("/api/logs", methods=["GET"])
def api_logs():
    if "username" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    rfid_logs = []
    motion_logs = []
    device_status = []
    rfid_granted_count = 0
    rfid_denied_count = 0
    user = None  

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        #_______________RFID LOGS_______________
        cursor.execute("""
            SELECT 
                s.id, 
                s.name, 
                COALESCE(u.full_name, s.name) AS full_name,
                COALESCE(u.role, '-') AS role, 
                s.status, 
                DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') AS time
            FROM security_events s
            LEFT JOIN users u ON u.username = s.name
            WHERE s.event_type='rfid'
            ORDER BY s.created_at DESC
            LIMIT 20
        """)
        rfid_logs = cursor.fetchall()

        #______________RFID COUNTS________________
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status='granted' OR status='authorized' THEN 1 ELSE 0 END) AS granted_count,
                SUM(CASE WHEN status='denied' THEN 1 ELSE 0 END) AS denied_count
            FROM (
                SELECT status
                FROM security_events
                WHERE event_type='rfid'
                ORDER BY created_at DESC
                LIMIT 20
            ) AS latest
        """)
        counts = cursor.fetchone()
        rfid_granted_count = counts["granted_count"] or 0
        rfid_denied_count = counts["denied_count"] or 0

        #_______________MOTION LOGS_______________
        cursor.execute("""
            SELECT 
                id, 
                sensor_type, 
                motion, 
                person_detected, 
                alert, 
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
            FROM sensors
            WHERE sensor_type='pir'
            ORDER BY created_at DESC
            LIMIT 20
        """)
        motion_logs = cursor.fetchall()

        #________________DEVICE STATUS_______________
        cursor.execute("""
            SELECT 
                device_type, 
                status_str AS status, 
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
            FROM devices
            ORDER BY created_at DESC
            LIMIT 20
        """)
        device_status = cursor.fetchall()

        #____________User___________
        cursor.execute("""
            SELECT username, full_name, role, profile_pic
            FROM users
            WHERE username=%s
        """, (session["username"],))
        user = cursor.fetchone()
        if not user:
            user = {"username": "admin", "full_name": "Admin", "role": "admin", "profile_pic": None}

        #__________RESPONSE__________
        return jsonify({
            "success": True,
            "rfid_logs": rfid_logs,
            "motion_logs": motion_logs,
            "device_status": device_status,
            "rfid_granted_count": rfid_granted_count,
            "rfid_denied_count": rfid_denied_count,
            "user": user  
        })

    except Exception as e:
        print("API ERROR (access_logs):", e)
        return jsonify({
            "success": False,
            "rfid_logs": [],
            "motion_logs": [],
            "device_status": [],
            "rfid_granted_count": 0,
            "rfid_denied_count": 0,
            "user": {"username": "admin", "full_name": "Admin", "role": "admin", "profile_pic": None}
        })

    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass
#_______________________ API ADMIN_LOGOUT MOBILE___________________________#
@app.route("/api/logout", methods=["POST"])
def api_logout():
    if "username" in session:
        session.clear()  
        return jsonify({"success": True, "message": "Logged out successfully"})
    else:
        return jsonify({"success": False, "message": "Not logged in"})
    
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
