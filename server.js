const express = require('express');
const mysql = require('mysql2/promise'); 
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de conexión
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
    try {
        const telefono = req.body.telefono || null;
        if (!telefono) {
            return res.json({ existe: false, msg: "Esperando teléfono para pruebas" });
        }
        const [rows] = await db.query('SELECT * FROM leads WHERE telefono = ? LIMIT 1', [telefono]);
        res.json({ existe: rows.length > 0, datos: rows[0] || null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ENDPOINT: VALIDAR EXPERIENCIA (Saber si ya pasó por P1)
// Esto reemplaza la lógica de "Validación Experiencia EV" de tu flujo
app.post('/check-experience', async (req, res) => {
    try {
        const telefono = req.body.telefono || null;
        // Si no hay teléfono (como en el test de OBY), respondemos éxito falso en lugar de error 500
        if (!telefono) {
            return res.json({ ya_validado: false, msg: "Modo configuración: Sin teléfono" });
        }

        // IMPORTANTE: Verifica si esta tabla existe. Si no, usa 'leads' para la prueba.
        const [rows] = await db.query('SELECT * FROM leads WHERE telefono = ? LIMIT 1', [telefono]);
        
        res.json({ 
            ya_validado: rows.length > 0, 
            datos: rows[0] || null 
        });
    } catch (error) {
        // Esto te dirá en OBY exactamente qué falló (ej: si la tabla no existe)
        res.status(500).json({ error: error.message, note: "Revisa si la tabla existe en RDS" });
    }
});

// 4. ENDPOINT: OBTENER ASESORES DISPONIBLES

app.get('/get-asesores', async (req, res) => {
    try {
        console.log("Consultando lista de asesores...");
        
       
        const [rows] = await db.query('SELECT owner_id, nombre FROM asesores WHERE activo = 1');
        
       
        res.json(rows || []);
        
    } catch (error) {
        console.error("Error en get-asesores:", error.message);
        res.status(500).json({ 
            error: "Error al consultar asesores", 
            detail: error.message,
            code: error.code 
        });
    }
});

// Endpoint para consultar catálogo de vehículos

app.get('/consultar-catalogo', async (req, res) => {
    const { modelo } = req.query;

    if (!modelo) {
        return res.status(400).json({ error: "Falta el parámetro modelo" });
    }

    try {
        // Usamos 'db.query' para ser consistentes con tus otros servicios
        const [rows] = await db.query(
            "SELECT * FROM vehiculos WHERE LOWER(modelo) LIKE LOWER(?)", 
            [`%${modelo}%`]
        );

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "No se encontró el modelo " + modelo });
        }
    } catch (error) {
        console.error("Error en /consultar-catalogo:", error);
        res.status(500).json({ error: "Error interno", detalle: error.message });
    }
});

// 5. ENDPOINT: OBTENER HISTORIAL (Para que el agente de OBY tenga contexto)
app.post('/get-history', async (req, res) => {
    try {
        const telefono = req.body.telefono || null;
        if (!telefono) {
            return res.json({ historial: [], msg: "Modo configuración" });
        }
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