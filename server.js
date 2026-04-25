const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de conexión usando variables de entorno (para Railway)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'dbsignature.cwkcc7shlips.us-east-1.rds.amazonaws.com',
    user: process.env.DB_USER || 'usr_inconcert',
    password: process.env.DB_PASSWORD || 'BL$5fvfu$ggMBAQkJsw@D',
    database: process.env.DB_NAME || 'occ_survey_prod',
    waitForConnections: true,
    connectionLimit: 10
});

// Endpoint que recibirá los datos de ObyMind
app.post('/webhook-oby', (req, res) => {
    const { nombre, modelo, score, mensaje } = req.body;

    // Llamada a Procedimiento Almacenado
    const sql = `CALL sp_InsertarInteraccion(?, ?, ?, ?)`;
    
    db.query(sql, [nombre, modelo, score, mensaje], (err, result) => {
        if (err) {
            console.error('Error en MySQL:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('Lead guardado con éxito');
        res.status(200).json({ status: 'success', message: 'Datos insertados' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor puente BYD corriendo en puerto ${PORT}`);
});