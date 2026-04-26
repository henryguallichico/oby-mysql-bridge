const express = require('express');
const mysql = require('mysql2/promise'); // Usamos la versión de promesas para consistencia
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de conexión (Pool de Promesas)
const db = mysql.createPool({
    host: process.env.DB_HOST || 'dbsignature.cwkcc7shlips.us-east-1.rds.amazonaws.com',
    user: process.env.DB_USER || 'usr_inconcert',
    password: process.env.DB_PASSWORD || 'BL$5fvfu$ggMBAQkJsw@D',
    database: process.env.DB_NAME || 'occ_survey_prod',
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
});

// 1. ENDPOINT: INSERTAR INTERACCIÓN (El que ya usas)
app.post('/webhook-oby', async (req, res) => {
    const { nombre, modelo, score, mensaje } = req.body;
    try {
        const sql = `CALL sp_InsertarInteraccion(?, ?, ?, ?)`;
        await db.query(sql, [nombre, modelo, score, mensaje]);
        console.log('Lead guardado con éxito');
        res.status(200).json({ status: 'success', message: 'Datos insertados' });
    } catch (err) {
        console.error('Error en MySQL:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. ENDPOINT: BUSCAR LEAD (Para saber si saludarlo o validarlo)
app.post('/check-lead', async (req, res) => {
    const { telefono } = req.body;
    try {
        // En MySQL usamos .query() con el pool de promesas
        const [rows] = await db.query('SELECT * FROM leads WHERE telefono = ? LIMIT 1', [telefono]);
        if (rows.length > 0) {
            res.json({ existe: true, datos: rows[0] });
        } else {
            res.json({ existe: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ENDPOINT: VALIDAR EXPERIENCIA (Saber si ya pasó por P1)
// Esto reemplaza la lógica de "Validación Experiencia EV" de tu flujo
app.post('/check-experience', async (req, res) => {
    const { telefono } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT estado_validacion FROM leads_postventa WHERE telefono = ? AND modelo_interes = "EV"', 
            [telefono]
        );
        res.json({ 
            ya_validado: rows.length > 0 && rows[0].estado_validacion === 'completado',
            detalle: rows[0] || null 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. ENDPOINT: OBTENER ASESORES DISPONIBLES
app.get('/get-asesores', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nombre, especialidad FROM asesores WHERE activo = 1');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. ENDPOINT: OBTENER HISTORIAL (Para que el agente de OBY tenga contexto)
app.post('/get-history', async (req, res) => {
    const { telefono } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT mensaje, fecha FROM agent_feedback WHERE telefono = ? ORDER BY fecha DESC LIMIT 5', 
            [telefono]
        );
        res.json({ historial: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health Check para Railway
app.get('/', (req, res) => res.send('Servidor BYD activo'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});