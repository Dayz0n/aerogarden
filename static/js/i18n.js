// ================================================================
//  i18n.js — Sistema de traducciones AeroGarden Cloud
//  Uso: window.t('clave')  →  texto en el idioma activo
//       setIdioma('en')    →  cambia y guarda el idioma
// ================================================================

const TRADUCCIONES = {
    es: {
        // ── NAV ──
        nav_inicio:       'Inicio',
        nav_hardware:     'Hardware',
        nav_logica:       'Lógica',
        nav_analitica:    'Analítica',
        nav_cultivos:     'Cultivos',
        nav_alertas:      'Alertas',
        nav_bomba:        'Bomba',
        nav_wifi:         'WiFi',
        nav_perfil:       'Perfil',
        nav_cerrar:       'Cerrar sesión',

        // ── INICIO ──
        inicio_bienvenido:      'Bienvenido,',
        inicio_lecturas:        '📡 Lecturas recientes',
        inicio_ver_en_vivo:     'Ver en vivo →',
        inicio_alertas:         '🔔 Alertas recientes',
        inicio_ver_todas:       'Ver todas →',
        inicio_cultivos:        '🌿 Cultivos registrados',
        inicio_gestionar:       'Gestionar →',
        inicio_bomba:           '💧 Estado de la Bomba',
        inicio_controlar:       'Controlar →',
        inicio_sin_sensores:    'No hay sensores registrados.',
        inicio_sin_alertas:     '✅ Sin alertas recientes.',
        inicio_sin_cultivos:    'No hay cultivos registrados.',
        inicio_nueva_siembra:   '+ Nueva siembra',
        inicio_en_linea:        '● En línea',
        inicio_sin_datos:       'Sin datos',
        inicio_ultimo_dato:     'último dato',
        inicio_desconectado:    '● Desconectado',

        // ── HARDWARE ──
        hw_titulo:          'Integración de Hardware',
        hw_agregar_disp:    '+ Agregar Dispositivo',
        hw_agregar_sensor:  '+ Agregar Sensor',
        hw_lista_titulo:    'Dispositivos y Sensores Conectados',

        // ── LÓGICA ──
        logica_titulo:          'Lógica de Control',
        logica_sel_sensor:      'Seleccionar Sensor:',
        logica_sel_placeholder: '-- Seleccione un sensor --',
        logica_verificar:       '🔍 Verificar Estado',
        logica_visualizar:      '📈 Visualizar en Tiempo Real',

        // ── ANALÍTICA ──
        analitica_titulo:       'Analítica y Reportes',
        analitica_tab_sensores: '📡 Sensores',
        analitica_tab_cultivos: '🌱 Reporte Cultivos',
        analitica_tab_cosechas: '🌾 Reporte Cosechas',
        analitica_sensor:       'Sensor:',
        analitica_ahora:        'Ahora (1h)',
        analitica_24h:          'Últimas 24h',
        analitica_semana:       'Última Semana',

        // ── CULTIVOS ──
        cult_titulo:            'Gestión de Cultivos',
        cult_registrar_siembra: '🌱 Registrar Siembra',
        cult_registrar_cosecha: '🌾 Registrar Cosecha',
        cult_agregar_tipo:      '+ Agregar Tipo de Cultivo',
        cult_tab_cultivos:      '🌱 Cultivos',
        cult_tab_cosechas:      '🌾 Cosechas',

        // ── ALERTAS ──
        alert_titulo:           '🔔 Centro de Alertas',
        alert_tab_historial:    '📋 Historial de Alertas',
        alert_tab_params:       '⚙️ Parámetros / Umbrales',
        alert_nuevo_param:      '+ Nuevo Parámetro',
        alert_actualizar:       '↺ Actualizar',

        // ── BOMBA ──
        bomba_titulo:       '💧 Control de Bomba / Relevador',
        bomba_dispositivo:  '🔌 Dispositivo a controlar',
        bomba_encender:     '⚡ Encender ahora',
        bomba_apagar:       '⏹ Apagar ahora',
        bomba_temporizador: '⏱ Temporizador Automático',
        bomba_tiempo_on:    'Tiempo ENCENDIDA (segundos)',
        bomba_tiempo_off:   'Tiempo APAGADA (segundos)',
        bomba_guardar:      '💾 Guardar temporizador',
        bomba_nivel:        '📏 Nivel de Agua (Sensor Ultrasónico)',
        bomba_sin_datos:    'Sin datos aún',
        bomba_nivel_bajo:   '⚠️ ¡NIVEL DE AGUA BAJO! Revisa el depósito.',
        bomba_encendida:    'Estado: ENCENDIDA 🟢',
        bomba_apagada:      'Estado: APAGADA ⚫',
        bomba_modo_manual:  'Modo: Manual',
        bomba_modo_auto:    'Modo: Automático (temporizador)',

        // ── WIFI ──
        wifi_titulo:        '📶 Configuración de Red WiFi',
        wifi_descripcion:   'Desde aquí puedes cambiar la red WiFi a la que se conecta el Arduino/ESP32.',
        wifi_dispositivo:   '🔌 Dispositivo a configurar',
        wifi_red_arduino:   '📡 Red actual del Arduino',
        wifi_cambiar:       '🔧 Cambiar red WiFi',
        wifi_ssid:          'Nombre de la red (SSID)',
        wifi_pass:          'Contraseña',
        wifi_enviar:        '📡 Enviar al Arduino',
        wifi_historial:     '📋 Últimas redes configuradas',
        wifi_sin_config:    'Sin configuración enviada aún',
        wifi_sin_redes:     'Aún no has enviado ninguna red.',
        wifi_usar_esta:     'Usar esta',
        wifi_consultando:   'Consultando...',
        wifi_actualizar:    '↺ Actualizar',

        // ── PERFIL ──
        perfil_titulo:          'Configuración de Cuenta',
        perfil_datos:           '👤 Datos personales',
        perfil_datos_desc:      'Actualiza tu nombre y apellidos.',
        perfil_nombre:          'Nombre(s)',
        perfil_ap_paterno:      'Apellido paterno',
        perfil_ap_materno:      'Apellido materno',
        perfil_guardar:         'Guardar cambios',
        perfil_seguridad:       '🔒 Seguridad',
        perfil_nueva_pass:      'Nueva contraseña',
        perfil_actualizar_pass: 'Actualizar Contraseña',
        perfil_ayuda:           'ℹ️ Ayuda y Tips de uso',
        perfil_miembros:        '👥 Miembros y Accesos',
        perfil_preferencias:    '🌐 Preferencias',
        perfil_idioma:          'Idioma de la interfaz',
        perfil_foto_hint:       'Haz clic en la foto para cambiarla (máx. 2 MB)',

        // ── MODALES ──
        modal_agregar_disp:     'Agregar Dispositivo',
        modal_nombre:           'Nombre',
        modal_tipo_ctrl:        'Tipo de controlador',
        modal_conexion:         'Conexión',
        modal_guardar:          'Guardar',
        modal_cancelar:         'Cancelar',
        modal_agregar_sensor:   'Agregar / Configurar Sensor',
        modal_dispositivo:      'Dispositivo',
        modal_tipo_sensor:      'Tipo de sensor',
        modal_unidad:           'Unidad de medida',
        modal_guardar_sensor:   'Guardar sensor',
        modal_siembra:          'Registrar Siembra',
        modal_nombre_var:       'Nombre / Variedad',
        modal_tipo_cultivo:     'Tipo de Cultivo',
        modal_fecha_siembra:    'Fecha de siembra',
        modal_cantidad:         'Cantidad de plantas',
        modal_guardar_siembra:  'Guardar Siembra',
        modal_cosecha:          'Registrar Cosecha',
        modal_cultivo:          'Cultivo',
        modal_fecha_cosecha:    'Fecha de cosecha',
        modal_cantidad_cos:     'Cantidad cosechada',
        modal_calidad:          'Calidad',
        modal_observaciones:    'Observaciones',
        modal_guardar_cosecha:  'Guardar Cosecha',
        modal_tipo_planta:      'Registrar Nuevo Tipo de Planta',
        modal_nombre_planta:    'Nombre de la planta',
        modal_desc_planta:      'Descripción',
        modal_guardar_planta:   'Guardar Planta',



        inicio_sin_senal:    '⚠ Sin señal',
        inicio_bienvenido:   'Bienvenido,',
        bomba_encender_corto:'⚡ Encender',
        bomba_apagar_corto:  '⏹ Apagar',
        cargando:            'Cargando...',
        miembro_sin_miembros:'Aún no hay miembros en este dispositivo.',

        // ── ANALÍTICA extra ──
        an_tipo_cultivo:    'Tipo de cultivo',
        an_todos_tipos:     'Todos los tipos',
        an_fecha_desde:     'Fecha desde',
        an_fecha_hasta:     'Fecha hasta',
        an_filtrar:         '🔍 Filtrar',
        an_plantas_tipo:    'Plantas por tipo de cultivo',
        an_siembras_mes:    'Siembras por mes',
        an_cultivo:         'Cultivo',
        an_todos_cult:      'Todos los cultivos',
        an_cant_cos:        'Cantidad cosechada por cultivo',
        an_cosechas_mes:    'Cosechas por mes',

        // ── ALERTAS extra ──
        alert_todas_prior:  'Todas las prioridades',
        alert_critica:      '🔴 Crítica',
        alert_alta:         '🟠 Alta',
        alert_media:        '🟡 Media',
        alert_baja:         '🟢 Baja',
        alert_todos_est:    'Todos los estados',
        alert_nueva:        'Nueva',
        alert_vista:        'Vista',
        alert_resuelta:     'Resuelta',
        alert_todos_sens:   'Todos los sensores',
        alert_desc_params:  'Define los umbrales que generarán alertas para cada sensor.',

        // ── BOMBA extra ──
        bomba_modo_auto_btn: '🔄 Volver a modo automático',

        // ── WIFI extra ──
        wifi_estado_actual:  'Estado actual del dispositivo',

        // ── MIEMBROS ──
        miembro_correo:      'Correo del usuario a invitar',
        miembro_permiso:     'Permiso',
        miembro_solo_ver:    '👁 Solo ver',
        miembro_controlar:   '🎮 Controlar',
        miembro_invitar:     '+ Invitar',
        miembro_compartidos: '📲 Dispositivos compartidos contigo',

        // ── MODALES extra ──
        modal_editar_sensor:  '✏️ Editar Sensor',
        modal_guardar_cambios:'Guardar cambios',

        // ── NAV extra ──
        nav_tagline: 'Cultiva tu futuro',

        // ── AYUDA ──
        ayuda_desc: 'Guía rápida para sacarle el mayor provecho a Aerogarden Cloud.',

        // ── LOGIN ──
        login_titulo:       'Bienvenido de vuelta',
        login_subtitulo:    'Inicia sesión para acceder a tu sistema',
        login_correo:       'Correo electrónico',
        login_pass:         'Contraseña',
        login_btn:          'Entrar al sistema',
        login_nuevo:        '¿Nuevo aquí?',
        login_sin_cuenta:   '¿No tienes cuenta?',
        login_registrate:   'Regístrate gratis',
        login_olvide:       '¿Olvidaste tu contraseña?',
        login_tagline1:     'Cultiva smarter,',
        login_tagline2:     'crece mejor',
        login_tagline_desc: 'Monitorea sensores, gestiona cultivos y recibe alertas en tiempo real desde un solo lugar.',

        // ── RECUPERAR CONTRASEÑA ──
        rec_titulo:         'Restablecer contraseña',
        rec_subtitulo:      'Ingresa tu correo registrado y elige una nueva contraseña.',
        rec_correo:         'Correo electrónico',
        rec_verificar:      'Verificar correo',
        rec_nueva:          'Nueva contraseña',
        rec_nueva_hint:     'Mínimo 6 caracteres',
        rec_confirmar:      'Confirmar contraseña',
        rec_guardar:        'Guardar nueva contraseña',
        rec_volver:         '← Volver al inicio de sesión',

        // ── REGISTRO ──
        reg_titulo:         'Crea tu cuenta',
        reg_subtitulo:      'Empieza a gestionar tus cultivos hoy.',
        reg_nombre:         'Nombre(s)',
        reg_ap_paterno:     'Apellido paterno',
        reg_ap_materno:     'Apellido materno',
        reg_correo:         'Correo electrónico',
        reg_pass:           'Contraseña',
        reg_confirmar:      'Confirmar contraseña',
        reg_btn:            'Crear mi cuenta',
        reg_ya_cuenta:      '¿Ya tienes cuenta?',
        reg_iniciar:        'Inicia sesión',
        reg_paso1:          'Crea tu cuenta',
        reg_paso1_desc:     'Completa el formulario en menos de 1 minuto.',
        reg_paso2:          'Conecta tu hardware',
        reg_paso2_desc:     'Agrega tu Arduino o ESP32 desde el panel.',
        reg_paso3:          'Monitorea en tiempo real',
        reg_paso3_desc:     'Visualiza datos, alertas y cultivos desde cualquier lugar.',
    },

    en: {
        // ── NAV ──
        nav_inicio:       'Home',
        nav_hardware:     'Hardware',
        nav_logica:       'Control',
        nav_analitica:    'Analytics',
        nav_cultivos:     'Crops',
        nav_alertas:      'Alerts',
        nav_bomba:        'Pump',
        nav_wifi:         'WiFi',
        nav_perfil:       'Profile',
        nav_cerrar:       'Log out',

        // ── INICIO ──
        inicio_bienvenido:      'Welcome,',
        inicio_lecturas:        '📡 Recent readings',
        inicio_ver_en_vivo:     'View live →',
        inicio_alertas:         '🔔 Recent alerts',
        inicio_ver_todas:       'View all →',
        inicio_cultivos:        '🌿 Registered crops',
        inicio_gestionar:       'Manage →',
        inicio_bomba:           '💧 Pump status',
        inicio_controlar:       'Control →',
        inicio_sin_sensores:    'No sensors registered.',
        inicio_sin_alertas:     '✅ No recent alerts.',
        inicio_sin_cultivos:    'No crops registered.',
        inicio_nueva_siembra:   '+ New planting',
        inicio_en_linea:        '● Online',
        inicio_sin_datos:       'No data',
        inicio_ultimo_dato:     'last reading',
        inicio_desconectado:    '● Disconnected',

        // ── HARDWARE ──
        hw_titulo:          'Hardware Integration',
        hw_agregar_disp:    '+ Add Device',
        hw_agregar_sensor:  '+ Add Sensor',
        hw_lista_titulo:    'Connected Devices and Sensors',

        // ── LÓGICA ──
        logica_titulo:          'Control Logic',
        logica_sel_sensor:      'Select Sensor:',
        logica_sel_placeholder: '-- Select a sensor --',
        logica_verificar:       '🔍 Check Status',
        logica_visualizar:      '📈 Visualize in Real Time',

        // ── ANALÍTICA ──
        analitica_titulo:       'Analytics & Reports',
        analitica_tab_sensores: '📡 Sensors',
        analitica_tab_cultivos: '🌱 Crops Report',
        analitica_tab_cosechas: '🌾 Harvest Report',
        analitica_sensor:       'Sensor:',
        analitica_ahora:        'Now (1h)',
        analitica_24h:          'Last 24h',
        analitica_semana:       'Last Week',

        // ── CULTIVOS ──
        cult_titulo:            'Crop Management',
        cult_registrar_siembra: '🌱 Register Planting',
        cult_registrar_cosecha: '🌾 Register Harvest',
        cult_agregar_tipo:      '+ Add Crop Type',
        cult_tab_cultivos:      '🌱 Crops',
        cult_tab_cosechas:      '🌾 Harvests',

        // ── ALERTAS ──
        alert_titulo:           '🔔 Alert Center',
        alert_tab_historial:    '📋 Alert History',
        alert_tab_params:       '⚙️ Parameters / Thresholds',
        alert_nuevo_param:      '+ New Parameter',
        alert_actualizar:       '↺ Refresh',

        // ── BOMBA ──
        bomba_titulo:       '💧 Pump / Relay Control',
        bomba_dispositivo:  '🔌 Device to control',
        bomba_encender:     '⚡ Turn on now',
        bomba_apagar:       '⏹ Turn off now',
        bomba_temporizador: '⏱ Automatic Timer',
        bomba_tiempo_on:    'ON time (seconds)',
        bomba_tiempo_off:   'OFF time (seconds)',
        bomba_guardar:      '💾 Save timer',
        bomba_nivel:        '📏 Water Level (Ultrasonic Sensor)',
        bomba_sin_datos:    'No data yet',
        bomba_nivel_bajo:   '⚠️ LOW WATER LEVEL! Check the tank.',
        bomba_encendida:    'Status: ON 🟢',
        bomba_apagada:      'Status: OFF ⚫',
        bomba_modo_manual:  'Mode: Manual',
        bomba_modo_auto:    'Mode: Automatic (timer)',

        // ── WIFI ──
        wifi_titulo:        '📶 WiFi Network Settings',
        wifi_descripcion:   'Change the WiFi network your Arduino/ESP32 connects to.',
        wifi_dispositivo:   '🔌 Device to configure',
        wifi_red_arduino:   '📡 Arduino current network',
        wifi_cambiar:       '🔧 Change WiFi network',
        wifi_ssid:          'Network name (SSID)',
        wifi_pass:          'Password',
        wifi_enviar:        '📡 Send to Arduino',
        wifi_historial:     '📋 Recently configured networks',
        wifi_sin_config:    'No configuration sent yet',
        wifi_sin_redes:     'No networks sent yet.',
        wifi_usar_esta:     'Use this',
        wifi_consultando:   'Checking...',
        wifi_actualizar:    '↺ Refresh',

        // ── PERFIL ──
        perfil_titulo:          'Account Settings',
        perfil_datos:           '👤 Personal data',
        perfil_datos_desc:      'Update your name and last names.',
        perfil_nombre:          'First name(s)',
        perfil_ap_paterno:      'First last name',
        perfil_ap_materno:      'Second last name',
        perfil_guardar:         'Save changes',
        perfil_seguridad:       '🔒 Security',
        perfil_nueva_pass:      'New password',
        perfil_actualizar_pass: 'Update Password',
        perfil_ayuda:           'ℹ️ Help & Tips',
        perfil_miembros:        '👥 Members & Access',
        perfil_preferencias:    '🌐 Preferences',
        perfil_idioma:          'Interface language',
        perfil_foto_hint:       'Click the photo to change it (max 2 MB)',

        // ── MODALES ──
        modal_agregar_disp:     'Add Device',
        modal_nombre:           'Name',
        modal_tipo_ctrl:        'Controller type',
        modal_conexion:         'Connection',
        modal_guardar:          'Save',
        modal_cancelar:         'Cancel',
        modal_agregar_sensor:   'Add / Configure Sensor',
        modal_dispositivo:      'Device',
        modal_tipo_sensor:      'Sensor type',
        modal_unidad:           'Unit of measurement',
        modal_guardar_sensor:   'Save sensor',
        modal_siembra:          'Register Planting',
        modal_nombre_var:       'Name / Variety',
        modal_tipo_cultivo:     'Crop type',
        modal_fecha_siembra:    'Planting date',
        modal_cantidad:         'Number of plants',
        modal_guardar_siembra:  'Save Planting',
        modal_cosecha:          'Register Harvest',
        modal_cultivo:          'Crop',
        modal_fecha_cosecha:    'Harvest date',
        modal_cantidad_cos:     'Harvested quantity',
        modal_calidad:          'Quality',
        modal_observaciones:    'Observations',
        modal_guardar_cosecha:  'Save Harvest',
        modal_tipo_planta:      'Register New Plant Type',
        modal_nombre_planta:    'Plant name',
        modal_desc_planta:      'Description',
        modal_guardar_planta:   'Save Plant',



        inicio_sin_senal:    '⚠ Sin señal',
        inicio_bienvenido:   'Bienvenido,',
        bomba_encender_corto:'⚡ Encender',
        bomba_apagar_corto:  '⏹ Apagar',
        cargando:            'Cargando...',
        miembro_sin_miembros:'Aún no hay miembros en este dispositivo.',

        // ── ANALÍTICA extra ──
        an_tipo_cultivo:    'Tipo de cultivo',
        an_todos_tipos:     'Todos los tipos',
        an_fecha_desde:     'Fecha desde',
        an_fecha_hasta:     'Fecha hasta',
        an_filtrar:         '🔍 Filtrar',
        an_plantas_tipo:    'Plantas por tipo de cultivo',
        an_siembras_mes:    'Siembras por mes',
        an_cultivo:         'Cultivo',
        an_todos_cult:      'Todos los cultivos',
        an_cant_cos:        'Cantidad cosechada por cultivo',
        an_cosechas_mes:    'Cosechas por mes',

        // ── ALERTAS extra ──
        alert_todas_prior:  'Todas las prioridades',
        alert_critica:      '🔴 Crítica',
        alert_alta:         '🟠 Alta',
        alert_media:        '🟡 Media',
        alert_baja:         '🟢 Baja',
        alert_todos_est:    'Todos los estados',
        alert_nueva:        'Nueva',
        alert_vista:        'Vista',
        alert_resuelta:     'Resuelta',
        alert_todos_sens:   'Todos los sensores',
        alert_desc_params:  'Define los umbrales que generarán alertas para cada sensor.',

        // ── BOMBA extra ──
        bomba_modo_auto_btn: '🔄 Volver a modo automático',

        // ── WIFI extra ──
        wifi_estado_actual:  'Estado actual del dispositivo',

        // ── MIEMBROS ──
        miembro_correo:      'Correo del usuario a invitar',
        miembro_permiso:     'Permiso',
        miembro_solo_ver:    '👁 Solo ver',
        miembro_controlar:   '🎮 Controlar',
        miembro_invitar:     '+ Invitar',
        miembro_compartidos: '📲 Dispositivos compartidos contigo',

        // ── MODALES extra ──
        modal_editar_sensor:  '✏️ Editar Sensor',
        modal_guardar_cambios:'Guardar cambios',

        // ── NAV extra ──
        nav_tagline: 'Cultiva tu futuro',

        // ── AYUDA ──
        ayuda_desc: 'Guía rápida para sacarle el mayor provecho a Aerogarden Cloud.',



        inicio_sin_senal:    '⚠ Sin señal',
        inicio_bienvenido:   'Bienvenido,',
        bomba_encender_corto:'⚡ Encender',
        bomba_apagar_corto:  '⏹ Apagar',
        cargando:            'Cargando...',
        miembro_sin_miembros:'Aún no hay miembros en este dispositivo.',


        inicio_sin_senal:    '⚠ No signal',
        inicio_bienvenido:   'Welcome,',
        bomba_encender_corto:'⚡ Turn on',
        bomba_apagar_corto:  '⏹ Turn off',
        cargando:            'Loading...',
        miembro_sin_miembros:'No members on this device yet.',

        // ── ANALÍTICA extra ──
        an_tipo_cultivo:    'Crop type',
        an_todos_tipos:     'All types',
        an_fecha_desde:     'From date',
        an_fecha_hasta:     'To date',
        an_filtrar:         '🔍 Filter',
        an_plantas_tipo:    'Plants by crop type',
        an_siembras_mes:    'Plantings by month',
        an_cultivo:         'Crop',
        an_todos_cult:      'All crops',
        an_cant_cos:        'Harvested quantity by crop',
        an_cosechas_mes:    'Harvests by month',

        // ── ALERTAS extra ──
        alert_todas_prior:  'All priorities',
        alert_critica:      '🔴 Critical',
        alert_alta:         '🟠 High',
        alert_media:        '🟡 Medium',
        alert_baja:         '🟢 Low',
        alert_todos_est:    'All statuses',
        alert_nueva:        'New',
        alert_vista:        'Seen',
        alert_resuelta:     'Resolved',
        alert_todos_sens:   'All sensors',
        alert_desc_params:  'Set thresholds that will trigger alerts for each sensor.',

        // ── BOMBA extra ──
        bomba_modo_auto_btn: '🔄 Back to automatic mode',

        // ── WIFI extra ──
        wifi_estado_actual:  'Current device status',

        // ── MIEMBROS ──
        miembro_correo:      'Email of user to invite',
        miembro_permiso:     'Permission',
        miembro_solo_ver:    '👁 View only',
        miembro_controlar:   '🎮 Control',
        miembro_invitar:     '+ Invite',
        miembro_compartidos: '📲 Devices shared with you',

        // ── MODALES extra ──
        modal_editar_sensor:  '✏️ Edit Sensor',
        modal_guardar_cambios:'Save changes',

        // ── NAV extra ──
        nav_tagline: 'Grow your future',

        // ── AYUDA ──
        ayuda_desc: 'Quick guide to get the most out of Aerogarden Cloud.',

        // ── LOGIN ──
        login_titulo:       'Welcome back',
        login_subtitulo:    'Sign in to access your system',
        login_correo:       'Email address',
        login_pass:         'Password',
        login_btn:          'Enter system',
        login_nuevo:        'New here?',
        login_sin_cuenta:   "Don't have an account?",
        login_registrate:   'Sign up free',
        login_olvide:       'Forgot your password?',
        login_tagline1:     'Grow smarter,',
        login_tagline2:     'grow better',
        login_tagline_desc: 'Monitor sensors, manage crops and receive real-time alerts from one place.',

        // ── RECUPERAR CONTRASEÑA ──
        rec_titulo:         'Reset password',
        rec_subtitulo:      'Enter your registered email and choose a new password.',
        rec_correo:         'Email address',
        rec_verificar:      'Verify email',
        rec_nueva:          'New password',
        rec_nueva_hint:     'At least 6 characters',
        rec_confirmar:      'Confirm password',
        rec_guardar:        'Save new password',
        rec_volver:         '← Back to login',

        // ── REGISTRO ──
        reg_titulo:         'Create your account',
        reg_subtitulo:      'Start managing your crops today.',
        reg_nombre:         'First name(s)',
        reg_ap_paterno:     'First last name',
        reg_ap_materno:     'Second last name',
        reg_correo:         'Email address',
        reg_pass:           'Password',
        reg_confirmar:      'Confirm password',
        reg_btn:            'Create my account',
        reg_ya_cuenta:      'Already have an account?',
        reg_iniciar:        'Sign in',
        reg_paso1:          'Create your account',
        reg_paso1_desc:     'Fill out the form in less than 1 minute.',
        reg_paso2:          'Connect your hardware',
        reg_paso2_desc:     'Add your Arduino or ESP32 from the panel.',
        reg_paso3:          'Monitor in real time',
        reg_paso3_desc:     'View data, alerts and crops from anywhere.',
    }
};

// ── API pública ──

function getIdioma() {
    return localStorage.getItem('ag_idioma') || 'es';
}

function setIdioma(lang) {
    localStorage.setItem('ag_idioma', lang);
    aplicarIdioma();
}

function t(clave) {
    const lang = getIdioma();
    return (TRADUCCIONES[lang] && TRADUCCIONES[lang][clave]) ||
           (TRADUCCIONES['es'] && TRADUCCIONES['es'][clave]) ||
           clave;
}

function aplicarIdioma() {
    // Traduce todos los elementos con data-i18n="clave"
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const clave = el.getAttribute('data-i18n');
        const attr  = el.getAttribute('data-i18n-attr'); // opcional: traduce un atributo
        if (attr) {
            el.setAttribute(attr, t(clave));
        } else {
            el.textContent = t(clave);
        }
    });

    // Actualiza el selector de idioma si existe
    const sel = document.getElementById('select-idioma');
    if (sel) sel.value = getIdioma();

    // Actualiza el atributo lang del html
    document.documentElement.lang = getIdioma();
}

// Aplicar al cargar la página
document.addEventListener('DOMContentLoaded', aplicarIdioma);
