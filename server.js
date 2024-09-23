process['env']['NODE_ENV'] = process['env']['NODE_ENV'] || 'development';
require('dotenv').config({ path: `./.env.${process['env']['NODE_ENV']}` });

require('dotenv').config();

const cors = require('cors');
const morgan = require('morgan');
require('colors');
const express = require('express');
const requestIp = require('request-ip');
const bodyParser = require('body-parser');

let app = express();
const config = require('./config/environment');

app.use(cors());
app.use(morgan('dev'));
app.use(config.assets);
app.use(requestIp.mw());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

require('./routes')(app);
require('./config/seed');
require('./config/sqlConnection');
require('./utils/cron');

app.get('*', (req, res) => res.sendFile(config.view));

let server = require('http').createServer(app);

server.listen(config['port'], () => console.log(`listening to ${config['port']}  ${process.env.NODE_ENV}`.yellow.bold));

module.exports = server;
