import mysql.connector
import random
import string
from datetime import datetime, timedelta
def random_mac():
    return "00:1A:79:" + ":".join(f"{random.randint(0, 255):02X}" for _ in range(3))

def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def create_connection():
    return mysql.connector.connect(
        host="127.0.0.1",       # or your DB server
        user="php_dev",
	    port ="3307",
        password="Th61O1CaB9bpGZ",
        database="stalker_billing"
    )

def insert_users(cursor, count=20):
    sql = """
    INSERT INTO accounts (username, account, password, full_name, mac, expires, phone, note)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    for i in range(1, count + 1):
        username = "redeller2"
        account = f'user{i}_{random_string(3)}'
        full_name = username + account
        password = random_string(10)
        mac = random_mac()
        expires = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
        phone = ""
        note = ""

        cursor.execute(sql, (username, account, password, full_name, mac, expires, phone, note))
        if i % 100 == 0:
            print(f"{i} users inserted...")

# Main execution
conn = create_connection()
cursor = conn.cursor()

try:
    insert_users(cursor)
    conn.commit()
    print("All users inserted successfully.")
except Exception as e:
    conn.rollback()
    print("Error:", e)
finally:
    cursor.close()
    conn.close()
