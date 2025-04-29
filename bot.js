const { Client, GatewayIntentBits } = require('discord.js');

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

// Tu token del bot
const TOKEN = process.env.TOKEN;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Bot listo como ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!help') || message.content.startsWith('!ayuda')) {
        const ayuda = `
    📖 **Instrucciones de uso del bot de Resina:**
    
    Usa el comando:
    
    \`!resina n_resina=<tu cantidad> objetivo=<R/L/D/J/S> [n_veces=<cantidad>] [min_aviso=<minutos>]\`
    
    **Ejemplos:**
    - \`!resina n_resina=80 objetivo=R\`
    - \`!resina n_resina=60 objetivo=D n_veces=2\`
    
    **Objetivos disponibles:**
    - R: Resina completa
    - L: Brote de Línea de Ley
    - D: Dominio
    - J: Jefe normal
    - S: Jefe semanal
    
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
        const min_aviso = parseInt(params.min_aviso) || 0;

        if (isNaN(n_resina) || !objetivos[objetivo]) {
            message.channel.send('❌ Error: Debes especificar una cantidad de resina válida (0-200) y un objetivo (R, L, D, J, S).');
            return;
        }

        if (n_resina === RESINA_MAX) {
            message.channel.send('✅ Ya tienes la resina llena.');
            return;
        }

        const costo = objetivos[objetivo];
        const max_veces = Math.floor(RESINA_MAX / costo);
        const veces = Math.max(1, Math.min(n_veces, max_veces));
        const resina_necesaria = costo * veces;

        if (n_resina >= resina_necesaria) {
            message.channel.send('✅ Ya tienes suficiente resina para realizar esta acción.');
            return;
        }

        const tiempo_necesario_min = (resina_necesaria - n_resina) / REGEN_POR_MINUTO;
        const tiempo_horas = tiempo_necesario_min / 60;

        let descripcion = "";

        switch (objetivo) {
            case "R":
                descripcion = `🌟 Tu resina se rellenará completamente en ${Math.round(tiempo_necesario_min)} minutos (~${tiempo_horas.toFixed(2)} horas).`;
                break;
            case "L":
                descripcion = `🌟 Podrás reclamar ${veces} Brotes de Línea de Ley en ${Math.round(tiempo_necesario_min)} minutos (~${tiempo_horas.toFixed(2)} horas).`;
                break;
            case "D":
                descripcion = `🌟 Podrás completar ${veces} Dominios en ${Math.round(tiempo_necesario_min)} minutos (~${tiempo_horas.toFixed(2)} horas).`;
                break;
            case "J":
                descripcion = `🌟 Podrás enfrentarte a ${veces} Jefes en ${Math.round(tiempo_necesario_min)} minutos (~${tiempo_horas.toFixed(2)} horas).`;
                break;
            case "S":
                descripcion = `🌟 Podrás desafiar a ${veces} Jefes Semanales en ${Math.round(tiempo_necesario_min)} minutos (~${tiempo_horas.toFixed(2)} horas).`;
                break;
        }

        message.channel.send(descripcion);
    }
});

client.login(TOKEN);
