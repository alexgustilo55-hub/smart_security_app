from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_socketio import SocketIO
from db import get_db_connection

app = Flask(__name__)
app.secret_key = "supersecretkey"
socketio = SocketIO(app, cors_allowed_origins="*")

#_______________________ADMIN_LOGIN___________________________#``

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
            return redirect(url_for("admin_dashboard"))
        else:
            flash("Invalid username or password", "error")  
    return render_template("admin_login.html")

#_______________________ADMIN_DASHBOARD___________________________#
@app.route("/admin/dashboard")
def admin_dashboard():
    if "user_id" not in session:
        return redirect(url_for("admin_login"))

    if session.get("role") != "admin":
        return "Access denied", 403

    return render_template("admin_dashboard.html")

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
    sql = "SELECT * FROM users WHERE username=%s AND password=%s AND role=%s "
    cursor.execute(sql,(username,password,role))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user:  
        session["user_id"] = user["user_id"]
        session["username"] = user["user_id"]
        session["role"] = user["role"]

        return jsonify({"success": True, "message": "Login successful!"})

    else:
        return jsonify({"success": False, "message": "Invalid username or password"}), 401

   
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
