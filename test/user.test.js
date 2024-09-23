process['env']['NODE_ENV'] = process['env']['NODE_ENV'] || 'development';
require('dotenv').config();

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server'); // Assuming your Express app is located in app.js
const Helper = require('./user.helper.test')

chai.use(chaiHttp);
const expect = chai.expect;



describe('User', () => {


    this.admin = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NGJhNWM5NTFlNWFjMzYzZDAzZDViYTkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTUwMzUwMzgsImV4cCI6MTY5NTE0MzAzOH0.-iDRZAZyQWCt5GXPx3T6so23Ejf9Lz1sqK4QWt5gIJc'
    this.user = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NTA5NDFlNThiM2JhNjY0MTAzYTE1ZDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTY5NTEwNTk2NywiZXhwIjoxNjk1MjEzOTY3fQ.wVydrlVKtqyv1XPmXcLacoPvho0Ot6qNFGhojb98Y3I'

    it('Admin: should  get all users information', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/user/getAllUsers')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        expect(res['body']['body']).to.be.an('array').that.is.not.empty;
                        expect(res['body']['body']).to.have.length.greaterThan(1);
                    }
                    else {
                        console.log('errored', err);
                        throw err;
                    }
                });
            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })

    it('Admin: without admin should not get all users information', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/user/getAllUsers')
                .send()
                .end((err, res) => {
                    expect(res).to.have.status(401);
                });
            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })


    it('Admin: should  get Customers graph,', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/user/newcustomers-graph')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        expect(res['body']['body']).to.include.keys('graph_hourly', 'graph_weekly', 'graph_1m');

                        expect(res['body']['body']['graph_hourly']).to.deep.include.keys('labels', 'series');
                        expect(res['body']['body']['graph_hourly']['labels']).to.be.an('array');
                        expect(res['body']['body']['graph_hourly']['series']).to.be.an('array');

                        expect(res['body']['body']['graph_weekly']).to.deep.include.keys('labels', 'series');
                        expect(res['body']['body']['graph_weekly']['labels']).to.be.an('array');
                        expect(res['body']['body']['graph_weekly']['series']).to.be.an('array');

                        expect(res['body']['body']['graph_1m']).to.deep.include.keys('labels', 'series');
                        expect(res['body']['body']['graph_1m']['labels']).to.be.an('array');
                        expect(res['body']['body']['graph_1m']['series']).to.be.an('array');
                    }
                    else { throw err }

                });
            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })

    it('Admin: without admin should not get Customers graph,', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/user/newcustomers-graph')
                .send()
                .end((err, res) => {
                    expect(res).to.have.status(401);
                });
            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })


    it('Admin: should update User', async (done) => {
        try {
            this.userId;
            const newZip = '22222222';

            // Get One User from Database
            chai
                .request(server)
                .get('/api/user/getAllUsers')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        this.userId = res['body']['body'][0]['_id'];
                        //  Update that User
                        chai
                            .request(server)
                            .patch(`/api/user/updateUser/${this.userId}`)
                            .set('Authorization', `Bearer ${this.admin}`)
                            .send({ 'zip': newZip })
                            .end((err, res) => {
                                expect(res['_body']['body']['zip']).equal(newZip)
                                expect(res).to.have.status(200);
                            });
                    }
                    else {
                        console.log('error ', err)
                        throw err;
                    }
                });
            done();

        } catch (error) {
            console.log('ERROR IT', error)
            throw error;
        }
    })

    it('Admin: without admin should not update User', async (done) => {
        try {
            this.userId;

            // Get One User from Database
            chai
                .request(server)
                .get('/api/user/getAllUsers')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    this.userId = res['body']['body'][0]['_id'];
                    // Update that User
                    chai
                        .request(server)
                        .patch(`/api/user/updateUser/${this.userId}`)
                        .send({ 'zip': '22222222' })
                        .end((err, res) => {
                            if (err, res) {

                                expect(res).to.have.status(401);
                            }
                            else {
                                console.log('error', err);
                                throw err;
                            }

                        });

                });
            done();

        } catch (error) {
            console.log('ERROR IT', error)
            throw error;
        }

    })

});


describe('Orders', () => {

    this.user = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NTA5NDFlNThiM2JhNjY0MTAzYTE1ZDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTY5NTEwNTk2NywiZXhwIjoxNjk1MjEzOTY3fQ.wVydrlVKtqyv1XPmXcLacoPvho0Ot6qNFGhojb98Y3I';

    it('User: should create an order with authentication', async (done) => {
        try {

            const status = 'IN PROCESS';
            const totalAmount = '100';

            // Select Product
            chai
                .request(server)
                .get('/api/product/getAllProduct')
                .send()
                .end((err, res) => {
                    const item = res['_body']['body'][0]

                    //  Create an order
                    chai
                        .request(server)
                        .post('/api/order/createOrder')
                        .set('Authorization', `Bearer ${this.user}`)
                        .send({ items: [item], status, totalAmount })
                        .end((err, res) => {
                            if (res) {

                                expect(res).to.have.status(200);
                            }
                            else {
                                console.log('error')
                                throw err;
                            }
                        });
                });

            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })

    it('User: should not create an order without authentication', async (done) => {
        try {

            const status = 'IN PROCESS';
            const totalAmount = '100';

            // Select Product
            chai
                .request(server)
                .get('/api/product/getAllProduct')
                .send()
                .end((err, res) => {
                    const item = res['_body']['body'][0]

                    //  Create an order
                    chai
                        .request(server)
                        .post('/api/order/createOrder')
                        .send({ items: [item], status, totalAmount })
                        .end((err, res) => {
                            expect(res).to.have.status(401);
                        });
                });

            done(); // Call done() to indicate that the test has completed
        } catch (error) {
            console.log('ERROR IT', error)
        }
    })

    it('Admin: should see all orders if you are admin', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/order/getAllOrders')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        const allOrders = res['body']['body']

                        expect(res).to.have.status(200);
                        expect(allOrders).to.be.an('array').that.is.not.empty;
                        expect(allOrders).to.have.length.greaterThan(1);

                    } else { console.log('errorrrr') }
                });
            done();

        } catch (error) {
            console.log('error', error);
            throw error;
        }
    });

    it('Admin: should not see all orders if you are not an admin', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/order/getAllOrders')
                .send()
                .end((err, res) => {
                    if (res) {
                        expect(res).to.have.status(401);
                    } else { console.log('errorrrr') }
                });
            done();

        } catch (error) {
            console.log('error', error);
            throw error;
        }
    });

    it('Admin: should show order stats if you are admin', async (done) => {
        try {

            chai
                .request(server)
                .get('/api/order/orders-stats')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        console.log('Response body: ******************', res.body);
                        expect(res).to.have.status(200);
                        expect(res['body']['body']).to.have.all.keys(
                            'total_orders_stats',
                            'completed_order_stats',
                            'pending_order_stats',
                            'cancelled_order_stats',
                            'total_sales_stats',
                            'pending_sales_stats',
                            'gross_sales_stats',
                            'average_price_stats',
                            'total_customers_stats'
                        );

                    } else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();

        } catch (error) {
            console.log('error', error)
        }
    });

    it('Admin: should not show order stats if you are not an admin', async (done) => {
        try {

            chai
                .request(server)
                .get('/api/order/orders-stats')
                .send()
                .end((err, res) => {
                    if (res) { expect(res).to.have.status(401); }
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();

        } catch (error) {
            console.log('error', error)
        }
    });

    //    Orders graphs

    it('Admin: should show order stats if you are admin', async (done) => {
        try {

            chai
                .request(server)
                .get('/api/order/orders-graphs')
                .set('Authorization', `Bearer ${this.admin}`)
                .send()
                .end((err, res) => {
                    if (res) { expect(res).to.have.status(401); }
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();

        } catch (error) {
            console.log('error', error)
        }
    });

    // EARNING GRAPH

    it('Admin: should show earning graph if you are admin', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/order/earning-graphs')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) { expect(res).to.have.status(401); }
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });

    //SET STATUS OF ORDER

    it('Admin: should set status of order if you are admin', async (done) => {
        try {
            chai
                .request(server)
                .put('/api/order/setStatus')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    console.log('*** res', res['body']);
                    if (res) {
                        expect(res).to.have.status(401);
                    }
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });

    //CREATING AN ORDER

    it('User:  While creating order it should contain required fields', async (done) => {
        //items, billing address, total amount, currency, status, receipt URL and transaction ID 
        try {
            chai
                .request(server)
                .post('/api/order/createOrder')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) {
                        expect(res).to.have.status(400);
                    }
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });
});

describe('Product', () => {

    this.user = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NTA5NDFlNThiM2JhNjY0MTAzYTE1ZDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTY5NTEwNTk2NywiZXhwIjoxNjk1MjEzOTY3fQ.wVydrlVKtqyv1XPmXcLacoPvho0Ot6qNFGhojb98Y3I';
    this.admin = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NGJhNWM5NTFlNWFjMzYzZDAzZDViYTkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTUwMzUwMzgsImV4cCI6MTY5NTE0MzAzOH0.-iDRZAZyQWCt5GXPx3T6so23Ejf9Lz1sqK4QWt5gIJc'


    it('Admin:  Should show hot products if you are admin', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/product/hot')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can update product', async (done) => {
        try {
            chai
                .request(server)
                .put('/api/product/updateProduct')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can place single product', async (done) => {
        try {
            chai
                .request(server)
                .put('/api/product/placingProduct')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can place multiple products', async (done) => {
        try {
            chai
                .request(server)
                .put('/api/product/place-many')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can get product quantity', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/product/productQuantity')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can get product Categories', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/product/productCategories')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can get Categoried Products', async (done) => {
        try {
            productId = "64dcc0777c89d3a90a0dffb4"
            chai
                .request(server)
                .get(`/api/product/getCategoriesProducts/${productId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can Add Product', async (done) => {
        try {
            chai
                .request(server)
                .post('/api/product/addProduct')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can delete product', async (done) => {
        try {
            productId = "64dcc0777c89d3a90a0dffb4"
            chai
                .request(server)
                .delete(`/api/product/deleteProduct/${productId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can delete product', async (done) => {
        try {
            productId = "64dcc0777c89d3a90a0dffb4"
            chai
                .request(server)
                .delete(`/api/product/deleteProduct/${productId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });

});


describe('Rack', () => {

    this.user = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NTA5NDFlNThiM2JhNjY0MTAzYTE1ZDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTY5NTEwNTk2NywiZXhwIjoxNjk1MjEzOTY3fQ.wVydrlVKtqyv1XPmXcLacoPvho0Ot6qNFGhojb98Y3I'
    this.admin = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NGJhNWM5NTFlNWFjMzYzZDAzZDViYTkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2OTUwMzUwMzgsImV4cCI6MTY5NTE0MzAzOH0.-iDRZAZyQWCt5GXPx3T6so23Ejf9Lz1sqK4QWt5gIJc'


    it('Admin:  only admin can create rack', async (done) => {
        try {
            chai
                .request(server)
                .post('/api/rack/createRack')
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can update rack', async (done) => {
        try {
            rackId = "64d365f13e4e46ba0d5dc79b"
            chai
                .request(server)
                .put(`/api/rack/updateRack/${rackId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can place product in rack', async (done) => {
        try {
            productId = "64dcc0777c89d3a90a0dffb4"
            chai
                .request(server)
                .put(`/api/rack/placeProduct/${productId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });

    it('User:  Must be login before getting rack', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/rack/getRack')
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('User:  Must be login before getting All the racks', async (done) => {
        try {
            chai
                .request(server)
                .get('/api/rack/getRacks')
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });


    it('Admin:  only admin can delete rack', async (done) => {
        try {
            rackId = "64d365f13e4e46ba0d5dc79b"
            chai
                .request(server)
                .delete(`/api/rack/deleteRacks/${rackId}`)
                .set('Authorization', `Bearer ${this.user}`)
                .send()
                .end((err, res) => {
                    if (res) expect(res).to.have.status(401);
                    else {
                        console.log('errorrrr', err)
                        throw err
                    }
                });
            done();
        } catch (error) {
            console.log('error', error)
        }
    });

})

