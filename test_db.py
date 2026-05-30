import mysql.connector

try:
    conexion = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",      # Si le pusiste contraseña a tu root de MySQL, ponla aquí
        database="mydb"   # Asegúrate que tu BD en XAMPP se llame exactamente así
    )
    cursor = conexion.cursor()
    
    # 1. ¿Qué tablas hay realmente?
    cursor.execute("SHOW TABLES")
    print("Tablas encontradas:", cursor.fetchall())
    
    # 2. ¿Cómo se llaman las columnas de 'cultivos'?
    cursor.execute("DESCRIBE cultivos")
    print("Columnas de 'cultivos':", cursor.fetchall())
    
    cursor.close()
    conexion.close()
    print("Conexión exitosa y estructura leída.")
except Exception as e:
    print("ERROR DE CONEXIÓN:", e)