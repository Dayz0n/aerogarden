async function login() {
    const correo = document.getElementById("email").value;
    const contrasena = document.getElementById("passLogin").value;

    const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, contrasena })
    });

    const data = await response.json();

    if (data.status === 'success') {
        alert("¡Bienvenido, " + data.usuario.nombre + "!");
        // Aquí guardamos el ID para usarlo en todo el sistema
        localStorage.setItem('idUsuario', data.usuario.idUsuario);
        window.location.href = '/dashboard'; // Redirige al sistema
    } else {
        alert("Error: " + data.mensaje);
    }
}