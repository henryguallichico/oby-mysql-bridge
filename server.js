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
    let modeloRecibido = req.query.modelo || '';
    
    // Limpieza de llaves de ObyMind
    modeloRecibido = modeloRecibido.replace(/[{}]/g, '').trim();

    // LOG de monitoreo
    console.log(`Consulta recibida para el modelo: "${modeloRecibido}"`);

    // RESPUESTA POSITIVA PARA CONFIGURACIÓN (Evita el Error 400)
    // Si el modelo está vacío o es el nombre de la variable, devolvemos un JSON de éxito
    if (!modeloRecibido || modeloRecibido === 'modelo_cliente' || modeloRecibido === 'modelo') {
        return res.status(200).json({
            status: "conectado",
            mensaje: "Esperando variable modelo_cliente para buscar en base de datos",
            bateria: "Pendiente",
            autonomia: "Pendiente",
            potencia: "Pendiente"
        });
    }

    try {
        const query = "SELECT * FROM vehiculos WHERE LOWER(modelo) LIKE LOWER(?) LIMIT 1";
        const [rows] = await db.query(query, [`%${modeloRecibido}%`]);

        if (rows.length > 0) {
            const v = rows[0];
            // Mapeo exacto según tus columnas de MySQL
            const dataVehiculo = {
                modelo: v.modelo,
                precio: v.precio_desde,
                autonomia: v.autonomia_km + " km",
                potencia: v.hp + " HP",
                bateria: v.bateria_kwh + " kWh",
                carga: v.tiempo_carga,
                tecnologia: v.destacados // O la columna que prefieras para motor
            };
            
            console.log(`✅ Datos encontrados para ${v.modelo}`);
            res.json(dataVehiculo);
        } else {
            // Si el modelo no existe, enviamos 200 pero avisamos que no hay datos
            res.status(200).json({ 
                error: "Modelo no registrado",
                mensaje: "Verifica que el nombre coincida con la base de datos" 
            });
        }
    } catch (error) {
        console.error("❌ Error en DB:", error);
        res.status(500).json({ error: "Error interno del servidor" });
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