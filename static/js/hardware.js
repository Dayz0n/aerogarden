// /static/js/hardware.js

async function cargarDispositivos() {
    const contenedor = document.getElementById('hardware');
    
    try {
        // Hacemos la petición a tu API de Flask
        const respuesta = await fetch('http://localhost:5000/api/hardware/dispositivos');
        const dispositivos = await respuesta.json();

        if (dispositivos.length > 0) {
            contenedor.innerHTML = '<h3>Mis Dispositivos</h3>';
            dispositivos.forEach(dev => {
                contenedor.innerHTML += `
                    <div class="card">
                        <h4>${dev.nombre}</h4>
                        <p>Tipo: ${dev.tipo_microcontrolador}</p>
                        <p>Conexión: ${dev.tipo_conexion}</p>
                    </div>
                `;
            });
        } else {
            contenedor.innerHTML = '<p>No tienes dispositivos registrados.</p>';
        }
    } catch (error) {
        contenedor.innerHTML = '<p>Error al conectar con el servidor.</p>';
        console.error("Error:", error);
    }
}