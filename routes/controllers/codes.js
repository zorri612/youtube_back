const pool  = require('../../db/mongo');
const { ObjectId } = require('mongodb');
const moment = require('moment-timezone');

//---------------Validar código promocional---------------------
const validateCredentials = async (req, res) => {
    const { code, userId } = req.body; // Se recibe el código y el ID del usuario desde el frontend
    try {
        // Buscar si el código existe en la base de datos
        const existingCode = await pool.db('gana_como_loco').collection('codigos').findOne({ code });

        if (existingCode) {
            // Verificar si el código ya ha sido usado por otro usuario
            if (existingCode.status !== 'libre') {
                return res.status(400).json({ status: "Error", message: "Ups, al parecer este código ya ha sido usado." });
            }

            // Obtener la fecha y hora actual en formato Bogotá
            const currentDateTime = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss');
            const userObjectId = new ObjectId(userId);

            // Actualizar el código en la base de datos: cambiar el estado a ocupado y asignar el userId y la fecha
            await pool.db('gana_como_loco').collection('codigos').updateOne(
                { code }, // Filtro para encontrar el código
                { 
                    $set: { 
                        status: userObjectId, // Cambia el estado a userId para indicar que está ocupado
                        date: currentDateTime // Registra la fecha en la que se usó el código
                    }
                }
            );

            // Responder con el valor del premio
            const prizeValue = existingCode.value;
            let message = "";

            if (prizeValue === 0) {
                message = "No ganaste";
            } else {
                message = `¡Ganaste  ${prizeValue} en Nequi!`;
            }

            return res.status(200).json({ status: "Success", message, prizeValue });

        } else {
            // Si el código no existe
            return res.status(404).json({ status: "Error", message: "Código no válido o inexistente" });
        }
    } catch (error) {
        console.error('Error fetching code:', error);
        return res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

const getUserCodes = async (req, res) => {
    const { userId } = req.body;
    
    try {
        const userObjectId = new ObjectId(userId);  // Convertir el userId a ObjectId
        const codes = await pool.db('gana_como_loco').collection('codigos').find({ status: userObjectId }).toArray();
        
        res.status(200).json({ status: "Success", codes });
    } catch (error) {
        console.error('Error fetching codes:', error);
        res.status(500).json({ status: "Error", message: "Error interno del servidor" });
    }
};

const getWinners = async (req, res) => {
    try {
        // Busca todos los códigos con status que no sea "libre" (o sea, los códigos que han sido reclamados)
        const winners = await pool.db('gana_como_loco').collection('codigos').aggregate([
            {
                $match: { status: { $ne: 'libre' } }  // Buscar códigos ocupados
            },
            {
                $lookup: {
                    from: 'user_info',  // Nombre de la colección que tiene la info del usuario
                    localField: 'status',  // Este campo contiene el ObjectId del usuario
                    foreignField: 'user_id',  // Relación con el campo _id de user_info
                    as: 'userInfo'
                }
            },
            {
                $unwind: '$userInfo'  // Descomponer el array resultante de userInfo
            },
            {
                $project: {
                    date: 1,
                    code: 1,
                    value: 1,  // El valor del premio
                    'userInfo.nombre': 1,
                    'userInfo.cedula': 1,
                    'userInfo.celular': 1,
                    'userInfo.ciudad': 1
                }
            }
        ]).toArray();

        res.status(200).json({ status: 'success', data: winners });
    } catch (error) {
        console.error('Error fetching winners:', error);
        res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
    }
};




module.exports = { validateCredentials, getUserCodes, getWinners };
