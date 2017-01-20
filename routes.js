'use strict';
var express = require('express');
var router = express.Router();
var mongo = require('mongodb');
//var dburl = 'mongodb://localhost/favex'; //url to access mongo database
var dburl= require('./apiKeys.js').mongoLabUrl;
var winston = require('winston');

var fs = require('fs');
const env = 'development';
const logDir = 'log'

var googleMapsKey = require('./apiKeys.js').googleMapsKey;
var googleMapsClient = require('@google/maps').createClient(
    {
        key: googleMapsKey
    });

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}


const tsFormat = () => (new Date()).toLocaleTimeString();
const logger = new (winston.Logger)({
  transports: [
    // colorize the output to the console
    new (winston.transports.Console)({
      timestamp: tsFormat,
      colorize: true,
      level: 'info'
    }),
    new (require('winston-daily-rotate-file'))({
      filename: `${logDir}/-results.log`,
      timestamp: tsFormat,
      datePattern: 'yyyy-MM-dd',
      prepend: true,
      level: env === 'development' ? 'verbose' : 'info'
    })
  ]
});
logger.debug('Debugging info');
logger.verbose('Verbose info');
logger.info('Hello world');
logger.warn('Warning message');
logger.error('Error info');


router.use(function timeLog(req, res, next) {
    var date = new Date(Date.now());
    logger.info('Request Recieved: ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + ' ' + (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear());
    next();
}); //logs every request recieved in console, should add request content type checking

router.route('/addUser').post(function (req, res) {

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var users = db.collection('users');

        users.updateOne(
            { "facebookId": req.body.user.facebookId },   //find user by fb id
            req.body.user,                      //replace user found in db with this user object
            { upsert: true, w: 1 },                //add new object if doesn't exist
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                else {
                    res.send(true);
                    logger.info('user added successfully');    //temp output to log inserted user
                    db.close();
                }
            });
    });
});

router.route('/addFavor').post(function (req, res) {
    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.insertOne(req.body.favor, function (err, object) {
            if (err) {
                res.send(false);
                logger.info(err);
            }
            else {
                res.send(true);
                logger.info('favor added to favors collection');
            }
            db.close();
        });

        var users = db.collection('users');

    });
});

router.route('/getUser').get(function (req, res) {
    //check if user object sent
    if (req.query.id === undefined) {
        res.send(false)
        logger.info('Missing id parameter');
        return;
    }

    if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var users = db.collection('users');

        users.find({ 'facebookId': req.query.id }).toArray(function (err, docs) {
            if (err) {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }

            res.send(docs[0]);
            db.close();

        });
    });

});

router.route('/getFavorsRequested').get(function (req, res) {
    if (req.query.id === undefined) {
        res.send(false)
        logger.info('missing id parameter');
        return;
    }

    if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.find({ "recipientId": req.query.id }).toArray(function (err, docs) {
            if (err) {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }
            else {
                res.send(docs);
                logger.info('favorsRequested sent');
                db.close();
            }
        });

    });
});

router.route('/getFavorsDone').get(function (req, res) {
    if (req.query.id === undefined) {
        res.send(false);
        logger.info('missing id parameter');
        return;
    }
    else if (req.query.id.length === 0) {
        res.send(false);
        logger.info('id key is empty');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }

            var favors = db.collection('favors');

            favors.find({ "doerId": req.query.id }).toArray(function (err, docs) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                else {
                    res.send(docs);
                    logger.info('favorsDone sent');
                    db.close();
                }
            });
        });
    }
});

router.route('/getNearbyFavors').get(function (req, res) {
    var lat = req.query.lat;
    var lng = req.query.lng;
    var radius = (req.query.radius != undefined && req.query.radius.length != 0) ?
        req.query.radius : 500; //uses default value meters when radius n/a
    if (req.query.lat === undefined || req.query.lng === undefined) {
        res.send(false);
        logger.info('Missing lat or lng parameter');
        return;
    }
    else if (req.query.lat.length === 0 || req.query.lng.length === 0) {
        res.send(false);
        logger.info('lat or lng key is empty');
        return;
    }
    else {
        var userLocation =
            {
                lat: lat,
                lng: lng
            };
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                db.close();
                return;
            }
            var favors = db.collection('favors');
            favors.find({ "doerId": null }).toArray(function (err, openFavors)
            //above returns favors withour doerId fiels or favors with doerId set to null
            {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                else {
                    var favorLocations = [];
                    for (var i = 0; i < openFavors.length; i++)
                        favorLocations.push(openFavors[i].locationFavor);
                    if (favorLocations.length === 0) {
                        res.send(false);
                        logger.info('no nearby favors available');
                        db.close();
                        return;
                    }
                    else {
                        var distanceQuery =
                            {
                                origins: userLocation,
                                destinations: favorLocations,
                                mode: 'walking'
                            }
                        googleMapsClient.distanceMatrix(distanceQuery, function (err, result) {
                            if (err) {
                                res.send(false);
                                logger.info(err);
                                db.close();
                                return;
                            }
                            else {
                                var nearbyFavors = [];
                                for (var i = 0; i < result.json.rows[0].elements.length; i++) {
                                    if (result.json.rows[0].elements[i].distance.value <= radius) {
                                        nearbyFavors.push(openFavors[i]);
                                        logger.info("");
                                    }
                                }
                                res.send(nearbyFavors);
                                logger.info('nearby favors sent');
                                db.close();
                            }
                        });
                    }
                }
            });
        });
    }
});

router.route('/updateLocation').put(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        logger.info('invalid user object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var users = db.collection('users');

        users.updateOne(
            { "facebookId": req.body.user.facebookId },
            { $set: { "location": req.body.user.location } },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }

                res.send(true);
                logger.info("location of user: " + req.body.user.facebookId + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateTip').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            { $set: { "tip": req.body.favor.tip } },
            { w: 1 },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    return;
                }

                res.send(true);
                logger.info("tip of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateFavorStatus').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.updateOne(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            { $set: { "isComplete": req.body.favor.isComplete } },
            { w: 1 },
            function (err, object) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    return;
                }

                res.send(true);
                logger.info("status of favor: " + req.body.favor._id + " updated successfully");
                db.close();
            }
        );
    });
});

router.route('/updateDoer').put(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid user favor sent');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }
            var favors = db.collection('favors');
            favors.findOneAndUpdate({ "_id": new mongo.ObjectID(req.body.favor._id) },
                { $set: { "doerId": req.body.favor.doerId } },
                function (err, result) {
                    if (err) {
                        res.send(false);
                        logger.info(err);
                        db.close();
                        return;
                    }
                    else {
                        res.send(true);
                        logger.info("doerId: " + req.body.favor.doerId + " updated successfully");
                        db.close();
                    }
                });
        });
    }
});

router.route('/updateRating').put(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        logger.info('invalid user object sent');
        return;
    }
    else {
        mongo.connect(dburl, function (err, db) {
            if (err) {
                res.send(false);
                logger.info(err);
                return;
            }
            var users = db.collection('users');
            users.findOneAndUpdate({ "_id": new mongo.ObjectID(req.body.user._id) },
                { $set: { "rating": req.body.user.rating } },
                function (err, result) {
                    if (err) {
                        res.send(false);
                        logger.info(err);
                        db.close();
                        return;
                    }
                    else {
                        res.send(true);
                        logger.info("rating: " + req.body.user.rating + " updated successfully");
                        db.close();
                    }
                });
        });
    }
});

router.route('/deleteFavor').delete(function (req, res) {
    if (req.body.favor === undefined) {
        res.send(false)
        logger.info('invalid favor object sent');
        return;
    }

    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }

        var favors = db.collection('favors');

        favors.remove(
            { "_id": new mongo.ObjectID(req.body.favor._id) },
            function (err) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }

                res.send(true);
                logger.info('favor: ' + req.body.favor._id + ' successfully deleted');
                db.close();
            }
        );
    });
});

router.route('/deleteUser').delete(function (req, res) {
    if (req.body.user === undefined) {
        res.send(false)
        logger.info('invalid user object sent');
        return;
    }
    mongo.connect(dburl, function (err, db) {
        if (err) {
            res.send(false);
            logger.info(err);
            return;
        }
        var users = db.collection('users');
        users.remove(
            { "_id": new mongo.ObjectID(req.body.user._id) },
            function (err) {
                if (err) {
                    res.send(false);
                    logger.info(err);
                    db.close();
                    return;
                }
                res.send(true);
                logger.info('user: ' + req.body.user._id + ' successfully deleted');
                db.close();
            }
        );
    });
});

module.exports = router;
