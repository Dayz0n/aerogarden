async function iniciarSesion() {
    const correoInput    = document.getElementById("correo");
    const contrasenaInput = document.getElementById("contrasena");

    const correo    = correoInput    ? correoInput.value.trim()    : "";
    const contrasena = contrasenaInput ? contrasenaInput.value : "";

    if (!correo || !contrasena) {
        mostrarError("Por favor, ingresa correo y contraseña.");
        return;
    }

    const btnLogin = document.getElementById("btnLogin");
    if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = "Entrando..."; }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, contrasena })
        });

        const data = await response.json();

        if (response.ok && data.status === 'success') {
            window.location.assign('/dashboard');
        } else {
            mostrarError(data.mensaje || "Credenciales inválidas");
            if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Entrar"; }
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        mostrarError("No se pudo conectar con el servidor.");
        if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = "Entrar"; }
    }
}

function mostrarError(msg) {
    const el = document.getElementById("error-msg");
    if (el) { el.textContent = msg; el.style.display = "block"; }
    else alert(msg);
}

// Permitir Enter para iniciar sesión
document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") iniciarSesion();
    });
});
