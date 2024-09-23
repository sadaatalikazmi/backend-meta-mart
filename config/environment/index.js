'use strict';

const ip = require('ip');
const _ = require('lodash');
const path = require('path');
const aws = require('aws-sdk');
const express = require('express');


process.env.IP = ip.address();
const port_no = process.env.PORT || 3000;
process.env.NODE_ENV = process.env.NODE_ENV || 'development';


process['env']['IP'] = ip.address();
process['env']['NODE_ENV'] = process['env']['NODE_ENV'] || 'development';

let ses = new aws.SES(
  {
    region: process['env']['AWS_REGIONS'],
    accessKeyId: process['env']['AWS_KEY'],
    secretAccessKey: process['env']['AWS_SECRET']
  });

const all = {
  // S3 configuartion
  s3: require('../../utils/s3Config').s3,
  s3Bucket: require('../../utils/s3Config').s3Bucket,
  upload: require('../../utils/s3Config').upload,

  env: process.env.NODE_ENV,

  // Frontend path to server
  assets: express.static(__dirname + '/../../public'),
  view: path.normalize(__dirname + '/../../public/index.html'),

  // Server port
  port: process.env.PORT || 4006,

  // Server IP
  ip: process.env.IP || '0.0.0.0',

  // Should we populate the DB with sample data ?
  seedDB: true,

  mongo: {
    db_url: process['env']['dev_db_url'],
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    },
    debug: false,
  },

  secrets: {
    session: 'Softtik_s3cr3t_2023',
    refresh: 'Nifty_s3cr3t_2023'
  },
};

/* Export the config object based on the NODE_ENV*/
/*===============================================*/

module.exports = _.merge(all, require(`./${process.env.NODE_ENV}.js`) || {}, require(`./const.js`));