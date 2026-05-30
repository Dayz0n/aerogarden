async function enviarRegistro() {
    const nombre    = document.getElementById("nombre").value.trim();
    const correo    = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value;
    const confirmar  = document.getElementById("confirmar").value;

    // Validaciones
    if (!nombre || !correo || !contrasena || !confirmar) {
        mostrarError("Por favor, rellena todos los campos.");
        return;
    }

    if (contrasena.length < 6) {
        mostrarError("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    if (contrasena !== confirmar) {
        mostrarError("Las contraseñas no coinciden.");
        return;
    }

    const btnRegistro = document.getElementById("btnRegistro");
    if (btnRegistro) { btnRegistro.disabled = true; btnRegistro.textContent = "Registrando..."; }

    try {
        const response = await fetch('/api/auth/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, contrasena })
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
            mostrarExito("¡Cuenta creada! Redirigiendo al inicio de sesión...");
            setTimeout(() => window.location.href = '/', 1500);
        } else {
            mostrarError(data.mensaje || "Ocurrió un error inesperado.");
            if (btnRegistro) { btnRegistro.disabled = false; btnRegistro.textContent = "Crear cuenta"; }
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        mostrarError("No se pudo conectar con el servidor.");
        if (btnRegistro) { btnRegistro.disabled = false; btnRegistro.textContent = "Crear cuenta"; }
    }
}

function mostrarError(msg) {
    const el = document.getElementById("error-msg");
    const ok = document.getElementById("exito-msg");
    if (ok) ok.style.display = "none";
    if (el) { el.textContent = msg; el.style.display = "block"; }
    else alert(msg);
}

function mostrarExito(msg) {
    const el = document.getElementById("error-msg");
    const ok = document.getElementById("exito-msg");
    if (el) el.style.display = "none";
    if (ok) { ok.textContent = msg; ok.style.display = "block"; }
}
