import mysql.connector

try:
    # Intenta conectar
    conexion = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="mydb"
    )
    
    # Si llega aquí, es que conectó. Ahora revisemos si la tabla existe
    cursor = conexion.cursor()
    cursor.execute("SHOW TABLES")
    tablas = cursor.fetchall()
    print("✅ Conexión exitosa. Tablas encontradas en 'mydb':", tablas)
    
    cursor.close()
    conexion.close()
except Exception as e:
    print("❌ Error crítico:", e)