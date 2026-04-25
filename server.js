const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Configuración de conexión con manejo de errores
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000 // 10 segundos de espera
});

// Intentar conectar pero sin tumbar el servidor si falla
db.connect((err) => {
    if (err) {
        console.error('ERROR de conexión a MySQL:', err.message);
    } else {
        console.log('Conectado a la base de datos MySQL');
    }
});

app.post('/webhook-oby', (req, res) => {
    console.log('Datos recibidos de Oby:', req.body);
    const { nombre, modelo, score, mensaje } = req.body;

    const query = 'CALL sp_InsertarInteraccion(?, ?, ?, ?)';
    db.query(query, [nombre, modelo, score, mensaje], (err, result) => {
        if (err) {
            console.error('Error al insertar:', err.message);
            return res.status(500).json({ error: 'Error en DB', detalle: err.message });
        }
        res.status(200).json({ status: 'Lead guardado con éxito' });
    });
});

// Ruta de prueba para verificar que el servidor vive
app.get('/', (req, res) => {
    res.send('Servidor Puente BYD está ACTIVO');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
