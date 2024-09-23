'use strict';

const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const config = require('../config/environment');
const compose = require('composable-middleware');
const responseCode = require('../config/ResponseCodes');
const { sendResponse, errReturned } = require('../config/dto');
const validateJwt = expressJwt({ secret: config['secrets']['session'] });

/**
 * Attaches User object to the Request if Authenticated
 * Otherwise returns 403
 **/
function isAuthenticated() {
  return compose().use((req, res, next) => {
    if (!req.headers.hasOwnProperty('authorization'))
      return sendResponse(
        res,
        responseCode['UNAUTHORIZED'],
        'Please login to perform this action'
      );

    if (req.query && req.query.hasOwnProperty('access_token'))
      req.headers.authorization = `Bearer ${req.query.access_token}`;

    validateJwt(req, res, (error, decoded) => {
      if (error)
        return sendResponse(
          res,
          responseCode['UNAUTHORIZED'],
          `Your session has expired`
        );
      next(decoded);
    });
  });
}

/**
 * Checks if the user role meets the minimum requirements of the role
 */
function hasRole(...roles) {
  if (!roles) throw new Error('Required role needs to be set');

  return compose()
    .use(isAuthenticated())
    .use(function meetsRequirements(req, res, next) {
      if (roles.includes(req['user']['role'])) next();
      else
        return sendResponse(
          res,
          401,
          `You must have ${roles} role perform this action.`
        );
    });
}


/**
 * Checks if the role of user is Admin
 */
function anyAdmin() {
  return compose()
    .use(isAuthenticated())
    .use(function meetsRequirements(req, res, next) {
      if (config['adminRoles'].indexOf(req['user']['role']) >= 0) next();
      else return sendResponse(res, 403, 'Forbidden');
    });
}

/**
 * Returns a jwt token signed by the app secret
 */
function signToken(_id) {
  return jwt.sign({ _id: _id }, config.secrets.session, {
    expiresIn: 60 * 60 * 50
  });
}


exports.hasRole = hasRole;
exports.anyAdmin = anyAdmin;
exports.signToken = signToken;
exports.isAuthenticated = isAuthenticated;
