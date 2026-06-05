from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from functools import wraps
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import threading
import os
import random
import string

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

app.secret_key = os.environ.get("SECRET_KEY", "cambia_esta_clave_en_produccion")


# ============================================================
# BASE DE DATOS
# ============================================================

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
# AUTENTICACIÓN
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
    correo = session.get('usuario_logueado')
    if not correo:
        return None
    try:
        cx  = conectar_bd()
        cur = cx.cursor()
        cur.execute("SELECT idUsuario FROM usuarios WHERE correo = %s", (correo,))
        row = cur.fetchone()
        cur.close()
        cx.close()
        return row[0] if row else None
    except:
        return None


# ============================================================
# CONFIG POR DISPOSITIVO
# Cada Arduino se identifica con su device_id (= idDispositivo).
# Las configs se guardan separadas — nunca se mezclan entre usuarios.
# ============================================================

relay_configs: dict = {}   # cache en memoria para evitar consultas repetidas
relay_lock = threading.Lock()

wifi_pendiente: dict = {}  # wifi_pendiente[device_id] = {ssid, password}
wifi_actual:    dict = {}  # wifi_actual[device_id]    = {ssid, fecha}
wifi_historial: dict = {}  # wifi_historial[device_id] = [{ssid, fecha}, ...]
wifi_lock = threading.Lock()


def _relay_default():
    return {"tiempo_on": 30, "tiempo_off": 60,
            "modo": "automatico", "estado_manual": "apagado"}


def get_relay(device_id: int) -> dict:
    """Lee config del relay desde BD. Si no existe, devuelve valores por defecto."""
    with relay_lock:
        if device_id in relay_configs:
            return relay_configs[device_id].copy()
    try:
        cx  = conectar_bd()
        cur = cx.cursor(dictionary=True)
        cur.execute("""
            SELECT tiempo_on, tiempo_off, modo, estado_manual
            FROM config_relay
            WHERE idDispositivo = %s
            LIMIT 1
        """, (device_id,))
        row = cur.fetchone()
        cur.close(); cx.close()
        if row:
            config = {
                "tiempo_on":     row["tiempo_on"],
                "tiempo_off":    row["tiempo_off"],
                "modo":          row["modo"],
                "estado_manual": row["estado_manual"],
            }
        else:
            config = _relay_default()
    except Exception as e:
        print(f"[RELAY get_relay] Error BD: {e} — usando defaults")
        config = _relay_default()
    with relay_lock:
        relay_configs[device_id] = config
    return config.copy()


def set_relay(device_id: int, data: dict):
    """Guarda config del relay en BD y actualiza el cache."""
    config = {
        "tiempo_on":     int(data.get("tiempo_on",     30)),
        "tiempo_off":    int(data.get("tiempo_off",    60)),
        "modo":          data.get("modo",          "automatico"),
        "estado_manual": data.get("estado_manual", "apagado"),
    }
    try:
        cx  = conectar_bd()
        cur = cx.cursor()
        cur.execute("""
            INSERT INTO config_relay (idDispositivo, tiempo_on, tiempo_off, modo, estado_manual)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                tiempo_on     = VALUES(tiempo_on),
                tiempo_off    = VALUES(tiempo_off),
                modo          = VALUES(modo),
                estado_manual = VALUES(estado_manual)
        """, (device_id, config["tiempo_on"], config["tiempo_off"],
              config["modo"], config["estado_manual"]))
        cx.commit()
        cur.close(); cx.close()
    except Exception as e:
        print(f"[RELAY set_relay] Error BD: {e}")
    with relay_lock:
        relay_configs[device_id] = config


# ============================================================
# CONVERSIÓN DE VALORES
# ============================================================

def convertir_valor(raw, tipo_conv):
    v = float(raw)
    if tipo_conv == "ph":
        voltaje = v * (5.0 / 1023.0)
        ph = 7.0 + ((2.5 - voltaje) / 0.18)
        return round(max(0.0, min(14.0, ph)), 2)
    elif tipo_conv == "luz":
        return round((v / 1023.0) * 5000, 1)
    return round(v, 2)


def guardar_lectura_bd(id_sensor, valor):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute(
            "INSERT INTO registro_sensores (idSensor, valor, fecha_hora) VALUES (%s, %s, NOW())",
            (id_sensor, valor)
        )
        cursor.execute("""
            SELECT idParametro, nombre, condicion, valor_umbral, prioridad
            FROM parametros_alerta
            WHERE idSensor = %s AND activo = 1
        """, (id_sensor,))
        for p in cursor.fetchall():
            umbral  = float(p['valor_umbral'])
            cond    = p['condicion']
            disparo = (
                (cond == 'mayor_que' and valor > umbral) or
                (cond == 'menor_que' and valor < umbral) or
                (cond == 'igual_a'   and valor == umbral)
            )
            if disparo:
                msg = f"Sensor {id_sensor}: valor {valor} {cond.replace('_',' ')} umbral {umbral}"
                cursor.execute("""
                    INSERT INTO historial_alertas
                        (idParametro, idSensor, valor_detectado, prioridad, estado, mensaje)
                    VALUES (%s, %s, %s, %s, 'nueva', %s)
                """, (p['idParametro'], id_sensor, valor, p['prioridad'], msg))
        conexion.commit()
        cursor.close()
        conexion.close()
    except Exception as e:
        print(f"[BD ERROR] {e}")


# ============================================================
# ENDPOINTS PARA EL ARDUINO — sin sesión, protegidos con token
# ============================================================

ARDUINO_TOKEN = os.environ.get("ARDUINO_TOKEN", "token_secreto_arduino")

TIPO_CONV_MAP = {
    "temperatura": None,
    "humedad":     None,
    "ph":          "ph",
    "luz":         "luz",
    "nivel agua":  None,
    "distancia":   None,
}


@app.route('/api/arduino/registrar', methods=['POST'])
def arduino_registrar():
    """
    El Arduino llama esto UNA SOLA VEZ cuando no tiene device_id en EEPROM.
    Body: { "token": "xxx", "nombre": "MiArduino" }
    Responde: { "device_id": 3 }
    El Arduino guarda ese id en EEPROM y ya nunca vuelve a llamar esto.
    """
    data = request.json or {}
    if data.get("token") != ARDUINO_TOKEN:
        return jsonify({"error": "No autorizado"}), 401

    nombre = data.get("nombre", "Arduino").strip() or "Arduino"

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Buscar si ya existe un dispositivo con ese nombre sin usuario asignado
        # (por si el Arduino se registró antes y perdió la EEPROM)
        cursor.execute(
            "SELECT idDispositivo FROM dispositivos WHERE nombre=%s AND idUsuario IS NULL LIMIT 1",
            (nombre,)
        )
        existente = cursor.fetchone()

        if existente:
            device_id = existente['idDispositivo']
        else:
            cursor.execute(
                "INSERT INTO dispositivos (nombre, tipo, idSistema, idUsuario) VALUES (%s, %s, 1, NULL)",
                (nombre, "Arduino Mega + ESP-01")
            )
            conexion.commit()
            device_id = cursor.lastrowid

        cursor.close()
        conexion.close()
        print(f"[ARDUINO REGISTRAR] nombre='{nombre}' → device_id={device_id}")
        return jsonify({"status": "ok", "device_id": device_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/arduino/datos', methods=['POST'])
def arduino_datos():
    """
    El Arduino Mega manda un POST cada 10 s.
    Body JSON:
    {
      "token":     "token_secreto_arduino",
      "device_id": 1,
      "sensores": {
        "temperatura": 25.3,
        "humedad":     68.0,
        "ph":          512,
        "luz":         780,
        "distancia":   14.5
      }
    }
    Busca los sensores DEL dispositivo indicado — cada usuario
    tiene sus propios registros, no hay mezcla.
    """
    data = request.json or {}
    if data.get("token") != ARDUINO_TOKEN:
        return jsonify({"error": "No autorizado"}), 401

    device_id = data.get("device_id")
    sensores  = data.get("sensores", {})

    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400
    if not sensores:
        return jsonify({"error": "Sin datos de sensores"}), 400

    guardados = []
    errores   = []

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        for tipo_raw, valor_raw in sensores.items():
            tipo = tipo_raw.lower().strip()
            cursor.execute("""
                SELECT s.idSensore
                FROM sensores s
                WHERE s.idDispositivo = %s
                  AND LOWER(s.tipo_sensor) = %s
                LIMIT 1
            """, (device_id, tipo))
            row = cursor.fetchone()

            if not row:
                errores.append(f"Sensor '{tipo}' no registrado para dispositivo {device_id}")
                continue

            id_sensor = row['idSensore']
            conv      = TIPO_CONV_MAP.get(tipo, None)
            try:
                valor = convertir_valor(valor_raw, conv)
                guardar_lectura_bd(id_sensor, valor)
                guardados.append({"tipo": tipo, "id": id_sensor, "valor": valor})
                print(f"[ARDUINO dev={device_id}] {tipo}: {valor}")
            except Exception as e:
                errores.append(f"{tipo}: {e}")

        cursor.close()
        conexion.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"status": "ok", "guardados": guardados, "errores": errores})


@app.route('/api/arduino/config', methods=['GET'])
def arduino_config():
    """
    El Arduino consulta esta URL cada ciclo para recibir:
    - Config del relevador (modo, tiempos, estado manual)
    - Config WiFi pendiente (si el dashboard mandó nueva red)
    La WiFi pendiente se entrega UNA SOLA VEZ y se borra.

    GET /api/arduino/config?token=XXX&device_id=1
    """
    if request.args.get("token") != ARDUINO_TOKEN:
        return jsonify({"error": "No autorizado"}), 401

    device_id = request.args.get("device_id", type=int)
    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400

    relay = get_relay(device_id)

    with wifi_lock:
        wifi = wifi_pendiente.pop(device_id, {"ssid": None, "password": None})

    return jsonify({"relay": relay, "wifi": wifi})


@app.route('/api/arduino/emparejar', methods=['POST'])
def arduino_emparejar():
    """
    El Arduino llama esto la primera vez con su pairing_code.
    Responde con el device_id si el código es válido y no expirado.
    El código se invalida después de usarse.
    """
    data = request.json or {}
    if data.get("token") != ARDUINO_TOKEN:
        return jsonify({"error": "No autorizado"}), 401

    codigo = data.get("pairing_code", "").strip().upper()
    if not codigo:
        return jsonify({"error": "Falta pairing_code"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT idDispositivo FROM dispositivos
            WHERE pairing_code = %s AND pairing_usado = 0
            LIMIT 1
        """, (codigo,))
        row = cursor.fetchone()

        if not row:
            cursor.close(); conexion.close()
            return jsonify({"error": "Código inválido o ya usado"}), 404

        device_id = row['idDispositivo']

        # Marcar código como usado
        cursor.execute("""
            UPDATE dispositivos SET pairing_usado = 1 WHERE idDispositivo = %s
        """, (device_id,))
        conexion.commit()
        cursor.close(); conexion.close()

        print(f"[EMPAREJAR] device_id={device_id} emparejado con código {codigo}")
        return jsonify({"status": "ok", "device_id": device_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
# AUTENTICACIÓN API
# ============================================================

@app.route('/api/auth/registrar', methods=['POST'])
def registrar_usuario():
    try:
        data               = request.json
        nombre             = data.get('nombre', '').strip()
        apellido_paterno   = data.get('apellido_paterno', '').strip()
        apellido_materno   = data.get('apellido_materno', '').strip()
        correo             = data.get('correo', '').strip()
        contrasena         = data.get('contrasena')

        if not nombre or not apellido_paterno or not apellido_materno or not correo or not contrasena:
            return jsonify({"status": "error", "mensaje": "Datos incompletos"}), 400

        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "INSERT INTO `usuarios` (`nombre`, `apellido_paterno`, `apellido_materno`, `correo`, `contraseña`) VALUES (%s, %s, %s, %s, %s)",
            (nombre, apellido_paterno, apellido_materno, correo, generate_password_hash(contrasena))
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "mensaje": "Usuario registrado"})
    except mysql.connector.Error as err:
        return jsonify({"status": "error", "mensaje": str(err)}), 500


@app.route('/api/usuario/actualizar_nombre', methods=['POST'])
@login_requerido
def actualizar_nombre():
    try:
        data             = request.json or {}
        nombre           = data.get('nombre', '').strip()
        apellido_paterno = data.get('apellido_paterno', '').strip()
        apellido_materno = data.get('apellido_materno', '').strip()

        if not nombre or not apellido_paterno or not apellido_materno:
            return jsonify({"status": "error", "mensaje": "Todos los campos son requeridos"}), 400

        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute(
            "UPDATE usuarios SET nombre=%s, apellido_paterno=%s, apellido_materno=%s WHERE correo=%s",
            (nombre, apellido_paterno, apellido_materno, session['usuario_logueado'])
        )
        conexion.commit()
        cursor.close()
        conexion.close()

        session['usuario_nombre'] = nombre
        return jsonify({"status": "success", "mensaje": "Nombre actualizado correctamente"})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


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
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT nombre, apellido_paterno, apellido_materno, correo, foto_perfil FROM usuarios WHERE correo = %s",
            (session['usuario_logueado'],)
        )
        usuario = cursor.fetchone()
        cursor.close()
        conexion.close()

        if not usuario:
            return jsonify({"error": "Usuario no encontrado"}), 404

        return jsonify({
            "nombre":           usuario['nombre'],
            "apellido_paterno": usuario.get('apellido_paterno') or '',
            "apellido_materno": usuario.get('apellido_materno') or '',
            "correo":           usuario['correo'],
            "foto_perfil":      usuario.get('foto_perfil') or None
        })
    except Exception:
        try:
            conexion = conectar_bd()
            cursor   = conexion.cursor(dictionary=True)
            cursor.execute(
                "SELECT nombre, correo FROM usuarios WHERE correo = %s",
                (session['usuario_logueado'],)
            )
            usuario = cursor.fetchone()
            cursor.close()
            conexion.close()
            return jsonify({"nombre": usuario['nombre'], "correo": usuario['correo'], "foto_perfil": None})
        except Exception as e2:
            return jsonify({"error": str(e2)}), 500


@app.route('/api/usuario/password', methods=['POST'])
@login_requerido
def cambiar_password():
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
    data = request.json
    foto = data.get('foto')

    if not foto:
        return jsonify({"error": "No se recibió imagen"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        try:
            cursor.execute("ALTER TABLE usuarios ADD COLUMN foto_perfil LONGTEXT NULL")
            conexion.commit()
        except Exception:
            pass
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

def _generar_pairing_code():
    """Genera un código único tipo HIDRO-XXXX."""
    sufijo = ''.join(random.choices(string.digits, k=4))
    return f"HIDRO-{sufijo}"


@app.route('/api/dispositivos/agregar', methods=['POST'])
@login_requerido
def agregar_dispositivo():
    data   = request.json
    nombre = data.get('nombre')
    tipo   = data.get('tipo')

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()

        # Generar código de emparejamiento único
        for _ in range(10):
            codigo = _generar_pairing_code()
            cursor.execute("SELECT idDispositivo FROM dispositivos WHERE pairing_code = %s", (codigo,))
            if not cursor.fetchone():
                break

        cursor.execute(
            "INSERT INTO dispositivos (nombre, tipo, idSistema, idUsuario, pairing_code) VALUES (%s, %s, 1, %s, %s)",
            (nombre, tipo, id_u, codigo)
        )
        conexion.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conexion.close()
        return jsonify({"status": "success", "idDispositivo": nuevo_id, "pairing_code": codigo})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@app.route('/api/dispositivos/eliminar/<int:id_dispositivo>', methods=['DELETE'])
@login_requerido
def eliminar_dispositivo(id_dispositivo):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        # Verificar que el dispositivo pertenece al usuario
        cursor.execute(
            "SELECT idDispositivo FROM dispositivos WHERE idDispositivo=%s AND idUsuario=%s",
            (id_dispositivo, id_u)
        )
        if not cursor.fetchone():
            return jsonify({"status": "error", "mensaje": "Dispositivo no encontrado"}), 404
        # Borrar hijos en orden correcto (integridad referencial)
        cursor.execute("SELECT idSensore FROM sensores WHERE idDispositivo=%s", (id_dispositivo,))
        ids_sensores = [row[0] for row in cursor.fetchall()]
        for sid in ids_sensores:
            cursor.execute("DELETE FROM historial_alertas WHERE idSensor=%s", (sid,))
            cursor.execute("DELETE FROM parametros_alerta WHERE idSensor=%s", (sid,))
            cursor.execute("DELETE FROM registro_sensores WHERE idSensor=%s", (sid,))
        cursor.execute("DELETE FROM config_relay WHERE idDispositivo=%s", (id_dispositivo,))
        cursor.execute("DELETE FROM sensores WHERE idDispositivo=%s", (id_dispositivo,))
        cursor.execute("DELETE FROM dispositivos WHERE idDispositivo=%s", (id_dispositivo,))
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
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u     = get_id_usuario()
        # Dispositivos propios + dispositivos compartidos como miembro
        cursor.execute("""
            SELECT d.idDispositivo, d.nombre, d.tipo, 'dueno' AS rol
            FROM dispositivos d
            WHERE d.idUsuario = %s

            UNION

            SELECT d.idDispositivo, d.nombre, d.tipo, dm.permiso AS rol
            FROM dispositivo_miembros dm
            JOIN dispositivos d ON dm.idDispositivo = d.idDispositivo
            WHERE dm.idUsuario = %s
        """, (id_u, id_u))
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
        id_u     = get_id_usuario()
        # Verificar que el dispositivo pertenece al usuario
        cursor.execute(
            "SELECT idDispositivo FROM dispositivos WHERE idDispositivo=%s AND idUsuario=%s",
            (data['idDispositivo'], id_u)
        )
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"status": "error", "mensaje": "Dispositivo no encontrado"}), 404
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


@app.route('/api/sensores/editar/<int:id_sensor>', methods=['PUT'])
@login_requerido
def editar_sensor(id_sensor):
    data = request.json
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        # Verificar que el sensor pertenece a un dispositivo del usuario
        cursor.execute("""
            SELECT s.idSensore FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE s.idSensore=%s AND d.idUsuario=%s
        """, (id_sensor, id_u))
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"status": "error", "mensaje": "Sensor no encontrado"}), 404
        cursor.execute(
            "UPDATE sensores SET tipo_sensor=%s, unidad_medida=%s WHERE idSensore=%s",
            (data['tipo'], data['unidad'], id_sensor)
        )
        conexion.commit()
        cursor.close()
        conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500


@app.route('/api/sensores/eliminar/<int:id_sensor>', methods=['DELETE'])
@login_requerido
def eliminar_sensor(id_sensor):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        # Verificar que el sensor pertenece a un dispositivo del usuario
        cursor.execute("""
            SELECT s.idSensore FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE s.idSensore=%s AND d.idUsuario=%s
        """, (id_sensor, id_u))
        if not cursor.fetchone():
            return jsonify({"status": "error", "mensaje": "Sensor no encontrado"}), 404
        cursor.execute("DELETE FROM historial_alertas WHERE idSensor=%s", (id_sensor,))
        cursor.execute("DELETE FROM parametros_alerta WHERE idSensor=%s", (id_sensor,))
        cursor.execute("DELETE FROM registro_sensores WHERE idSensor=%s", (id_sensor,))
        cursor.execute("DELETE FROM sensores WHERE idSensore=%s", (id_sensor,))
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
        id_u     = get_id_usuario()
        cursor.execute("""
            SELECT s.idSensore, s.tipo_sensor, s.unidad_medida, s.idDispositivo,
                   d.nombre AS nombre_dispositivo
            FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE d.idUsuario = %s

            UNION

            SELECT s.idSensore, s.tipo_sensor, s.unidad_medida, s.idDispositivo,
                   d.nombre AS nombre_dispositivo
            FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            INNER JOIN dispositivo_miembros dm ON dm.idDispositivo = d.idDispositivo
            WHERE dm.idUsuario = %s
        """, (id_u, id_u))
        sensores = cursor.fetchall()
        cursor.close()
        conexion.close()
        return jsonify(sensores)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/estado/<int:id_sensor>', methods=['GET'])
@login_requerido
def verificar_estado(id_sensor):
    try:
        conexion  = conectar_bd()
        cursor    = conexion.cursor(dictionary=True)
        cursor.execute(
            "SELECT idSensore, tipo_sensor, unidad_medida FROM sensores WHERE idSensore = %s",
            (id_sensor,)
        )
        sensor = cursor.fetchone()
        if not sensor:
            cursor.close(); conexion.close()
            return jsonify({"error": "Sensor no encontrado"}), 404

        hace_5min = datetime.now() - timedelta(minutes=5)
        cursor.execute(
            "SELECT valor, fecha_hora FROM registro_sensores WHERE idSensor = %s ORDER BY fecha_hora DESC LIMIT 1",
            (id_sensor,)
        )
        ultima = cursor.fetchone()
        cursor.close(); conexion.close()

        activo         = False
        ultima_lectura = None

        if ultima:
            if isinstance(ultima['fecha_hora'], datetime):
                activo = ultima['fecha_hora'] >= hace_5min
                ultima_lectura = {
                    "valor":      ultima['valor'],
                    "unidad":     sensor['unidad_medida'],
                    "fecha_hora": ultima['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S')
                }
            else:
                activo = True
                ultima_lectura = {
                    "valor":      ultima['valor'],
                    "unidad":     sensor['unidad_medida'],
                    "fecha_hora": str(ultima['fecha_hora'])
                }

        return jsonify({"activo": activo, "ultima_lectura": ultima_lectura})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/datos-actuales/<int:id_sensor>', methods=['GET'])
@login_requerido
def datos_actuales(id_sensor):
    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Verificar que el sensor pertenece a un dispositivo propio o compartido
        cursor.execute("""
            SELECT s.idSensore, s.unidad_medida FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE s.idSensore = %s AND (
                d.idUsuario = %s OR
                EXISTS (SELECT 1 FROM dispositivo_miembros dm
                        WHERE dm.idDispositivo = d.idDispositivo AND dm.idUsuario = %s)
            )
        """, (id_sensor, id_u, id_u))
        sensor = cursor.fetchone()
        if not sensor:
            cursor.close(); conexion.close()
            return jsonify({"error": "Sensor no encontrado"}), 404

        cursor.execute(
            "SELECT valor, fecha_hora FROM registro_sensores WHERE idSensor = %s ORDER BY fecha_hora DESC LIMIT 1",
            (id_sensor,)
        )
        dato = cursor.fetchone()
        cursor.close(); conexion.close()

        if not dato:
            return jsonify({"error": "Sin datos disponibles para este sensor"}), 404

        fecha_str = dato['fecha_hora'].strftime('%Y-%m-%d %H:%M:%S') if isinstance(dato['fecha_hora'], datetime) else str(dato['fecha_hora'])
        return jsonify({"valor": dato['valor'], "unidad": sensor['unidad_medida'], "fecha_hora": fecha_str})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sensores/analitica/<int:id_sensor>/<rango>', methods=['GET'])
@login_requerido
def obtener_analitica(id_sensor, rango):
    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Verificar acceso propio o como miembro
        cursor.execute("""
            SELECT s.idSensore FROM sensores s
            INNER JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE s.idSensore = %s AND (
                d.idUsuario = %s OR
                EXISTS (SELECT 1 FROM dispositivo_miembros dm
                        WHERE dm.idDispositivo = d.idDispositivo AND dm.idUsuario = %s)
            )
        """, (id_sensor, id_u, id_u))
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403

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
        cursor.close(); conexion.close()

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
    if not all(k in data for k in ['nombre', 'fecha', 'cantidad', 'tamano', 'idTipo', 'idSistema']):
        return jsonify({"error": "Faltan datos requeridos"}), 400

    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        cursor.execute(
            """INSERT INTO cultivos (nombreCultivo, fecha_siembra, cantidad, tamano_planta,
                                     idTipo_Cultivo, idSistema, idUsuario)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (data['nombre'], data['fecha'], data['cantidad'], data['tamano'],
             data['idTipo'], data['idSistema'], id_u)
        )
        conexion.commit()
        cursor.close(); conexion.close()
        return jsonify({"status": "success", "message": "Siembra registrada correctamente"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cultivos/lista', methods=['GET'])
@login_requerido
def obtener_cultivos():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u     = get_id_usuario()
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
        cursor.close(); conexion.close()
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
        id_u     = get_id_usuario()
        cursor.execute("""
            UPDATE cultivos
            SET nombreCultivo=%s, fecha_siembra=%s, cantidad=%s,
                tamano_planta=%s, idTipo_Cultivo=%s
            WHERE idCultivo=%s AND idUsuario=%s
        """, (data['nombre'], data['fecha'], data['cantidad'],
              data['tamano'], data['idTipo'], id_cultivo, id_u))
        conexion.commit()
        cursor.close(); conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cultivos/eliminar/<int:id_cultivo>', methods=['DELETE'])
@login_requerido
def eliminar_cultivo(id_cultivo):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        # Borrar cosechas vinculadas primero (integridad referencial)
        cursor.execute("DELETE FROM cosecha WHERE idCultivo=%s", (id_cultivo,))
        cursor.execute("DELETE FROM cultivos WHERE idCultivo=%s AND idUsuario=%s", (id_cultivo, id_u))
        conexion.commit()
        cursor.close(); conexion.close()
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
        tipos = cursor.fetchall()
        cursor.close(); conexion.close()
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
        cursor.close(); conexion.close()
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
        cursor.close(); conexion.close()
        return jsonify({"status": "success", "message": "Cosecha registrada con éxito"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cosechas/lista', methods=['GET'])
@login_requerido
def obtener_cosechas():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u     = get_id_usuario()
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
        cursor.close(); conexion.close()
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
        cursor.close(); conexion.close()
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
        cursor.close(); conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# ALERTAS — Parámetros
# ============================================================

@app.route('/api/alertas/parametros/lista', methods=['GET'])
@login_requerido
def listar_parametros():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        id_u     = get_id_usuario()
        cursor.execute("""
            SELECT p.idParametro, p.nombre, p.condicion, p.valor_umbral,
                   p.prioridad, p.activo,
                   s.tipo_sensor, s.unidad_medida, s.idSensore AS idSensor
            FROM parametros_alerta p
            JOIN sensores s ON p.idSensor = s.idSensore
            JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE d.idUsuario = %s
            ORDER BY p.prioridad DESC, p.idParametro DESC
        """, (id_u,))
        datos = cursor.fetchall()
        cursor.close(); conexion.close()
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
            """INSERT INTO parametros_alerta (idSensor, nombre, condicion, valor_umbral, prioridad, activo)
               VALUES (%s, %s, %s, %s, %s, 1)""",
            (data['idSensor'], data['nombre'], data['condicion'], data['valor_umbral'], data['prioridad'])
        )
        conexion.commit()
        nuevo_id = cursor.lastrowid
        cursor.close(); conexion.close()
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
            """UPDATE parametros_alerta
               SET nombre=%s, condicion=%s, valor_umbral=%s, prioridad=%s, activo=%s
               WHERE idParametro=%s""",
            (data['nombre'], data['condicion'], data['valor_umbral'],
             data['prioridad'], data.get('activo', 1), id_param)
        )
        conexion.commit()
        cursor.close(); conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/parametros/eliminar/<int:id_param>', methods=['DELETE'])
@login_requerido
def eliminar_parametro(id_param):
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        cursor.execute("DELETE FROM historial_alertas WHERE idParametro=%s", (id_param,))
        cursor.execute("DELETE FROM parametros_alerta WHERE idParametro=%s", (id_param,))
        conexion.commit()
        cursor.close(); conexion.close()
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
            condiciones.append("h.prioridad = %s"); valores.append(prioridad)
        if estado:
            condiciones.append("h.estado = %s");    valores.append(estado)
        if id_sensor:
            condiciones.append("h.idSensor = %s");  valores.append(id_sensor)

        id_u = get_id_usuario()
        condiciones.append("d.idUsuario = %s"); valores.append(id_u)
        where = "WHERE " + " AND ".join(condiciones)

        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute(f"""
            SELECT h.idHistorial, h.valor_detectado, h.prioridad, h.estado,
                   h.mensaje, h.fecha_hora, h.fecha_resolucion,
                   s.tipo_sensor, s.unidad_medida,
                   p.nombre AS nombre_parametro, p.condicion, p.valor_umbral
            FROM historial_alertas h
            JOIN sensores s ON h.idSensor = s.idSensore
            JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            JOIN parametros_alerta p ON h.idParametro = p.idParametro
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

        cursor.close(); conexion.close()
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
            """INSERT INTO historial_alertas (idParametro, idSensor, valor_detectado, prioridad, estado, mensaje)
               VALUES (%s, %s, %s, %s, 'nueva', %s)""",
            (data['idParametro'], data['idSensor'], data['valor_detectado'],
             data['prioridad'], data.get('mensaje', ''))
        )
        conexion.commit()
        cursor.close(); conexion.close()
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
                "UPDATE historial_alertas SET estado=%s, fecha_resolucion=NOW() WHERE idHistorial=%s",
                (nuevo_estado, id_historial)
            )
        else:
            cursor.execute(
                "UPDATE historial_alertas SET estado=%s WHERE idHistorial=%s",
                (nuevo_estado, id_historial)
            )
        conexion.commit()
        cursor.close(); conexion.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/alertas/conteo', methods=['GET'])
@login_requerido
def conteo_alertas_nuevas():
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor()
        id_u     = get_id_usuario()
        cursor.execute("""
            SELECT COUNT(*) FROM historial_alertas h
            JOIN sensores s ON h.idSensor = s.idSensore
            JOIN dispositivos d ON s.idDispositivo = d.idDispositivo
            WHERE h.estado='nueva' AND d.idUsuario=%s
        """, (id_u,))
        total = cursor.fetchone()[0]
        cursor.close(); conexion.close()
        return jsonify({"nuevas": total})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# RELEVADOR — API para el dashboard
# ============================================================

@app.route('/api/relevador/config', methods=['GET'])
@login_requerido
def obtener_config_relevador():
    device_id = request.args.get("device_id", type=int)
    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400
    id_u = get_id_usuario()
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT d.idDispositivo FROM dispositivos d
            WHERE d.idDispositivo = %s AND (
                d.idUsuario = %s OR
                EXISTS (SELECT 1 FROM dispositivo_miembros dm
                        WHERE dm.idDispositivo = d.idDispositivo AND dm.idUsuario = %s)
            )
        """, (device_id, id_u, id_u))
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403
        cursor.close(); conexion.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(get_relay(device_id))


@app.route('/api/relevador/config', methods=['POST'])
@login_requerido
def guardar_config_relevador():
    data      = request.json or {}
    device_id = data.get("device_id")
    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400
    device_id = int(device_id)
    id_u = get_id_usuario()
    print(f"[RELAY POST] device_id={device_id} id_u={id_u}")
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        # Dueño o miembro con permiso controlar
        cursor.execute("""
            SELECT d.idDispositivo FROM dispositivos d
            WHERE d.idDispositivo = %s AND (
                d.idUsuario = %s OR
                EXISTS (SELECT 1 FROM dispositivo_miembros dm
                        WHERE dm.idDispositivo = %s
                          AND dm.idUsuario = %s AND dm.permiso = 'controlar')
            )
        """, (device_id, id_u, device_id, id_u))
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403
        cursor.close(); conexion.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    set_relay(device_id, data)
    print(f"[RELAY dev={device_id}] modo={data.get('modo')} on={data.get('tiempo_on')}s")
    return jsonify({"status": "ok", "config": get_relay(device_id)})


@app.route('/api/relevador/estado', methods=['GET'])
@login_requerido
def estado_relevador():
    device_id = request.args.get("device_id", type=int)
    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400
    id_u = get_id_usuario()
    try:
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT d.idDispositivo FROM dispositivos d
            WHERE d.idDispositivo = %s AND (
                d.idUsuario = %s OR
                EXISTS (SELECT 1 FROM dispositivo_miembros dm
                        WHERE dm.idDispositivo = d.idDispositivo AND dm.idUsuario = %s)
            )
        """, (device_id, id_u, id_u))
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403
        cursor.close(); conexion.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(get_relay(device_id))


# ============================================================
# WIFI — Configurar red del Arduino desde el dashboard
# ============================================================

@app.route('/api/arduino/reportar_wifi', methods=['POST'])
def arduino_reportar_wifi():
    """
    El Arduino llama esto cada vez que se conecta exitosamente a una red WiFi.
    Body: { "token": "xxx", "device_id": 1, "ssid": "MiRed" }
    El dashboard puede consultar esta info en /api/wifi/estado
    """
    data = request.json or {}
    if data.get("token") != ARDUINO_TOKEN:
        return jsonify({"error": "No autorizado"}), 401

    device_id = data.get("device_id")
    ssid      = data.get("ssid", "").strip()

    if not device_id or not ssid:
        return jsonify({"error": "Faltan datos"}), 400

    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    with wifi_lock:
        wifi_actual[device_id] = {"ssid": ssid, "fecha": fecha}
        hist = wifi_historial.setdefault(device_id, [])
        hist[:] = [h for h in hist if h["ssid"] != ssid]
        hist.append({"ssid": ssid, "fecha": fecha})

    print(f"[WiFi dev={device_id}] Arduino conectado a: {ssid}")
    return jsonify({"status": "ok"})


@app.route('/api/wifi/estado', methods=['GET'])
@login_requerido
def wifi_estado():
    device_id = request.args.get("device_id", type=int)
    if not device_id:
        return jsonify({"ssid": None, "fecha": None})
    return jsonify(wifi_actual.get(device_id, {"ssid": None, "fecha": None}))


@app.route('/api/wifi/historial', methods=['GET'])
@login_requerido
def wifi_historial_endpoint():
    device_id = request.args.get("device_id", type=int)
    hist = wifi_historial.get(device_id, []) if device_id else []
    return jsonify({"historial": hist[-10:]})


@app.route('/api/wifi/configurar', methods=['POST'])
@login_requerido
def wifi_configurar():
    """
    Body: {"device_id": 1, "ssid": "MiRed", "password": "clave"}
    El Arduino la recoge en /api/arduino/config y se reconecta.
    """
    data      = request.json or {}
    device_id = data.get("device_id")
    ssid      = data.get("ssid", "").strip()
    password  = data.get("password", "")

    if not device_id:
        return jsonify({"status": "error", "mensaje": "Falta device_id"}), 400
    if not ssid or not password:
        return jsonify({"status": "error", "mensaje": "SSID y contraseña requeridos"}), 400

    with wifi_lock:
        wifi_pendiente[device_id] = {"ssid": ssid, "password": password}

    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    wifi_actual[device_id] = {"ssid": ssid, "fecha": fecha}

    hist = wifi_historial.setdefault(device_id, [])
    hist[:] = [h for h in hist if h["ssid"] != ssid]
    hist.append({"ssid": ssid, "fecha": fecha})

    print(f"[WiFi dev={device_id}] Config pendiente → SSID: {ssid}")
    return jsonify({"status": "ok", "ssid": ssid})


# ============================================================
# MIEMBROS — Invitar usuarios a ver/controlar dispositivos
# ============================================================

@app.route('/api/miembros/invitar', methods=['POST'])
@login_requerido
def invitar_miembro():
    """
    El dueño del dispositivo invita a otro usuario por correo.
    Body: { "correo": "otro@correo.com", "device_id": 1, "permiso": "ver" | "controlar" }
    """
    data      = request.json or {}
    correo    = data.get('correo', '').strip().lower()
    device_id = data.get('device_id')
    permiso   = data.get('permiso', 'ver')

    if not correo or not device_id:
        return jsonify({"error": "Faltan datos"}), 400
    if permiso not in ('ver', 'controlar'):
        return jsonify({"error": "Permiso inválido"}), 400

    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Verificar que el dispositivo pertenece al usuario
        cursor.execute(
            "SELECT idDispositivo, nombre FROM dispositivos WHERE idDispositivo=%s AND idUsuario=%s",
            (device_id, id_u)
        )
        disp = cursor.fetchone()
        if not disp:
            cursor.close(); conexion.close()
            return jsonify({"error": "Dispositivo no encontrado"}), 404

        # Verificar que el correo invitado existe
        cursor.execute("SELECT idUsuario, nombre FROM usuarios WHERE correo=%s", (correo,))
        invitado = cursor.fetchone()
        if not invitado:
            cursor.close(); conexion.close()
            return jsonify({"error": "No existe un usuario con ese correo"}), 404

        # No invitarse a sí mismo
        if invitado['idUsuario'] == id_u:
            cursor.close(); conexion.close()
            return jsonify({"error": "No puedes invitarte a ti mismo"}), 400

        # Insertar o actualizar membresía
        cursor.execute("""
            INSERT INTO dispositivo_miembros (idDispositivo, idUsuario, permiso)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE permiso = VALUES(permiso)
        """, (device_id, invitado['idUsuario'], permiso))
        conexion.commit()
        cursor.close(); conexion.close()

        return jsonify({"status": "ok", "mensaje": f"{invitado['nombre']} agregado como miembro"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/miembros/lista', methods=['GET'])
@login_requerido
def listar_miembros():
    """Lista los miembros de un dispositivo del usuario."""
    device_id = request.args.get('device_id', type=int)
    if not device_id:
        return jsonify({"error": "Falta device_id"}), 400
    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)

        # Verificar dueño
        cursor.execute(
            "SELECT idDispositivo FROM dispositivos WHERE idDispositivo=%s AND idUsuario=%s",
            (device_id, id_u)
        )
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403

        cursor.execute("""
            SELECT u.idUsuario, u.nombre, u.apellido_paterno, u.correo, dm.permiso
            FROM dispositivo_miembros dm
            JOIN usuarios u ON dm.idUsuario = u.idUsuario
            WHERE dm.idDispositivo = %s
        """, (device_id,))
        miembros = cursor.fetchall()
        cursor.close(); conexion.close()
        return jsonify(miembros)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/miembros/eliminar', methods=['DELETE'])
@login_requerido
def eliminar_miembro():
    """Elimina a un miembro de un dispositivo."""
    data      = request.json or {}
    device_id = data.get('device_id')
    id_miembro = data.get('idUsuario')
    if not device_id or not id_miembro:
        return jsonify({"error": "Faltan datos"}), 400
    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor()

        # Verificar dueño
        cursor.execute(
            "SELECT idDispositivo FROM dispositivos WHERE idDispositivo=%s AND idUsuario=%s",
            (device_id, id_u)
        )
        if not cursor.fetchone():
            cursor.close(); conexion.close()
            return jsonify({"error": "No autorizado"}), 403

        cursor.execute(
            "DELETE FROM dispositivo_miembros WHERE idDispositivo=%s AND idUsuario=%s",
            (device_id, id_miembro)
        )
        conexion.commit()
        cursor.close(); conexion.close()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/miembros/mis-accesos', methods=['GET'])
@login_requerido
def mis_accesos():
    """Devuelve los dispositivos a los que el usuario fue invitado."""
    try:
        id_u     = get_id_usuario()
        conexion = conectar_bd()
        cursor   = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT d.idDispositivo, d.nombre, d.tipo, dm.permiso,
                   u.nombre AS nombre_dueno, u.correo AS correo_dueno
            FROM dispositivo_miembros dm
            JOIN dispositivos d ON dm.idDispositivo = d.idDispositivo
            JOIN usuarios u ON d.idUsuario = u.idUsuario
            WHERE dm.idUsuario = %s
        """, (id_u,))
        accesos = cursor.fetchall()
        cursor.close(); conexion.close()
        return jsonify(accesos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# INICIO
# ============================================================

if __name__ == '__main__':
    app.run(
        debug=os.environ.get('FLASK_DEBUG', 'False') == 'True',
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000))
    )
