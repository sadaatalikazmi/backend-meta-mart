const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const { nonce } = require('../config/environment/const')


/**
 * Create New User
 */
// exports.createNewUser = (event) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const randomNumber = Math.floor(Math.random(Math.floor(Date.now() / 1000)) * 100000);
//       let publicAddress = event;
//       let findUser = await User.findOne({ publicAddress });
//       if (findUser) {
//         let nonce = findUser['nonce'];
//         return resolve(nonce)
//       } else {

//         let user = new User({
//           nonce,
//           publicAddress,
//           username: `user${randomNumber}`
//         });
//         await user.save();
//         return resolve(user["nonce"]);
//       }
//       const update = await User.updateOne({ publicAddress }, { nonce });
//       return resolve(update);
//     } catch (error) {
//       reject(error);
//     }
//   });
// }

/**
 * Create JWT
 */
exports.createJWT = async (userfound) => {

  return new Promise(async (resolve, reject) => {
    try {
      let token = jwt.sign({ id: userfound['id'], role: userfound['role'] }, config['secrets']['session'], { expiresIn: 60 * 60 * 24 * 365, algorithm: 'HS256' });
      resolve({ token });
    } catch (e) { reject(e) }
  });
};
