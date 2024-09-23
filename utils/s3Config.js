const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3-transform');

const s3 = new aws.S3({
  region: process['env']['AWS_GOTOGODS_REGIONS'],
  accessKeyId: process['env']['AWS_ACCESS_KEY'],
  secretAccessKey: process['env']['AWS_SECRET_KEY'],
});

const s3Bucket = multer({
  limits: {
    fileSize: 1024 * 1024 * 200 /* We are allowing only 200 MB files */
  },
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET,
    key: (req, file, cb) => {
      let fileType = file['mimetype'].split('/')[1];

      return cb(null, `${process['env']['NODE_ENV']}/${fileType}/${file['originalname']}`);
    },
  }),
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    ACL: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, file['originalname'])
    }
  })
});

module.exports = { s3, s3Bucket, upload };