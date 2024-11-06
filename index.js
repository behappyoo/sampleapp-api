const express = require('express');
const cors = require('cors');

const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());

// AWS S3 설정
const s3Client = new S3Client({
	    region: 'ap-northeast-2',
	    credentials: {
		            accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
		            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
		        }
});

// multer 설정
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: 'sample-app-bucket1',
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            cb(null, `uploads/${Date.now().toString()}`); // 저장할 파일 경로 및 이름
        }
    })
});

// MariaDB 연결 풀 설정
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: process.env.DB_POOL_MAX // 최대 10개의 연결 유지
});


// 파일과 텍스트 데이터 받기
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
	console.log('요청들어옴');
        // 이미지 업로드가 완료되면 req.file에 파일 정보가 담깁니다.
        const text = req.body.text; // 텍스트 데이터
        const fileUrl = req.file.location; // S3에서의 파일 URL
        const fileName = req.file.key; // S3에 저장된 파일 이름 (키)

        // 텍스트 데이터 삽입
        const [textResult] = await pool.query(`INSERT INTO text (content) VALUES (?)`, [text]);
        
        // 이미지 데이터 삽입
        await pool.query(`INSERT INTO image (post_id, file_name, url) VALUES (?, ?, ?)`, [
            textResult.insertId, fileName, fileUrl
        ]);

        // 파일과 텍스트를 성공적으로 받았을 때 응답
        res.status(201).json({ message: '업로드 성공!' });
    } catch (err) {
        console.error('Error during upload:', err);
        res.status(500).json({
            message: 'Error during upload',
            error: err.message // 에러 메시지 반환
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});


app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://0.0.0.0:3000');
});
