const { MongoClient } = require('mongodb');
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

const router = express.Router();
const upload = multer();

const client = new MongoClient(process.env.MONGO_URI);
let videoCollection;

// Configurar el cliente S3
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Conectar a la base de datos y obtener la colección
(async () => {
    try {
        await client.connect();
        const db = client.db(process.env.MONGO_DB_NAME);
        videoCollection = db.collection('videos');
        console.log('Conectado a MongoDB');
    } catch (error) {
        console.error('Error al conectar a MongoDB:', error);
    }
})();

// Endpoint para subir videos
router.post('/upload-video', upload.single('video'), async (req, res) => {
    const { fileName, userId } = req.body;

    console.log("Datos recibidos:", { fileName, userId, file: !!req.file }); // Debug

    if (!req.file || !fileName || !userId) {
        console.error('Error: Falta archivo, nombre o usuario');
        return res.status(400).send('Archivo, nombre y usuario son requeridos');
    }

    try {
        // Subir video a S3
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${userId}/${fileName}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(params);
        await s3.send(command);

        // Guardar video en la base de datos
        const video = {
            userId,
            name: fileName,
            key: `${userId}/${fileName}`,
        };
        await videoCollection.insertOne(video);

        res.send('Video subido exitosamente');
    } catch (error) {
        console.error('Error al subir video:', error);
        res.status(500).send('Error al subir video');
    }
});

// Endpoint para listar videos de un usuario
router.get('/list-videos/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // Buscar videos del usuario en la base de datos
        const videos = await videoCollection.find({ userId }).toArray();

        if (videos.length === 0) {
            return res.status(404).json({ message: 'No se encontraron videos para este usuario.' });
        }

        // Generar URLs firmadas para los videos
        const videosWithUrls = await Promise.all(
            videos.map(async (video) => {
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: video.key, // Llave específica del archivo en S3
                };

                const command = new GetObjectCommand(params);
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

                return {
                    name: video.name,
                    url,
                };
            })
        );

        res.json(videosWithUrls);
    } catch (error) {
        console.error('Error al listar videos:', error);
        res.status(500).json({ error: 'Error al listar videos' });
    }
});

// Endpoint para listar todos los videos del S3
router.get('/list-all-videos', async (req, res) => {
    try {
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
        };

        const command = new ListObjectsV2Command(params);
        const result = await s3.send(command);

        if (!result.Contents || result.Contents.length === 0) {
            return res.status(404).json({ message: "No se encontraron videos en el bucket." });
        }

        // Generar URLs firmadas para cada video
        const videos = await Promise.all(
            result.Contents.map(async (item) => {
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: item.Key,
                };

                const command = new GetObjectCommand(params);
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

                return {
                    name: item.Key.split('/').pop(), // Nombre del archivo
                    url,
                    path: item.Key, // Ruta completa en el bucket
                };
            })
        );

        res.json(videos);
    } catch (error) {
        console.error('Error al listar todos los videos:', error);
        res.status(500).json({ error: 'Error al listar todos los videos' });
    }
});



module.exports = router;
