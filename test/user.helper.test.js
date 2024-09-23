const axios = require('axios');


exports.getSingleUser = async (token) => {

        try {

            const endpoint = 'http://localhost:4000/api/user/getAllUsers'; // Replace with your API endpoint

            axios.get(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
                .then(response => {
                    const data = response.data;
                    // Handle the response data
                    this.userId = data['body'][0]['_id'];
                    return(this.userId);
                    // console.log(`&*()`, data['body'][0]);
                    // updateUser(this.userId);
                })
                .catch(error => {
                    // Handle any errors
                    console.error(`error`, error);
                    return(error)
                });

        } catch (e) { return(e) }
};


exports.updateUser = async (userId, chai, server) => {

        try {

            chai
                .request(server)
                .patch(`/api/user/updateUser/${userId}`)
                .send({ 'zip': '22222222' })
                .end((err, res) => {
                    return(res)
                    // expect(res).to.have.status(401);
                });

            // done(); // Call done() to indicate that the test has completed
        } catch (e) { return(e) }
};
