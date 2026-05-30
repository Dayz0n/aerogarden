from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from functools import wraps
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import random
import threading
import os
import paho.mqtt.client as mqtt_client

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

app.secret_key = os.environ.get("SECRET_KEY", "cambia_esta_clave_en_produccion")


# ============================================================
# AUTENTICACIÓN — decorador y helper
# ============================================================

def login_requerido(f):
    @wraps(f)
    def verificar(*args, **kwargs):
        if 'usuario_logueado' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"error": "No autorizado"}), 401
            return redirect(url_for('home'))
        return f(*args, **kwargs)
    return verificar


def get_id_usuario():
    """Devuelve el idUsuario del usuario en sesión."""
    correo = session.get('usuario_logueado')
    if not correo:
        return None
    try:
        cx = conectar_bd()
        cur = cx.cursor()
        cur.execute("SELECT idUsuario FROM usuarios WHERE correo = %s", (correo,))
        row = cur.fetchone()
        cur.close()
        cx.close()
        return row[0] if row else None
    except:
        return None

# ============================================================
# CONFIGURACIÓN ADAFRUIT IO MQTT
# ============================================================
AIO_USERNAME = os.environ.get("AIO_USERNAME", "angeldedios")
AIO_KEY      = os.environ.get("AIO_KEY", "")
AIO_SERVER   = "io.adafruit.com"
AIO_PORT     = 1883

# Mapeo feed Adafruit → id_sensor en tu base de datos
# IMPORTANTE: ajusta estos IDs al registrar tus sensores en el dashboard
FEED_SENSOR_MAP = {
    f"{AIO_USERNAME}/feeds/temperatura": {"id": 1, "tipo": "Temperatura",  "unidad": "°C",   "conv": None},
    f"{AIO_USERNAME}/feeds/humedad":     {"id": 2, "tipo": "Humedad",      "unidad": "%",    "conv": None},
    f"{AIO_USERNAME}/feeds/ph":          {"id": 3, "tipo": "pH",           "unidad": "pH",   "conv": "ph"},
    f"{AIO_USERNAME}/feeds/luz":         {"id": 4, "tipo": "Luz",          "unidad": "lux",  "conv": "luz"},
    f"{AIO_USERNAME}/feeds/distancia":   {"id": 5, "tipo": "Nivel Agua",   "unidad": "cm",   "conv": None},
}

# Config del relevador (se comparte entre el hilo MQTT y Flask)
config_relevador = {
    "tiempo_on":     30,
    "tiempo_off":    60,
    "modo":          "automatico",
    "estado_manual": "apagado"
}
relay_lock = threading.Lock()


def convertir_valor(raw, tipo_conv):
    """
    Convierte valores crudos del ADC a unidades reales.
    El Arduino manda analogRead() directo (0-1023) para pH y luz.
    """
    v = float(raw)
    if tipo_conv == "ph":
        # analogRead A0 (0-1023) → voltaje → pH
        voltaje = v * (5.0 / 1023.0)
        ph = 7.0 + ((2.5 - voltaje) / 0.18)   # ajusta 0.18 según tu sensor
        return round(max(0.0, min(14.0, ph)), 2)
    elif tipo_conv == "luz":
        # analogRead A1 (0-1023) → lux aproximado
        return round((v / 1023.0) * 5000, 1)
    return round(v, 2)


def guardar_lectura_bd(id_sensor, valor):
    """Inserta una lectura en registro_sensores y evalúa alertas."""
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Guardar lectura
        cursor.execute(
            "INSERT INTO registro_sensores (idSensor, valor, fecha_hora) VALUES (%s, %s, NOW())",
            (id_sensor, valor)
        )

        # Evaluar parámetros de alerta activos
        cursor.execute("""
            SELECT idParametro, nombre, condicion, valor_umbral, prioridad
            FROM Parametros_Alerta
            WHERE idSensor = %s AND activo = 1
        """, (id_sensor,))
        parametros = cursor.fetchall()

        for p in parametros:
            umbral = float(p['valor_umbral'])
            cond   = p['condicion']
            disparo = (
                (cond == 'mayor_que' and valor > umbral) or
                (cond == 'menor_que' and valor < umbral) or
                (cond == 'igual_a'   and valor == umbral)
            )
            if disparo:
                msg = f"Sensor {id_sensor}: valor {valor} {cond.replace('_',' ')} umbral {umbral}"
                cursor.execute("""
                    INSERT INTO Historial_Alertas
                        (idParametro, idSensor, valor_detectado, prioridad, estado, mensaje)
                    VALUES (%s, %s, %s, %s, 'nueva', %s)
                """, (p['idParametro'], id_sensor, valor, p['prioridad'], msg))

        conexion.commit()
        cursor.close()
        conexion.close()
    except Exception as e:
        print(f"[BD ERROR] {e}")


# ── MQTT callbacks ──────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Conectado a Adafruit IO")
        for feed in FEED_SENSOR_MAP:
            client.subscribe(feed)
            print(f"[MQTT] Suscrito a: {feed}")
    else:
        print(f"[MQTT] Error de conexión, código: {rc}")


def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode("utf-8").strip()

    if topic not in FEED_SENSOR_MAP:
        return

    info = FEED_SENSOR_MAP[topic]
    try:
        valor = convertir_valor(payload, info["conv"])
        print(f"[MQTT] {info['tipo']}: {valor} {info['unidad']}")
        guardar_lectura_bd(info["id"], valor)
    except Exception as e:
        print(f"[MQTT] Error procesando {topic}: {e}")


def iniciar_mqtt():
    """Corre en un hilo separado. Mantiene conexión permanente a Adafruit IO."""
    cliente = mqtt_client.Client()
    cliente.username_pw_set(AIO_USERNAME, AIO_KEY)
    cliente.on_connect = on_connect
    cliente.on_message = on_message

    while True:
        try:
            print("[MQTT] Conectando a Adafruit IO...")
            cliente.connect(AIO_SERVER, AIO_PORT, keepalive=60)
            cliente.loop_forever()
        except Exception as e:
            print(f"[MQTT] Reconectando en 10s... ({e})")
            import time; time.sleep(10)


# Arrancar el hilo MQTT al iniciar Flask
hilo_mqtt = threading.Thread(target=iniciar_mqtt, daemon=True)
hilo_mqtt.start()


# ============================================================
# ENDPOINTS PARA EL RELEVADOR
# ============================================================

# El Arduino consulta esta URL para saber cuánto tiempo ON/OFF
# En tu caso, lo puedes integrar publicando a un feed de Adafruit
# o consultando directamente desde el dashboard + BD.

def conectar_bd():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASS", ""),
        database=os.environ.get("DB_NAME", "mydb"),
        charset="utf8mb4"
    )


# ============================================================
# RUTAS DE PÁGINAS
# ============================================================

@app.route('/')
def home():
    return render_template('login.html')

@app.route('/registro')
def pagina_registro():
    return render_template('registro.html')

@app.route('/dashboard')
@login_requerido
def dashboard():
    return render_template('dashboard.html')

@app.route('/logout')
def logout():
    session.pop('usuario_logueado', None)
    return redirect(url_for('home'))


# ============================================================
# AUTENTICACIÓN
# ============================================================

@app.route('/api/auth/registrar', methods=['POST'])
def registrar_usuario():
    try:
        data = request.json
        nombre    = data.get('nombre')
        correo    = data.get('correo')
        contrasena = data.get('contrasena')

        if not nombre or not correo or not contrasena:
            return jsonify({"status": "error", "mensaje": "Datos incompletos"}), 400

        conexion = conectar_bd()
        cursor   = conexion.cursor()
        query    = "INSERT INTO `usuarios` (`nombre`, `correo`, `contraseña`) VALUES (%s, %s, %s)"
        cursor.execute(query, (nombre, correo, generate_password_hash(contrasena)))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "mensaje": "Usuario registrado"})
    except mysql.connector.Error as err:
        return jsonify({"status": "error", "mensaje": str(err)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    data             = request.json
    correo           = data.get('correo')
    contrasena_plana = data.get('contrasena')

    conexion = conectar_bd()
    cursor   = conexion.cursor(dictionary=True)
    cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (correo,))
    usuario  = cursor.fetchone()
    cursor.close()
    conexion.close()

    if not usuario:
        return jsonify({"status": "error", "mensaje": "El correo no está registrado"}), 404

    if check_password_hash(usuario['contraseña'], contrasena_plana):
        session['usuario_logueado'] = correo
        session['usuario_nombre']   = usuario['nombre']
        return jsonify({"status": "success", "mensaje": "Login exitoso"})
    else:
        return jsonify({"status": "error", "mensaje": "Contraseña incorrecta"}), 401


# ============================================================
# USUARIO
# ============================================================

@app.route('/api/usuario/info', methods=['GET'])
@login_requerido
def obtener_usuario():
    if 'usuario_logueado' not in session:
        return jsonify({"error": "No autorizado"}), 401

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("SELECT nombre, correo, foto_perfil FROM usuarios WHERE correo = %s", (session['usuario_logueado'],))
        usuario  = cursor.fetchone()
        cursor.close()
        conexion.close()

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        return jsonify({
            "nombre": usuario['nombre'],
            "correo": usuario['correo'],
            "foto_perfil": usuario.get('foto_perfil') or None
        })
    except Exception as e:
        # Si foto_perfil no existe en la BD, devolver sin ella
        try:
            conexion = conectar_bd()
            cursor   = conexion.cursor(dictionary=True)
            cursor.execute("SELECT nombre, correo FROM usuarios WHERE correo = %s", (session['usuario_logueado'],))
            usuario  = cursor.fetchone()
            cursor.close()
            conexion.close()
            return jsonify({"nombre": usuario['nombre'], "correo": usuario['correo'], "foto_perfil": None})
        except Exception as e2:
            return jsonify({"error": str(e2)}), 500


@app.route('/api/usuario/password', methods=['POST'])
@login_requerido
def cambiar_password():
    if 'usuario_logueado' not in session:
        return jsonify({"error": "No autorizado"}), 401

    data  = request.json
    nueva = data.get('password', '').strip()

    if not nueva or len(nueva) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "UPDATE usuarios SET `contraseña` = %s WHERE correo = %s",
            (generate_password_hash(nueva), session['usuario_logueado'])
        )
        conexion.commit()
        filas = cursor.rowcount
        cursor.close()
        conexion.close()
        if filas == 0:
            return jsonify({"error": "No se encontró el usuario"}), 404
        return jsonify({"status": "success", "mensaje": "Contraseña actualizada"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/usuario/foto', methods=['POST'])
@login_requerido
def actualizar_foto():
    """Guarda foto de perfil como base64 en la BD.
    Requiere columna foto_perfil LONGTEXT en tabla usuarios.
    Si no existe la columna, la crea automáticamente."""
    if 'usuario_logueado' not in session:
        return jsonify({"error": "No autorizado"}), 401

    data = request.json
    foto = data.get('foto')  # string base64 con data URI

    if not foto:
        return jsonify({"error": "No se recibió imagen"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()

        # Intentar agregar la columna si no existe (falla silenciosamente si ya existe)
        try:
            cursor.execute("ALTER TABLE usuarios ADD COLUMN foto_perfil LONGTEXT NULL")
            conexion.commit()
        except Exception:
            pass  # La columna ya existe

        cursor.execute(
            "UPDATE usuarios SET foto_perfil = %s WHERE correo = %s",
            (foto, session['usuario_logueado'])
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "mensaje": "Foto actualizada"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# DISPOSITIVOS
# ============================================================

@app.route('/api/dispositivos/agregar', methods=['POST'])
@login_requerido
def agregar_dispositivo():
    data   = request.json
    nombre = data.get('nombre')
    tipo   = data.get('tipo')

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u = get_id_usuario()
        cursor.execute("INSERT INTO dispositivos (nombre, tipo, idSistema, idUsuario) VALUES (%s, %s, 1, %s)", (nombre, tipo, id_u))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@app.route('/api/dispositivos/lista', methods=['GET'])
@login_requerido
def obtener_lista_dispositivos():
    try:
        conexion     = conectar_bd()
        cursor       = conexion.cursor(dictionary=True)
        # CORREGIDO: incluye el campo 'tipo' para mostrarlo en hardware
        id_u = get_id_usuario()
        cursor.execute("SELECT idDispositivo, nombre, tipo FROM dispositivos WHERE idUsuario = %s", (id_u,))
        dispositivos = cursor.fetchall()
        cursor.close()
        conexion.close()
        return jsonify(dispositivos)
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


# ============================================================
# SENSORES
# ============================================================

@app.route('/api/sensores/agregar', methods=['POST'])
@login_requerido
def agregar_sensor():
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "INSERT INTO sensores (tipo_sensor, unidad_medida, idDispositivo) VALUES (%s, %s, %s)",
            (data['tipo'], data['unidad'], data['idDispositivo'])
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@app.route('/api/sensores/lista', methods=['GET'])
@login_requerido
def obtener_lista_sensores():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u = get_id_usuario()
        cursor.execute("""
            SELECT s.idSensore, s.tipo_sensor, s.unidad_medida, s.idDispositivo,
                   d.nombre AS nombre_dispositivo
            FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE d.idUsuario = %s
        """, (id_u,))
        sensores = cursor.fetchall()
        cursor.close()
        conexion.close()
        return jsonify(sensores)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/estado/<int:id_sensor>', methods=['GET'])
@login_requerido
def verificar_estado(id_sensor):
    """
    Verifica si el sensor tiene lecturas recientes (últimos 5 minutos).
    Devuelve activo=True si hay datos recientes, junto con la última lectura.
    """
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Verificar si existe el sensor
        cursor.execute("SELECT idSensore, tipo_sensor, unidad_medida FROM sensores WHERE idSensore = %s", (id_sensor,))
        sensor = cursor.fetchone()
        if not sensor:
            cursor.close()
            conexion.close()
            return jsonify({"error": "Sensor no encontrado"}), 404

        # Buscar la última lectura (últimos 5 minutos = activo)
        hace_5min = datetime.now() - timedelta(minutes=5)
        cursor.execute(
            "SELECT valor, fecha_hora FROM registro_sensores WHERE idSensor = %s ORDER BY fecha_hora DESC LIMIT 1",
            (id_sensor,)
        )
        ultima = cursor.fetchone()
        cursor.close()
        conexion.close()

        activo = False
        ultima_lectura = None

        if ultima:
            if isinstance(ultima['fecha_hora'], datetime):
                activo = ultima['fecha_hora'] >= hace_5min
                ultima_lectura = {
                    "valor": ultima['valor'],
                    "unidad": sensor['unidad_medida'],
                    "fecha_hora": ultima['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S')
                }
            else:
                ultima_lectura = {
                    "valor": ultima['valor'],
                    "unidad": sensor['unidad_medida'],
                    "fecha_hora": str(ultima['fecha_hora'])
                }
                activo = True  # Si hay fecha como string, asumimos activo

        return jsonify({
            "activo": activo,
            "ultima_lectura": ultima_lectura
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/datos-actuales/<int:id_sensor>', methods=['GET'])
@login_requerido
def datos_actuales(id_sensor):
    """
    Devuelve el dato más reciente del sensor desde la BD.
    Si no hay datos, devuelve error indicándolo.
    """
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Obtener unidad del sensor
        cursor.execute("SELECT unidad_medida FROM sensores WHERE idSensore = %s", (id_sensor,))
        sensor = cursor.fetchone()
        if not sensor:
            cursor.close()
            conexion.close()
            return jsonify({"error": "Sensor no encontrado"}), 404

        # Obtener última lectura
        cursor.execute(
            "SELECT valor, fecha_hora FROM registro_sensores WHERE idSensor = %s ORDER BY fecha_hora DESC LIMIT 1",
            (id_sensor,)
        )
        dato = cursor.fetchone()
        cursor.close()
        conexion.close()

        if not dato:
            return jsonify({"error": "Sin datos disponibles para este sensor"}), 404

        fecha_str = dato['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S') if isinstance(dato['fecha_hora'], datetime) else str(dato['fecha_hora'])

        return jsonify({
            "valor": dato['valor'],
            "unidad": sensor['unidad_medida'],
            "fecha_hora": fecha_str
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/analitica/<int:id_sensor>/<rango>', methods=['GET'])
@login_requerido
def obtener_analitica(id_sensor, rango):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        if rango == '24h':
            fecha_inicio = datetime.now() - timedelta(hours=24)
        elif rango == 'semana':
            fecha_inicio = datetime.now() - timedelta(days=7)
        else:
            fecha_inicio = datetime.now() - timedelta(hours=1)

        cursor.execute(
            "SELECT valor, fecha_hora FROM registro_sensores WHERE idSensor = %s AND fecha_hora >= %s ORDER BY fecha_hora ASC",
            (id_sensor, fecha_inicio)
        )
        datos = cursor.fetchall()
        cursor.close()
        conexion.close()

        for fila in datos:
            if isinstance(fila['fecha_hora'], datetime):
                fila['fecha_hora'] = fila['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# CULTIVOS
# ============================================================

@app.route('/api/cultivos/sembrar', methods=['POST'])
@login_requerido
def sembrar_cultivo():
    data = request.json

    campos_requeridos = ['nombre', 'fecha', 'cantidad', 'tamano', 'idTipo', 'idSistema']
    if not all(k in data for k in campos_requeridos):
        return jsonify({"error": "Faltan datos requeridos"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u = get_id_usuario()
        cursor.execute(
            """INSERT INTO cultivos (nombreCultivo, fecha_siembra, cantidad, tamano_planta, idTipo_Cultivo, idSistema, idUsuario)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (data['nombre'], data['fecha'], data['cantidad'], data['tamano'], data['idTipo'], data['idSistema'], id_u)
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "message": "Siembra registrada correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cultivos/lista', methods=['GET'])
@login_requerido
def obtener_cultivos():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u = get_id_usuario()
        cursor.execute("""
            SELECT c.idCultivo, c.nombreCultivo, c.fecha_siembra, c.cantidad,
                   c.tamano_planta, t.nombre_planta AS tipo_cultivo
            FROM cultivos c
            LEFT JOIN tipo_cultivo t ON c.idTipo_Cultivo = t.idTipo_Cultivo
            WHERE c.idUsuario = %s
        """, (id_u,))
        cultivos = cursor.fetchall()
        for row in cultivos:
            if hasattr(row.get('fecha_siembra'), 'strftime'):
                row['fecha_siembra'] = row['fecha_siembra'].strftime('%Y-%m-%d')
        cursor.close()
        conexion.close()
        return jsonify(cultivos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cultivos/editar/<int:id_cultivo>', methods=['PUT'])
@login_requerido
def editar_cultivo(id_cultivo):
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u = get_id_usuario()
        cursor.execute("""
            UPDATE cultivos
            SET nombreCultivo=%s, fecha_siembra=%s, cantidad=%s,
                tamano_planta=%s, idTipo_Cultivo=%s
            WHERE idCultivo=%s AND idUsuario=%s
        """, (data['nombre'], data['fecha'], data['cantidad'],
              data['tamano'], data['idTipo'], id_cultivo, id_u))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cultivos/eliminar/<int:id_cultivo>', methods=['DELETE'])
@login_requerido
def eliminar_cultivo(id_cultivo):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u = get_id_usuario()
        cursor.execute("DELETE FROM cultivos WHERE idCultivo=%s AND idUsuario=%s", (id_cultivo, id_u))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# TIPOS DE CULTIVO
# ============================================================

@app.route('/api/tipo_cultivo/lista', methods=['GET'])
@login_requerido
def obtener_tipos_cultivo():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("SELECT idTipo_Cultivo, nombre_planta FROM tipo_cultivo")
        tipos    = cursor.fetchall()
        cursor.close()
        conexion.close()
        return jsonify(tipos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/tipo_cultivo/agregar', methods=['POST'])
@login_requerido
def agregar_tipo_cultivo():
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "INSERT INTO tipo_cultivo (nombre_planta, descripcion) VALUES (%s, %s)",
            (data['nombre'], data['descripcion'])
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "message": "Tipo de cultivo agregado correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# COSECHAS
# ============================================================

@app.route('/api/cosechas/registrar', methods=['POST'])
@login_requerido
def registrar_cosecha():
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "INSERT INTO cosecha (fecha, cantidad, calidad, observaciones, idCultivo) VALUES (%s, %s, %s, %s, %s)",
            (data['fecha'], data['cantidad'], data['calidad'], data.get('observaciones', ''), data['idCultivo'])
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "message": "Cosecha registrada con éxito"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cosechas/lista', methods=['GET'])
@login_requerido
def obtener_cosechas():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u = get_id_usuario()
        cursor.execute("""
            SELECT cs.idCosecha, cs.fecha, cs.cantidad, cs.calidad,
                   cs.observaciones, c.nombreCultivo
            FROM cosecha cs
            INNER JOIN cultivos c ON cs.idCultivo = c.idCultivo
            WHERE c.idUsuario = %s
            ORDER BY cs.fecha DESC
        """, (id_u,))
        cosechas = cursor.fetchall()
        for row in cosechas:
            if hasattr(row.get('fecha'), 'strftime'):
                row['fecha'] = row['fecha'].strftime('%Y-%m-%d')
        cursor.close()
        conexion.close()
        return jsonify(cosechas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cosechas/editar/<int:id_cosecha>', methods=['PUT'])
@login_requerido
def editar_cosecha(id_cosecha):
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute("""
            UPDATE cosecha
            SET fecha=%s, cantidad=%s, calidad=%s, observaciones=%s
            WHERE idCosecha=%s
        """, (data['fecha'], data['cantidad'], data['calidad'],
              data.get('observaciones', ''), id_cosecha))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cosechas/eliminar/<int:id_cosecha>', methods=['DELETE'])
@login_requerido
def eliminar_cosecha(id_cosecha):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute("DELETE FROM cosecha WHERE idCosecha=%s", (id_cosecha,))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# ALERTAS — Parámetros (umbrales)
# ============================================================

@app.route('/api/alertas/parametros/lista', methods=['GET'])
@login_requerido
def listar_parametros():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u = get_id_usuario()
        cursor.execute("""
            SELECT p.idParametro, p.nombre, p.condicion, p.valor_umbral,
                   p.prioridad, p.activo,
                   s.tipo_sensor, s.unidad_medida, s.idSensore AS idSensor
            FROM Parametros_Alerta p
            JOIN sensores s ON p.idSensor = s.idSensore
            JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE d.idUsuario = %s
            ORDER BY p.prioridad DESC, p.idParametro DESC
        """, (id_u,))
        datos = cursor.fetchall()
        cursor.close()
        conexion.close()
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/parametros/agregar', methods=['POST'])
@login_requerido
def agregar_parametro():
    data   = request.json
    campos = ['idSensor', 'nombre', 'condicion', 'valor_umbral', 'prioridad']
    if not all(k in data for k in campos):
        return jsonify({"error": "Faltan campos requeridos"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            """INSERT INTO Parametros_Alerta (idSensor, nombre, condicion, valor_umbral, prioridad, activo)
               VALUES (%s, %s, %s, %s, %s, 1)""",
            (data['idSensor'], data['nombre'], data['condicion'], data['valor_umbral'], data['prioridad'])
        )
        conexion.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "idParametro": nuevo_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/parametros/editar/<int:id_param>', methods=['PUT'])
@login_requerido
def editar_parametro(id_param):
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            """UPDATE Parametros_Alerta
               SET nombre=%s, condicion=%s, valor_umbral=%s, prioridad=%s, activo=%s
               WHERE idParametro=%s""",
            (data['nombre'], data['condicion'], data['valor_umbral'],
             data['prioridad'], data.get('activo', 1), id_param)
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/parametros/eliminar/<int:id_param>', methods=['DELETE'])
@login_requerido
def eliminar_parametro(id_param):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute("DELETE FROM Parametros_Alerta WHERE idParametro=%s", (id_param,))
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# ALERTAS — Historial
# ============================================================

@app.route('/api/alertas/historial', methods=['GET'])
@login_requerido
def historial_alertas():
    try:
        prioridad = request.args.get('prioridad')
        estado    = request.args.get('estado')
        id_sensor = request.args.get('idSensor')
        limite    = int(request.args.get('limite', 200))

        condiciones = []
        valores     = []

        if prioridad:
            condiciones.append("h.prioridad = %s")
            valores.append(prioridad)
        if estado:
            condiciones.append("h.estado = %s")
            valores.append(estado)
        if id_sensor:
            condiciones.append("h.idSensor = %s")
            valores.append(id_sensor)

        id_u = get_id_usuario()
        condiciones.append("d.idUsuario = %s")
        valores.append(id_u)
        where = "WHERE " + " AND ".join(condiciones)

        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute(f"""
            SELECT h.idHistorial, h.valor_detectado, h.prioridad, h.estado,
                   h.mensaje, h.fecha_hora, h.fecha_resolucion,
                   s.tipo_sensor, s.unidad_medida,
                   p.nombre AS nombre_parametro, p.condicion, p.valor_umbral
            FROM Historial_Alertas h
            JOIN sensores s ON h.idSensor = s.idSensore
            JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            JOIN Parametros_Alerta p ON h.idParametro = p.idParametro
            {where}
            ORDER BY h.fecha_hora DESC
            LIMIT %s
        """, valores + [limite])

        datos = cursor.fetchall()
        for row in datos:
            if isinstance(row.get('fecha_hora'), datetime):
                row['fecha_hora'] = row['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(row.get('fecha_resolucion'), datetime):
                row['fecha_resolucion'] = row['fecha_resolucion'].strftime('%Y-%m-%d %H:%M:%S')

        cursor.close()
        conexion.close()
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/historial/registrar', methods=['POST'])
@login_requerido
def registrar_alerta():
    data   = request.json
    campos = ['idParametro', 'idSensor', 'valor_detectado', 'prioridad']
    if not all(k in data for k in campos):
        return jsonify({"error": "Faltan campos requeridos"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            """INSERT INTO Historial_Alertas (idParametro, idSensor, valor_detectado, prioridad, estado, mensaje)
               VALUES (%s, %s, %s, %s, 'nueva', %s)""",
            (data['idParametro'], data['idSensor'], data['valor_detectado'],
             data['prioridad'], data.get('mensaje', ''))
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/historial/estado/<int:id_historial>', methods=['PUT'])
@login_requerido
def actualizar_estado_alerta(id_historial):
    data         = request.json
    nuevo_estado = data.get('estado')

    if nuevo_estado not in ('vista', 'resuelta'):
        return jsonify({"error": "Estado inválido"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        if nuevo_estado == 'resuelta':
            cursor.execute(
                "UPDATE Historial_Alertas SET estado=%s, fecha_resolucion=NOW() WHERE idHistorial=%s",
                (nuevo_estado, id_historial)
            )
        else:
            cursor.execute(
                "UPDATE Historial_Alertas SET estado=%s WHERE idHistorial=%s",
                (nuevo_estado, id_historial)
            )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/conteo', methods=['GET'])
@login_requerido
def conteo_alertas_nuevas():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute("SELECT COUNT(*) FROM Historial_Alertas WHERE estado='nueva'")
        total    = cursor.fetchone()[0]
        cursor.close()
        conexion.close()
        return jsonify({"nuevas": total})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# RELEVADOR — API para el dashboard
# ============================================================

@app.route('/api/relevador/config', methods=['GET'])
@login_requerido
def obtener_config_relevador():
    """El dashboard lee la configuración actual."""
    with relay_lock:
        return jsonify(config_relevador.copy())


@app.route('/api/relevador/config', methods=['POST'])
@login_requerido
def guardar_config_relevador():
    """
    El dashboard guarda nueva config.
    Body: {"tiempo_on": 30, "tiempo_off": 60, "modo": "automatico"}
    Flask publica el nuevo tiempo al feed MQTT de Adafruit IO
    para que el Arduino lo reciba (si agregas suscripción en el Arduino).
    """
    data = request.json
    with relay_lock:
        config_relevador['tiempo_on']  = int(data.get('tiempo_on', 30))
        config_relevador['tiempo_off'] = int(data.get('tiempo_off', 60))
        config_relevador['modo']       = data.get('modo', 'automatico')
    return jsonify({"status": "ok", "config": config_relevador})


@app.route('/api/relevador/estado', methods=['GET'])
@login_requerido
def estado_relevador():
    """El dashboard consulta el estado actual del relevador."""
    with relay_lock:
        return jsonify(config_relevador.copy())


# ============================================================
# INICIO
# ============================================================

if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG', 'False') == 'True', host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
