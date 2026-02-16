import pymysql

def get_db_connection():
    return pymysql.connect(
        host = "localhost",
        user = "root",
        password = "Flaskframework",
        database = "smart_security_app",
        cursorclass = pymysql.cursors.DictCursor
    )

