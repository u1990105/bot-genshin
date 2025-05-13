const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 8080;

// Parámetros de resina
const RESINA_MAX = 200;
const REGEN_POR_MINUTO = 0.125; // 1 resina cada 8 minutos

const objetivos = {
    "R": 200,
    "L": 20,
    "D": 20,
    "J": 40,
    "S": 60
};

const TOKEN = process.env.DISCORD_TOKEN;
const connectionString = process.env.MONGO_DB_CONNECTION_STRING;

mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a Cosmos DB'))
  .catch(err => console.log('Error de conexión: ', err));

// Configuración de rutas de Express
app.get('/', (req, res) => {
    res.send('Bot de Resina está funcionando');
});

const recordatorioSchema = new mongoose.Schema({
    userId: String,
    n_resina: Number,
    objetivo: String,
    n_veces: Number,
    descripcion: String,
    fechaCreacion: { type: Date, default: Date.now },
    fechaEnvio: Date,
});

const Recordatorio = mongoose.model('Recordatorio', recordatorioSchema);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

client.once('ready', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);

    // Iniciar el servidor Express cuando el bot esté listo
    app.listen(port, () => {
        console.log(`✅ Servidor Express escuchando en http://localhost:${port}`);
    });

    // Crear el índice en fechaEnvio si no existe
    Recordatorio.collection.createIndex({ fechaEnvio: 1 })
        .then(() => console.log('✅ Índice en "fechaEnvio" creado o ya existente.'))
        .catch(err => console.error('❌ Error al crear índice:', err));

    // Iniciar el intervalo para revisar los recordatorios cada 5 minutos
    setInterval(async () => {
        const ahora = new Date();
        const recordatorios = await Recordatorio.find({ fechaEnvio: { $lte: ahora } });

        for (const r of recordatorios) {
            try {
                const usuario = await client.users.fetch(r.userId);
                if (usuario) {
                    await usuario.send(`¡Es hora de tu recordatorio!\n${r.descripcion}`);
                }
                await Recordatorio.deleteOne({ _id: r._id });
            } catch (err) {
                console.error('Error al enviar/eliminar recordatorio:', err);
            }
        }
    }, 300000); // Revisa cada 5 minutos (300000 ms)
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!help') || message.content.startsWith('!ayuda')) {
        const ayuda = `
            📖 **Instrucciones del bot de Resina:**

            Comandos disponibles:

            - \`!resina n_resina=<tu cantidad> objetivo=<R/L/D/J/S> [n_veces=<cantidad>]\`  
            👉 Calcula cuándo tendrás suficiente resina y te envía un recordatorio.
            
            - \`!listar\`  
            📋 Muestra todos tus recordatorios activos que faltan por avisar.

            - \`!cancelar <número>\`  
            ❌ Cancela un recordatorio específico (usa el número de \`!listar\`).

            **Ejemplos:**
            - \`!resina n_resina=80 objetivo=R\`
            - \`!resina n_resina=60 objetivo=D n_veces=2\`

            **Objetivos disponibles:**
            - R: Resina completa (200)
            - L: Brote de Línea de Ley (20)
            - D: Dominio (20)
            - J: Jefe normal (40)
            - S: Jefe semanal (60)
                    `;
        message.channel.send(ayuda);
        return;
    }

    if (message.content.startsWith('!resina')) {
        const args = message.content.slice('!resina'.length).trim().split(' ');
        let params = {};

        args.forEach(arg => {
            const [key, value] = arg.split('=');
            params[key] = value;
        });

        const n_resina = parseInt(params.n_resina);
        const objetivo = params.objetivo;
        const n_veces = parseInt(params.n_veces) || 1;

        if (isNaN(n_resina) || !objetivos[objetivo]) {
            message.channel.send('❌ Debes especificar una cantidad de resina válida y un objetivo correcto (R, L, D, J, S).');
            return;
        }

        if (n_resina === RESINA_MAX) {
            message.channel.send('✅ Ya tienes la resina completa.');
            return;
        }

        const costo = objetivos[objetivo];
        const max_veces = Math.floor(RESINA_MAX / costo);
        const veces = Math.max(1, Math.min(n_veces, max_veces));
        const resina_necesaria = costo * veces;

        if (n_resina >= resina_necesaria) {
            message.channel.send('✅ Ya tienes suficiente resina para esta acción.');
            return;
        }

        const tiempo_necesario_min = (resina_necesaria - n_resina) / REGEN_POR_MINUTO;
        const tiempo_horas = tiempo_necesario_min / 60;
        const nombreUsuario = message.author.username;

        let descripcion = "";
        let descrR = "";
        switch (objetivo) {
            case "R":
                descrR = `🌟 ${nombreUsuario} tendrá Resina completa`;
                descripcion = `${descrR} en ${Math.round(tiempo_necesario_min)} min (~${tiempo_horas.toFixed(2)} h)`;
                break;
            case "L": 
                descrR = `🌟 ${nombreUsuario} podrá hacer ${veces} Línea(s) de Ley`;
                descripcion = `${descrR} en ${Math.round(tiempo_necesario_min)} min`;
                break;
            case "D": 
                descrR = `🌟 ${nombreUsuario} podrá hacer ${veces} Dominio(s)`;
                descripcion = `${descrR} en ${Math.round(tiempo_necesario_min)} min`;
                break;
            case "J": 
                descrR = `🌟 ${nombreUsuario} podrá hacer ${veces} Jefe(s) normales`;
                descripcion = `${descrR} en ${Math.round(tiempo_necesario_min)} min`; 
                break;
            case "S":
                descrR = `🌟 ${nombreUsuario} podrá hacer ${veces} Jefe(s) semanales`;
                descripcion = `${descrR} en ${Math.round(tiempo_necesario_min)} min`;
                break;
        }
        const fechaR = new Date(Date.now() + tiempo_necesario_min * 60000)
        const nuevoRecordatorio = new Recordatorio({
            userId: message.author.id,
            n_resina,
            objetivo,
            n_veces: veces,
            descripcion: descrR + ' ja disponible!',
            fechaEnvio: fechaR
        });

        try {
            await nuevoRecordatorio.save();
            message.channel.send(descripcion);
            const fechaLocal = fechaR.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
            await message.author.send(`🔔 ¡Recordatorio guardado! Te avisaré aproximadamente el ${fechaLocal} `);
        } catch (err) {
            console.error('Error al guardar el recordatorio:', err);
            message.channel.send('❌ Error al guardar el recordatorio.');
        }
        return;
    }

    if (message.content.startsWith('!listar')) {
        Recordatorio.find({ userId: message.author.id })
            .sort('fechaEnvio')
            .then(recordatorios => {
                if (recordatorios.length === 0) {
                    message.channel.send('📭 No tienes recordatorios activos.');
                    return;
                }

                const lista = recordatorios.map((r, i) => {
                    const tiempoRestanteMin = Math.ceil((r.fechaEnvio - new Date()) / 60000);
                    let objetivoNombre = '';
                    switch (r.objetivo) {
                        case "R":
                            objetivoNombre = 'Resina Completa';
                            break;
                        case "L":
                            objetivoNombre = 'Línea de Ley';
                            break;
                        case "D":
                            objetivoNombre = 'Dominio';
                            break;
                        case "J":
                            objetivoNombre = 'Jefe Normal';
                            break;
                        case "S":
                            objetivoNombre = 'Jefe Semanal';
                            break;
                        default:
                            objetivoNombre = 'Objetivo Desconocido';
                            break;
                    }
                
                    return `${i + 1}. Resina: ${r.n_resina} | Objetivo: ${objetivoNombre} | Veces: ${r.n_veces} (en ${tiempoRestanteMin} min)`;
                
                }).join('\n');

                message.channel.send(`📋 ** ${nombreUsuario} - Tus recordatorios activos:**\n${lista}`);
            })
            .catch(err => {
                console.error('Error al listar recordatorios:', err);
                message.channel.send('❌ Error al obtener los recordatorios.');
            });
        return;
    }

    if (message.content.startsWith('!cancelar')) {
        const partes = message.content.split(' ');
        const indice = parseInt(partes[1]);

        if (isNaN(indice)) {
            message.channel.send('❌ Uso: `!cancelar <número>` (puedes ver los números con `!listar`)');
            return;
        }

        Recordatorio.find({ userId: message.author.id })
            .sort('fechaEnvio')
            .then(recordatorios => {
                const recordatorio = recordatorios[indice - 1];
                if (!recordatorio) {
                    message.channel.send('❌ Número inválido.');
                    return;
                }

                return Recordatorio.deleteOne({ _id: recordatorio._id }).then(() => {
                    message.channel.send(`✅ Recordatorio cancelado: "${recordatorio.descripcion}"`);
                });
            })
            .catch(err => {
                console.error('Error al cancelar recordatorio:', err);
                message.channel.send('❌ No se pudo cancelar el recordatorio.');
            });

        return;
    }
});

client.login(TOKEN);