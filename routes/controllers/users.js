const pool  = require('../../db/mongo');
const CryptoJS = require('crypto-js');
const moment = require('moment-timezone');

//---------------Login---------------------

const validateCredentials = async (req, res) => {
    const datos = req.body;
    //console.log("LOGIN: ", datos);
    const hashedPassword = CryptoJS.SHA256(datos.password, process.env.CODE_SECRET_DATA).toString();
    console.log("PASSS: ", hashedPassword);
    try{
      const login =  await pool.db('gana_como_loco').collection('users').findOne({ email: datos.email, pass: hashedPassword });
      if (login) {
        console.log({ status: "Bienvenido", user: datos.email, role: login.role, _id: login._id });

        // Obtener la fecha y hora actual en formato Bogotá
        const currentDateTime = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss');
        // Almacenar en la colección log_login
        await pool.db('gana_como_loco').collection('log_login').insertOne({ email: datos.email, role: login.role, date: currentDateTime });
        res.json({ status: "Bienvenido", 
          user: datos.email, 
          role: login.role, 
          _id: login._id.toString() // Convertir _id a cadena
        });
      } else {
        res.json({ status: "ErrorCredenciales" });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ status: "Error", message: "Internal Server Error" });
    }
  };

  const Signup = async (req, res) => {
    console.log("Datos recibidos:", req.body);
    const datos = req.body;
    const hashedPassword = CryptoJS.SHA256(datos.password, process.env.CODE_SECRET_DATA).toString();
    console.log("Contraseña",hashedPassword);
    try {
        const userFind = await pool.db('gana_como_loco').collection('users').findOne({ email: datos.email });
        if (userFind) {
            res.status(409).json({ message: `El usuario con el correo: ${datos.email} ya está creado` });
        } else {
            const newUser = await pool.db('gana_como_loco').collection('users').insertOne({ email: datos.email, pass: hashedPassword, role: datos.role });
            const userId = newUser.insertedId;
            await pool.db('gana_como_loco').collection('user_info').insertOne({ user_id: userId, nombre: datos.name, celular: datos.phone, fecha_nac: datos.birthdate, cedula: datos.idNumber, ciudad: datos.city });
            res.status(201).json({ message: `Usuario creado exitosamente` });
        }
    } catch (error) {
        console.error('Error al crear el usuario:', error);
        res.status(500).json({ message: 'Error al crear el usuario' });
    }
  }

  
  module.exports = { validateCredentials, Signup };